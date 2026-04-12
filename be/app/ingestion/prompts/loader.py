"""
Ingestion prompt loader.

Jinja2 environment backed by the .j2 files in this package directory.
JSON Schema contracts live in ../schemas/*.schema.json.

Schema contracts are passed to LLMClient as response_schema= (structured
outputs) - they do NOT appear in the prompt text.  validate() is the
post-hoc safety net only.

All render_*() functions are the public surface; callers never touch
template names, raw strings, or schema paths directly.

get_schema(name) returns the loaded schema dict for passing to
llm_client.complete(response_schema=...) / llm_client.vision(response_schema=...).

validate(instance, schema_name) validates a parsed LLM response dict
against the named schema using jsonschema, raising ValidationError on
non-conformance.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import jsonschema
from jinja2 import Environment, FileSystemLoader, StrictUndefined

_PROMPTS_DIR = Path(__file__).parent
_SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"

IMPORT_WHITELIST = (
    "csv, io, re, datetime, decimal, json, base64, openpyxl, "
    "typing, pathlib, collections, itertools, functools, string"
)


# ── Jinja2 env ────────────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(_PROMPTS_DIR)),
        undefined=StrictUndefined,
        keep_trailing_newline=True,
    )


def _r(name: str, **ctx) -> str:
    return _env().get_template(name).render(**ctx)


# ── Schema loader ─────────────────────────────────────────────────────────────


@lru_cache(maxsize=16)
def _schema(name: str) -> dict:
    """Load and cache a schema by stem name (without .schema.json suffix)."""
    path = _SCHEMAS_DIR / f"{name}.schema.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def get_schema(name: str) -> dict:
    """
    Return the loaded schema dict for a given stem name.
    Pass to llm_client.complete(response_schema=get_schema("classify_response")).
    """
    return _schema(name)


# ── Public validation ─────────────────────────────────────────────────────────


def validate(instance: dict, schema_name: str) -> None:
    """
    Validate a parsed LLM response dict against the named schema.
    Raises jsonschema.ValidationError on non-conformance.
    """
    jsonschema.validate(instance=instance, schema=_schema(schema_name))


# ── Classification ────────────────────────────────────────────────────────────


def render_classify_system() -> str:
    return _r("classify_system.j2")


def render_classify_prompt(text: str, max_chars: int = 8000) -> str:
    return _r("classify_prompt.j2", text=text[:max_chars], max_chars=max_chars)


# ── Module generation ─────────────────────────────────────────────────────────


def render_module_gen_system() -> str:
    return _r("module_gen_system.j2", import_whitelist=IMPORT_WHITELIST)


def render_module_gen_prompt(
    document_type: str, text: str, max_chars: int = 8000
) -> str:
    return _r(
        "module_gen_prompt.j2",
        document_type=document_type,
        text=text[:max_chars],
        max_chars=max_chars,
    )


def render_module_gen_retry_prompt(
    error: str, hint: str, document_type: str, text: str, max_chars: int = 8000
) -> str:
    return _r(
        "module_gen_retry_prompt.j2",
        error=error,
        hint=hint,
        document_type=document_type,
        text=text[:max_chars],
        max_chars=max_chars,
    )


# ── Unit test generation ──────────────────────────────────────────────────────


def render_unit_test_system() -> str:
    return _r("unit_test_system.j2")


def render_unit_test_prompt(
    module_code: str, text: str, file_path: str, max_chars: int = 4000
) -> str:
    return _r(
        "unit_test_prompt.j2",
        module_code=module_code[:6000],
        text=text[:max_chars],
        max_chars=max_chars,
        file_path=file_path,
    )


# ── LLM text OCR ─────────────────────────────────────────────────────────────


def render_llm_text_ocr_system() -> str:
    return _r("llm_text_ocr_system.j2")


def render_llm_text_ocr_prompt(text: str, max_chars: int = 8000) -> str:
    return _r("llm_text_ocr_prompt.j2", text=text[:max_chars])


def render_llm_text_ocr_retry_prompt(
    error: str, text: str, hint: str | None = None, max_chars: int = 8000
) -> str:
    return _r(
        "llm_text_ocr_retry_prompt.j2",
        error=error,
        hint=hint or "",
        text=text[:max_chars],
    )


# ── LLM vision OCR ───────────────────────────────────────────────────────────


def render_llm_vision_ocr_system() -> str:
    return _r("llm_vision_ocr_system.j2")


def render_llm_vision_ocr_prompt() -> str:
    return _r("llm_vision_ocr_prompt.j2")


def render_llm_vision_ocr_retry_prompt(error: str, hint: str | None = None) -> str:
    return _r("llm_vision_ocr_retry_prompt.j2", error=error, hint=hint or "")
