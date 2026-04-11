"""
Coaching API: stateful chat with DB-persisted conversation history.
POST /coaching/chat           - send a message, get a response, session created/continued
GET  /coaching/sessions       - list user's sessions (newest first)
GET  /coaching/sessions/{id}/messages - full message history
PATCH /coaching/sessions/{id} - rename a session
DELETE /coaching/sessions/{id} - delete a session and its messages
POST /coaching/name-conversation - generate a short name for a new conversation
GET  /coaching/welcome        - LLM-generated personalised welcome message
GET  /coaching/personas       - list available personas
"""

import json
import queue
import threading
from datetime import UTC, datetime
from pathlib import Path
from itertools import count
from typing import Callable, Literal
from uuid import uuid4

import uuid_utils as uuid_utils_lib

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.ingestion import get_current_user, get_minio_client
from app.coaching.service import CoachingError, get_coaching_service
from app.coaching.tts import TTSService, TTSUnavailableError, ElevenLabsVoiceSettings
from app.personas.loader import (
    get_voice_id,
    get_tts_config,
    get_elevenlabs_settings,
    resolve_effective_gender,
    get_persona_default_gender,
)
from app.core.config import get_settings
from app.db.models import ChatMessage, ChatSession, SessionParticipant
from app.db.session import get_db
from app.ingestion.guardrail import check_coaching_input
from app.schemas.auth import UserDTO
from app.schemas.coaching import (
    ChatMessageDTO,
    ChatRequest,
    CoachingResponseDTO,
    NameConversationRequest,
    NameConversationResponse,
    PersonaDTO,
    RenameSessionRequest,
    SessionSummaryDTO,
    WelcomeResponseDTO,
)
from app.services.profile_service import ProfileError

router = APIRouter(prefix="/coaching", tags=["coaching"])

_PERSONAS_DIR = Path(__file__).parent.parent / "personas"


class TTSRequest(BaseModel):
    text: str
    locale: Literal["it", "en"] = "it"
    persona_id: str | None = None
    gender: str | None = None
    message_id: str | None = (
        None  # FK to chat_messages.id - optional for AudioCache tracking
    )


# ── Helpers ───────────────────────────────────────────────────────────────────


def _auto_session_name(session: ChatSession) -> str:
    """Fallback display name when session.name is None."""
    return session.created_at.strftime("Conversazione %d %b %Y %H:%M")


def _session_to_dto(session: ChatSession, viewer_id: str) -> SessionSummaryDTO:
    messages = session.messages
    last_preview = None
    for msg in reversed(messages):
        if msg.role == "assistant":
            try:
                data = json.loads(msg.content)
                last_preview = data.get("message", "")[:80]
            except Exception:
                last_preview = msg.content[:80]
            break
    return SessionSummaryDTO(
        id=session.id,
        name=session.name or _auto_session_name(session),
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=len(messages),
        last_message_preview=last_preview,
        locale=session.locale,
        persona_id=session.persona_id,
    )


def _get_participant_session(
    db: Session,
    session_id: str,
    user_id: str,
) -> ChatSession:
    """Return the session if the user is a participant, else raise 404."""
    session = (
        db.query(ChatSession)
        .join(SessionParticipant, SessionParticipant.session_id == ChatSession.id)
        .filter(
            ChatSession.id == session_id,
            SessionParticipant.participant_id == user_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "session_not_found", "message": "Session not found"},
        )
    return session


def _get_admin_session(
    db: Session,
    session_id: str,
    user_id: str,
) -> ChatSession:
    """Return the session if the user is a session admin, else raise 404."""
    session = (
        db.query(ChatSession)
        .join(SessionParticipant, SessionParticipant.session_id == ChatSession.id)
        .filter(
            ChatSession.id == session_id,
            SessionParticipant.participant_id == user_id,
            SessionParticipant.is_session_admin == True,  # noqa: E712
        )
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "session_not_found", "message": "Session not found"},
        )
    return session


def _chunk_message_text(message: str) -> list[str]:
    words = message.split()
    if not words:
        return [""]
    chunks: list[str] = []
    index = 0
    while index < len(words):
        chunks.append(" ".join(words[index : index + 4]))
        index += 4
    return chunks


def _prepare_chat_result(
    body: ChatRequest,
    current_user: UserDTO,
    db: Session,
    tool_call_callback: Callable | None = None,
) -> tuple[dict, ChatSession]:
    # Layer 1: Input safety check
    safe, reason = check_coaching_input(body.message)
    if not safe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "input_rejected",
                "message": reason or "Input non consentito.",
            },
        )

    session: ChatSession | None = None
    if body.session_id:
        session = _get_participant_session(db, body.session_id, current_user.id)
    else:
        new_id = str(uuid_utils_lib.uuid7())
        session = ChatSession(
            id=new_id,
            owner_id=current_user.id,
            persona_id=body.persona_id,
            locale=body.locale,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(session)
        db.flush()
        db.add(
            SessionParticipant(
                session_id=session.id,
                participant_id=current_user.id,
                is_session_admin=True,
                can_talk=True,
                can_invite_participants=True,
                can_share=True,
            )
        )
        db.flush()

    prior_messages = [{"role": m.role, "content": m.content} for m in session.messages]
    messages = prior_messages + [{"role": "user", "content": body.message}]

    service = get_coaching_service(db=db)
    settings = get_settings()
    try:
        result = service.chat(
            user_id=current_user.id,
            messages=messages,
            locale=body.locale,
            persona_id=body.persona_id,
            debug=settings.llm_debug,
            tool_call_callback=tool_call_callback,
        )
    except ProfileError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "profile_required", "message": str(exc)},
        )
    except CoachingError as exc:
        db.rollback()
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        )

    user_msg_id = str(uuid_utils_lib.uuid7())
    db.add(
        ChatMessage(
            id=user_msg_id,
            session_id=session.id,
            sender_id=current_user.id,
            persona_id=None,
            role="user",
            content=body.message,
            created_at=datetime.now(UTC),
        )
    )

    assistant_msg_id = str(uuid_utils_lib.uuid7())
    db.add(
        ChatMessage(
            id=assistant_msg_id,
            session_id=session.id,
            sender_id=None,
            persona_id=body.persona_id,
            role="assistant",
            content=json.dumps(result, ensure_ascii=False),
            created_at=datetime.now(UTC),
        )
    )

    session.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(session)
    return result, session


def _coaching_response_dto(result: dict, session: ChatSession) -> CoachingResponseDTO:
    settings = get_settings()
    return CoachingResponseDTO(
        message=result.get("message", ""),
        reasoning_used=result.get("reasoning_used", []),
        content_cards=result.get("content_cards", []),
        interactive_cards=result.get("interactive_cards", []),
        details_a2ui=result.get("details_a2ui"),
        affordability_verdict=result.get("affordability_verdict"),
        transaction_evidence=result.get("transaction_evidence"),
        goal_progress=result.get("goal_progress"),
        session_id=session.id,
        debug=result.get("_debug") if settings.llm_debug else None,
    )


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/chat", response_model=CoachingResponseDTO)
def coaching_chat(
    body: ChatRequest,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a coaching message. Creates or continues a ChatSession."""
    result, session = _prepare_chat_result(body, current_user, db)
    return _coaching_response_dto(result, session)


@router.post("/chat/stream")
def coaching_chat_stream(
    body: ChatRequest,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    granularity = settings.tool_usage_granularity

    # Queue for inter-thread communication
    event_queue: queue.Queue = queue.Queue()

    def tool_callback(tool_name: str, tool_args: dict) -> None:
        """Called from LLM thread when a tool is invoked."""
        if granularity == "hidden":
            return
        event_queue.put(("tool_use", {"tool_name": tool_name, "args": tool_args}))

    def run_chat():
        """Execute coaching chat in background thread, push result to queue."""
        try:
            result, session = _prepare_chat_result(
                body,
                current_user,
                db,
                tool_call_callback=tool_callback if granularity != "hidden" else None,
            )
            dto = _coaching_response_dto(result, session)
            event_queue.put(("result", dto))
        except Exception as exc:
            event_queue.put(("error", str(exc)))

    # Start LLM processing in background thread
    thread = threading.Thread(target=run_chat, daemon=True)
    thread.start()

    def event_stream():
        tool_names_seen: list[str] = []
        grouped_emitted = False

        while True:
            try:
                event_type, data = event_queue.get(timeout=120)
            except queue.Empty:
                yield _sse_event("error", {"message": "timeout"})
                return

            if event_type == "tool_use":
                tool_names_seen.append(data["tool_name"])
                if granularity == "granular":
                    yield _sse_event("tool_use", {"tool_name": data["tool_name"]})
                elif granularity == "grouped" and not grouped_emitted:
                    yield _sse_event("tool_use", {"tool_name": "_grouped"})
                    grouped_emitted = True
                # "hidden" — already filtered in callback, but safety net
                continue

            if event_type == "result":
                dto = data
                # Emit meta
                yield _sse_event(
                    "meta", {"session_id": dto.session_id, "persona_id": body.persona_id}
                )
                # Emit tool summary (list of tools used) for frontend to collapse pills
                if tool_names_seen:
                    yield _sse_event("tools_complete", {"tools_used": tool_names_seen})
                # Emit text chunks
                for chunk in _chunk_message_text(dto.message):
                    yield _sse_event("delta", {"text": chunk})
                # Emit final structured response
                yield _sse_event("final", dto.model_dump())
                yield _sse_event("done", {"session_id": dto.session_id})
                return

            if event_type == "error":
                yield _sse_event("error", {"message": data})
                return

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/sessions", response_model=list[SessionSummaryDTO])
def list_sessions(
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all coaching sessions where the current user is a participant, newest first."""
    sessions = (
        db.query(ChatSession)
        .join(SessionParticipant, SessionParticipant.session_id == ChatSession.id)
        .filter(SessionParticipant.participant_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return [_session_to_dto(s, current_user.id) for s in sessions]


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageDTO])
def get_session_messages(
    session_id: str,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all messages in a session. 404 if not found or user is not a participant."""
    session = _get_participant_session(db, session_id, current_user.id)
    return [
        ChatMessageDTO(
            role=m.role,
            content=m.content,
            created_at=m.created_at,
            sender_id=m.sender_id,
            persona_id=m.persona_id,
        )
        for m in session.messages
    ]


@router.patch("/sessions/{session_id}", response_model=SessionSummaryDTO)
def rename_session(
    session_id: str,
    body: RenameSessionRequest,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rename a coaching session. Requires is_session_admin."""
    session = _get_admin_session(db, session_id, current_user.id)
    session.name = body.name.strip()
    session.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(session)
    return _session_to_dto(session, current_user.id)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: str,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a coaching session and all its messages/audio. Requires is_session_admin."""
    session = _get_admin_session(db, session_id, current_user.id)
    db.delete(session)
    db.commit()


@router.post("/name-conversation", response_model=NameConversationResponse)
def name_conversation(
    body: NameConversationRequest,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a short conversation name from the first user message."""
    service = get_coaching_service(db=db)
    name = service.generate_conversation_name(body.message)
    return NameConversationResponse(name=name)


@router.get("/welcome", response_model=WelcomeResponseDTO)
def get_welcome(
    locale: str = "it",
    persona_id: str = "mentore-saggio",
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a short LLM-generated welcome message personalised with the user's first name."""
    service = get_coaching_service(db=db)
    message = service.get_welcome(
        user_id=current_user.id,
        first_name=None,
        voice_gender=current_user.voice_gender or "indifferent",
        locale=locale,
        persona_id=persona_id,
    )
    return WelcomeResponseDTO(message=message)


@router.get("/personas", response_model=list[PersonaDTO])
def get_personas(
    current_user: UserDTO = Depends(get_current_user),
):
    """Return list of available coaching personas."""
    config_path = _PERSONAS_DIR / "config.json"
    with open(config_path, encoding="utf-8") as f:
        config = json.load(f)
    return [
        PersonaDTO(
            id=p["id"],
            name=p["name"],
            description=p["description"],
            icon=p["icon"],
            available=p.get("available", False),
            tts=get_tts_config(p["id"]),
            defaultGender=p.get("defaultGender", "neutral"),
            theme=p["theme"],
        )
        for p in config.get("personas", [])
        if p.get("available", False)
    ]


@router.post("/tts")
def tts_speak(
    req: TTSRequest,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings=Depends(get_settings),
    minio_client=Depends(get_minio_client),
):
    """Convert coaching response message to MP3 audio bytes via ElevenLabs (MinIO-cached).

    Pass message_id to link the generated audio to a ChatMessage row in audio_cache.
    """
    # req.gender overrides the user preference; if absent, honour user's stored preference
    effective_gender = resolve_effective_gender(
        req.gender or current_user.voice_gender,
        req.persona_id,
    )
    voice_id = get_voice_id(req.persona_id, req.locale, effective_gender)
    svc = TTSService(
        api_key=settings.elevenlabs_api_key,
        minio_client=minio_client,
        bucket=settings.minio_tts_bucket,
    )
    el_settings = get_elevenlabs_settings(req.persona_id)
    vs = ElevenLabsVoiceSettings(
        stability=el_settings.get("stability", 0.75),
        similarity_boost=el_settings.get("similarityBoost", 0.8),
        style=el_settings.get("style", 0.0),
        use_speaker_boost=el_settings.get("useSpeakerBoost", True),
    )
    try:
        audio_bytes = svc.speak(
            req.text,
            voice_id,
            req.locale,
            normalization=el_settings.get("normalization", "elevenlabs"),
            voice_settings=vs,
            db=db if req.message_id else None,
            message_id=req.message_id,
        )
    except TTSUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "tts_unavailable", "message": str(exc)},
        )
    return StreamingResponse(
        iter([audio_bytes]),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=response.mp3"},
    )


class STTResponse(BaseModel):
    text: str


@router.post("/stt", response_model=STTResponse)
async def stt_transcribe(
    audio: UploadFile = File(...),
    locale: str = "it",
    current_user: UserDTO = Depends(get_current_user),
    settings=Depends(get_settings),
):
    """Transcribe uploaded audio to text using a configurable STT provider.

    Accepts multipart/form-data with an audio file (webm, wav, mp4, etc.).
    Falls back to server-side transcription when the browser's Web Speech API
    is unavailable (e.g. LibreWolf blocks it for privacy).

    Provider selection via STT_PROVIDER env var (default: "elevenlabs"):
      - "elevenlabs": ElevenLabs Scribe v1 - requires ELEVENLABS_API_KEY
      - "openai":     OpenAI Whisper v1    - requires LLM_OPENAI_API_KEY

    Returns JSON: { "text": "<transcript>" }

    Raises:
        503 stt_unavailable  - required API key not configured for the active provider
        400 stt_empty_audio  - Empty file uploaded
        502 stt_failed       - STT API call failed
    """
    import io

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "stt_empty_audio", "message": "Empty audio file"},
        )

    language = "it" if locale == "it" else "en"
    provider = settings.stt_provider

    # ── ElevenLabs Scribe (default) ───────────────────────────────────────────
    if provider == "elevenlabs":
        if not settings.elevenlabs_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "stt_unavailable",
                    "message": "STT service not configured (missing ELEVENLABS_API_KEY)",
                },
            )
        try:
            from elevenlabs import ElevenLabs

            client = ElevenLabs(api_key=settings.elevenlabs_api_key)
            filename = audio.filename or "audio.webm"
            raw_content_type = audio.content_type or "audio/webm"
            # ElevenLabs Scribe doesn't support codec parameters or ogg format natively.
            # Normalize: strip codec params (e.g. "audio/ogg;codecs=opus" → "audio/ogg"),
            # then remap ogg → webm (ElevenLabs supported list: mp3, mp4, mpeg, mpga, m4a, wav, webm).
            _base_ct = raw_content_type.split(";")[0].strip()
            if "ogg" in _base_ct:
                # Ogg is not in ElevenLabs supported list — remap to webm for API compatibility.
                content_type = "audio/webm"
                filename = "audio.webm" if filename.endswith(".ogg") else filename
            else:
                content_type = _base_ct
            result = client.speech_to_text.convert(
                audio=(filename, io.BytesIO(audio_bytes), content_type),
                model_id="scribe_v1",
                language_code=language,
            )
            return STTResponse(text=result.text.strip())
        except HTTPException:
            raise
        except Exception as exc:
            import traceback, logging
            logging.error(f"STT ElevenLabs failed: {exc}\n{traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "code": "stt_failed",
                    "message": f"ElevenLabs error: {type(exc).__name__}: {exc}",
                },
            )

    # ── OpenAI Whisper (fallback via STT_PROVIDER=openai) ────────────────────
    from app.core.llm_config import get_llm_config

    llm_config = get_llm_config()
    api_key = llm_config.api_key_for("openai")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "stt_unavailable",
                "message": "STT service not configured (missing LLM_OPENAI_API_KEY)",
            },
        )

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        filename = audio.filename or "audio.webm"
        raw_content_type = audio.content_type or "audio/webm"
        _base_ct = raw_content_type.split(";")[0].strip()
        content_type = _base_ct
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, io.BytesIO(audio_bytes), content_type),
            language=language,
        )
        return STTResponse(text=transcript.text.strip())
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "stt_failed", "message": f"Transcription failed: {exc}"},
        )
