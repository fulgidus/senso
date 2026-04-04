"""
E2E Messaging API — Phase 14

Endpoints:
  POST /messages/send — store encrypted blob for recipient hashes
  POST /messages/poll — pull and deliver pending messages for authenticated user

Zero-knowledge design:
  - Recipient identity is anchored to sha256($username) — no user_id FK in messaging tables
  - Server computes the caller's hash from their authenticated username (never from client input)
  - Payload content is not inspected — server handles encrypted blobs only
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.ingestion import get_current_user
from app.db.models import DeliveredMessage, UndeliveredMessage
from app.db.repository import (
    compute_recipient_hash,
    get_admin_handles,
    get_all_recipient_hashes,
)
from app.db.session import get_db
from app.schemas.auth import UserDTO

logger = logging.getLogger(__name__)
messages_router = APIRouter(tags=["messages"])


# ── Request / Response schemas ─────────────────────────────────────────────

class PublicKeysResponse(BaseModel):
    username: str
    public_key_b64: str   # X25519 public key (base64, 32 bytes)
    signing_key_b64: str  # Ed25519 verify key (base64, 32 bytes)

class SendMessageRequest(BaseModel):
    recipient_hashes: list[str] = Field(
        min_length=1, description="sha256($username) hex digests or !admin_handles"
    )
    encrypted_payload: str = Field(
        min_length=1, description="Encrypted message blob (PGP-armored or base64)"
    )


class SendMessageResponse(BaseModel):
    message_id: str = Field(alias="messageId")
    created_at: datetime = Field(alias="createdAt")
    recipient_count: int = Field(alias="recipientCount")

    model_config = {"populate_by_name": True}


class PolledMessage(BaseModel):
    id: str
    encrypted_payload: str = Field(alias="encryptedPayload")
    payload_size_bytes: int = Field(alias="payloadSizeBytes")
    created_at: datetime = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


# ── Endpoints ──────────────────────────────────────────────────────────────

@messages_router.get("/users/{username}/public-keys", response_model=PublicKeysResponse)
def get_user_public_keys(
    username: str,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PublicKeysResponse:
    """Return the X25519 and Ed25519 public keys for a given $username or !handle.

    Used by the compose flow to fetch recipient public keys before encryption.
    Requires authentication (prevents unauthenticated key harvesting).

    Args:
        username: Must start with $ or !. URL-encoded if it contains $.

    Returns 404 if user not found or has no keys (pre-Phase-13 account).
    """
    from app.db.repository import get_user_by_username  # noqa: PLC0415

    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found.")
    if not user.public_key_b64 or not user.signing_key_b64:
        raise HTTPException(
            status_code=404,
            detail=f"User '{username}' has no public keys (pre-Phase-13 account).",
        )
    return PublicKeysResponse(
        username=username,
        public_key_b64=user.public_key_b64,
        signing_key_b64=user.signing_key_b64,
    )


@messages_router.post("/send", response_model=SendMessageResponse)
def send_message(
    body: SendMessageRequest,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SendMessageResponse:
    """Store an E2E encrypted message for delivery to one or more recipients.

    Each entry in recipient_hashes must be either:
    - A sha256($username) hex digest (64 hex chars) of a known $-prefixed username, OR
    - A !handle cleartext string matching a known admin_handle.

    Returns 422 if any hash/handle is unknown.
    Payload size is computed server-side — no client-supplied value is trusted.
    """
    known_hashes = get_all_recipient_hashes(db)
    known_handles = get_admin_handles(db)

    unknown = [
        r for r in body.recipient_hashes
        if r not in known_hashes and r not in known_handles
    ]
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown recipient(s): {unknown}. Each must be sha256($username) or a !admin_handle.",
        )

    payload_size = len(body.encrypted_payload.encode("utf-8"))
    now = datetime.now(UTC)
    message_id = str(uuid4())

    msg = UndeliveredMessage(
        id=message_id,
        recipient_hashes=body.recipient_hashes,
        encrypted_payload=body.encrypted_payload,
        payload_size_bytes=payload_size,
        created_at=now,
    )
    db.add(msg)
    db.commit()

    logger.info(
        "Message %s sent to %d recipient(s) (%d bytes)",
        message_id,
        len(body.recipient_hashes),
        payload_size,
    )

    return SendMessageResponse(
        message_id=message_id,
        created_at=now,
        recipient_count=len(body.recipient_hashes),
    )


@messages_router.post("/poll", response_model=list[PolledMessage])
def poll_messages(
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PolledMessage]:
    """Pull and deliver all pending messages for the authenticated user.

    Server computes sha256($caller_username) internally — client sends nothing extra.

    Delivery loop (D-08):
    1. Find undelivered_messages WHERE caller_hash = ANY(recipient_hashes)
    2. Copy each to delivered_messages (insert or append to delivered_at)
    3. Remove caller_hash from recipient_hashes
    4. Delete undelivered_messages row when recipient_hashes becomes empty
    5. Return the delivered message payloads
    """
    if not current_user.username:
        raise HTTPException(status_code=400, detail="User has no username; cannot poll messages.")

    caller_hash = compute_recipient_hash(current_user.username)
    now = datetime.now(UTC)

    # Fetch pending messages using raw SQL for Postgres ARRAY ANY() query
    result = db.execute(
        sa.text(
            "SELECT id, recipient_hashes, encrypted_payload, payload_size_bytes, created_at "
            "FROM undelivered_messages "
            "WHERE :caller_hash = ANY(recipient_hashes)"
        ),
        {"caller_hash": caller_hash},
    ).fetchall()

    if not result:
        return []

    delivered: list[PolledMessage] = []

    for row in result:
        msg_id, recipient_hashes, encrypted_payload, payload_size_bytes, created_at = row
        delivery_event = {"hash": caller_hash, "at": now.isoformat()}

        # Insert or update delivered_messages
        existing = db.query(DeliveredMessage).filter(DeliveredMessage.id == msg_id).first()
        if existing is None:
            delivered_msg = DeliveredMessage(
                id=msg_id,
                recipient_hashes=recipient_hashes,
                encrypted_payload=encrypted_payload,
                payload_size_bytes=payload_size_bytes,
                created_at=created_at,
                delivered_at=[delivery_event],
                source_message_id=msg_id,
            )
            db.add(delivered_msg)
        else:
            # Append delivery event to existing delivered_at JSONB array
            updated_events = list(existing.delivered_at or []) + [delivery_event]
            db.execute(
                sa.text(
                    "UPDATE delivered_messages SET delivered_at = :events::jsonb WHERE id = :id"
                ),
                {"events": sa.func.cast(str(updated_events).replace("'", '"'), sa.Text), "id": msg_id},
            )

        # Remove caller_hash from recipient_hashes in undelivered_messages
        new_hashes = [h for h in recipient_hashes if h != caller_hash]
        if new_hashes:
            db.execute(
                sa.text(
                    "UPDATE undelivered_messages SET recipient_hashes = :hashes WHERE id = :id"
                ),
                {"hashes": new_hashes, "id": msg_id},
            )
        else:
            db.execute(
                sa.text("DELETE FROM undelivered_messages WHERE id = :id"),
                {"id": msg_id},
            )

        delivered.append(
            PolledMessage(
                id=msg_id,
                encrypted_payload=encrypted_payload,
                payload_size_bytes=payload_size_bytes,
                created_at=created_at,
            )
        )

    db.commit()
    logger.info("Delivered %d message(s) to %s", len(delivered), current_user.username)
    return delivered
