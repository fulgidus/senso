"""
Coaching API: stateful chat with DB-persisted conversation history.
POST /coaching/chat           — send a message, get a response, session created/continued
GET  /coaching/sessions       — list user's sessions (newest first)
GET  /coaching/sessions/{id}/messages — full message history
PATCH /coaching/sessions/{id} — rename a session
DELETE /coaching/sessions/{id} — delete a session and its messages
POST /coaching/name-conversation — generate a short name for a new conversation
GET  /coaching/welcome        — LLM-generated personalised welcome message
GET  /coaching/personas       — list available personas
"""

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.ingestion import get_current_user
from app.coaching.service import CoachingError, get_coaching_service
from app.coaching.tts import TTSService, TTSUnavailableError
from app.core.config import get_settings
from app.db.models import ChatMessage, ChatSession
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


# ── Helpers ───────────────────────────────────────────────────────────────────


def _auto_session_name(session: ChatSession) -> str:
    """Fallback display name when session.name is None."""
    return session.created_at.strftime("Conversazione %d %b %Y %H:%M")


def _session_to_dto(session: ChatSession) -> SessionSummaryDTO:
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


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/chat", response_model=CoachingResponseDTO)
def coaching_chat(
    body: ChatRequest,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a coaching message. Creates or continues a ChatSession."""
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

    # Load or create session
    session: ChatSession | None = None
    if body.session_id:
        session = (
            db.query(ChatSession)
            .filter(
                ChatSession.id == body.session_id,
                ChatSession.user_id == current_user.id,
            )
            .first()
        )
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "session_not_found", "message": "Session not found"},
            )
    else:
        session = ChatSession(
            id=str(uuid4()),
            user_id=current_user.id,
            persona_id=body.persona_id,
            locale=body.locale,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(session)
        db.flush()  # get id without committing

    # Build message history from DB
    prior_messages = [{"role": m.role, "content": m.content} for m in session.messages]
    messages = prior_messages + [{"role": "user", "content": body.message}]

    # Call CoachingService
    service = get_coaching_service(db=db)
    settings = get_settings()
    try:
        result = service.chat(
            user_id=current_user.id,
            messages=messages,
            locale=body.locale,
            persona_id=body.persona_id,
            debug=settings.llm_debug,
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

    # Persist user message
    db.add(
        ChatMessage(
            id=str(uuid4()),
            session_id=session.id,
            role="user",
            content=body.message,
            created_at=datetime.now(UTC),
        )
    )

    # Persist assistant response (as JSON string)
    db.add(
        ChatMessage(
            id=str(uuid4()),
            session_id=session.id,
            role="assistant",
            content=json.dumps(result, ensure_ascii=False),
            created_at=datetime.now(UTC),
        )
    )

    session.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(session)

    return CoachingResponseDTO(
        message=result.get("message", ""),
        reasoning_used=result.get("reasoning_used", []),
        action_cards=result.get("action_cards", []),
        resource_cards=result.get("resource_cards", []),
        learn_cards=result.get("learn_cards", []),
        session_id=session.id,
        debug=result.get("_debug") if settings.llm_debug else None,
    )


@router.get("/sessions", response_model=list[SessionSummaryDTO])
def list_sessions(
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all coaching sessions for the current user, newest first."""
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return [_session_to_dto(s) for s in sessions]


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageDTO])
def get_session_messages(
    session_id: str,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all messages in a session. 404 if not found or not owned by user."""
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "session_not_found", "message": "Session not found"},
        )
    return [
        ChatMessageDTO(role=m.role, content=m.content, created_at=m.created_at)
        for m in session.messages
    ]


@router.patch("/sessions/{session_id}", response_model=SessionSummaryDTO)
def rename_session(
    session_id: str,
    body: RenameSessionRequest,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rename a coaching session. Rejects empty names."""
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "session_not_found", "message": "Session not found"},
        )
    session.name = body.name.strip()
    session.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(session)
    return _session_to_dto(session)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: str,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a coaching session and all its messages (cascade)."""
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "session_not_found", "message": "Session not found"},
        )
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
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a short LLM-generated welcome message personalised with the user's first name."""
    service = get_coaching_service(db=db)
    message = service.get_welcome(
        user_id=current_user.id,
        first_name=current_user.first_name,
        locale=locale,
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
        )
        for p in config.get("personas", [])
        if p.get("available", False)
    ]


@router.post("/tts")
def tts_speak(
    req: TTSRequest,
    current_user: UserDTO = Depends(get_current_user),
    settings=Depends(get_settings),
):
    """Convert coaching response message to MP3 audio bytes via ElevenLabs."""
    svc = TTSService(
        api_key=settings.elevenlabs_api_key, voice_id=settings.elevenlabs_voice_id
    )
    try:
        audio_bytes = svc.speak(req.text, req.locale)
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
