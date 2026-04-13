"""
Text extraction via the liteparse sidecar service.

The sidecar (`liteparse/`) runs @llamaindex/liteparse inside a Node.js
container and exposes a multipart HTTP API. The backend decrypts document
bytes from S3, then ships them to the sidecar over the internal Docker
network — no plaintext data ever touches persistent storage.

Sidecar URL is configured via the LITEPARSE_URL environment variable
(default: http://liteparse:3002).
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


# ── Public types ───────────────────────────────────────────────────────────────


@dataclass
class LiteparseFile:
    data: bytes
    filename: str
    ocr: bool = True


@dataclass
class LiteparseResult:
    id: str
    parsed: str


# ── Batch entry point ──────────────────────────────────────────────────────────


def extract_text_with_liteparse(
    files: list[LiteparseFile],
) -> list[LiteparseResult]:
    """
    Extract plain text from one or more documents via the liteparse sidecar.

    Sends decrypted in-memory bytes as a multipart upload — nothing is written
    to persistent storage. Results are returned in the same order as inputs.
    ``parsed`` is an empty string on failure.
    """
    if not files:
        return []

    tagged = [(str(uuid.uuid4()), f) for f in files]
    meta = json.dumps([{"id": fid, "ocr": f.ocr} for fid, f in tagged])
    multipart: list[tuple[str, tuple[str, bytes]]] = [
        (fid, (f.filename, f.data)) for fid, f in tagged
    ]

    try:
        with httpx.Client(timeout=300) as client:
            response = client.post(
                f"{get_settings().liteparse_url}/parse",
                data={"meta": meta},
                files=multipart,
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("liteparse sidecar request failed: %s", exc)
        return [LiteparseResult(id=fid, parsed="") for fid, _ in tagged]

    id_order = [fid for fid, _ in tagged]
    results_by_id = {r["id"]: r["parsed"] for r in response.json()}

    return [
        LiteparseResult(id=fid, parsed=results_by_id.get(fid, ""))
        for fid in id_order
    ]


# ── Single-file convenience wrapper ───────────────────────────────────────────


def extract_single(file_path: Path, *, ocr: bool = True) -> str:
    """
    Convenience wrapper for the common single-file case.

    Reads bytes from an already-decrypted on-disk file and returns extracted
    text. Returns an empty string on any failure.
    """
    try:
        data = file_path.read_bytes()
    except OSError as exc:
        logger.error("Cannot read file %s: %s", file_path, exc)
        return ""

    results = extract_text_with_liteparse(
        [LiteparseFile(data=data, filename=file_path.name, ocr=ocr)]
    )
    return results[0].parsed if results else ""
