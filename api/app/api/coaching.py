"""
Coaching API: stateful chat with DB-persisted conversation history.
POST /coaching/chat — send a message, get a response, session created/continued
GET /coaching/sessions — list user's sessions
GET /coaching/sessions/{session_id}/messages — get full message history
GET /coaching/personas — list available personas
"""

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.ingestion import get_current_user
from app.coaching.service import CoachingError, get_coaching_service
from app.db.models import ChatMessage, ChatSession
from app.db.session import get_db
from app.ingestion.guardrail import check_coaching_input
from app.schemas.auth import UserDTO
from app.schemas.coaching import (
    ChatMessageDTO,
    ChatRequest,
    CoachingResponseDTO,
    PersonaDTO,
    SessionSummaryDTO,
)
from app.services.profile_service import ProfileError

router = APIRouter(prefix="/coaching", tags=["coaching"])

_PERSONAS_DIR = Path(__file__).parent.parent / "personas"


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
        db.flush()  # Get the id without committing

    # Build message history from DB
    prior_messages = [{"role": m.role, "content": m.content} for m in session.messages]
    # Append new user message
    messages = prior_messages + [{"role": "user", "content": body.message}]

    # Call CoachingService
    service = get_coaching_service(db=db)
    try:
        result = service.chat(
            user_id=current_user.id,
            messages=messages,
            locale=body.locale,
            persona_id=body.persona_id,
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
    user_msg = ChatMessage(
        id=str(uuid4()),
        session_id=session.id,
        role="user",
        content=body.message,
        created_at=datetime.now(UTC),
    )
    db.add(user_msg)

    # Persist assistant response (as JSON string)
    assistant_content = json.dumps(result, ensure_ascii=False)
    assistant_msg = ChatMessage(
        id=str(uuid4()),
        session_id=session.id,
        role="assistant",
        content=assistant_content,
        created_at=datetime.now(UTC),
    )
    db.add(assistant_msg)

    # Update session timestamp
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
    result = []
    for session in sessions:
        messages = session.messages
        message_count = len(messages)
        last_preview = None
        # Find last assistant message for preview
        for msg in reversed(messages):
            if msg.role == "assistant":
                try:
                    data = json.loads(msg.content)
                    last_preview = data.get("message", "")[:80]
                except Exception:
                    last_preview = msg.content[:80]
                break
        result.append(
            SessionSummaryDTO(
                id=session.id,
                created_at=session.created_at,
                message_count=message_count,
                last_message_preview=last_preview,
                locale=session.locale,
                persona_id=session.persona_id,
            )
        )
    return result


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageDTO])
def get_session_messages(
    session_id: str,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all messages in a session. 404 if session not found or not owned by user."""
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
