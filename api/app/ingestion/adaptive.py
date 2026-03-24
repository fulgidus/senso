"""
Adaptive pipeline: when no module matches, use LLM to:
1. Extract data from the document
2. Generate a Python module that could handle this format in future
Saves generated module to modules/generated/ and registers it.
"""

import json
import logging
import subprocess
import sys
import tempfile
from pathlib import Path

from app.ingestion.llm import LLMClient, LLMError
from app.schemas.ingestion import ExtractedDocument, ExtractionResult

logger = logging.getLogger(__name__)

MODULES_DIR = Path(__file__).parent / "modules"
SANDBOX_TIMEOUT = 10  # seconds

IMPORT_WHITELIST = (
    "csv, io, re, datetime, decimal, json, base64, openpyxl, typing, pathlib"
)

ADAPTIVE_SYSTEM = f"""You are a financial document extraction expert.
Given a document's text content, extract structured financial data AND generate a reusable Python module.

Respond ONLY with valid JSON in this exact format:
{{
  "extraction": {{...ExtractedDocument JSON matching schema...}},
  "module_code": "...valid Python code..."
}}

The module_code MUST:
- Export FINGERPRINT: list[str] with at least 2 unique keywords from this document format
- Export MODULE_VERSION: str = "1.0.0"
- Export extract(file_path: str | Path) -> dict function that returns ExtractedDocument-compatible JSON
- ONLY import from this whitelist: {IMPORT_WHITELIST}
- NO os, NO subprocess, NO requests, NO file I/O outside file_path argument
"""


def run_adaptive_pipeline(
    file_path: Path,
    raw_text: str,
    llm_client: LLMClient,
    registry,  # ModuleRegistry
) -> ExtractionResult:
    """
    Run adaptive extraction. If LLM fails or module code is invalid,
    raises LLMError (caller sets extraction_status="adaptive_failed").
    """
    schema_str = str(ExtractedDocument.model_json_schema())

    prompt = f"""Document text (first 8000 chars):
{raw_text[:8000]}

Target schema: {schema_str}

Extract the financial data AND generate a Python module for this format."""

    raw_json = llm_client.complete(
        prompt=prompt,
        system=ADAPTIVE_SYSTEM,
        json_mode=True,
        timeout=60.0,
    )

    try:
        parsed = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        raise LLMError(f"Adaptive pipeline returned invalid JSON: {exc}") from exc

    extraction_data = parsed.get("extraction", {})
    module_code = parsed.get("module_code", "")

    try:
        doc = ExtractedDocument(**extraction_data)
    except Exception as exc:
        raise LLMError(
            f"Adaptive extraction result failed schema validation: {exc}"
        ) from exc

    # Try to save + validate the generated module
    module_name = None
    if module_code and isinstance(module_code, str):
        module_name = _save_and_validate_module(module_code, file_path, registry)

    return ExtractionResult(
        document=doc,
        confidence=0.5,
        raw_text=raw_text or None,
        tier_used="adaptive",
        warnings=[f"Generated module: {module_name}"]
        if module_name
        else ["Module generation failed — extraction only"],
    )


def _save_and_validate_module(code: str, source_file: Path, registry) -> str | None:
    """
    Validate generated module code in a subprocess sandbox.
    If valid, save to modules/generated/ and register.
    Returns module name on success, None on failure.
    """
    import hashlib

    safe_stem = f"generated_{hashlib.md5(source_file.name.encode()).hexdigest()[:8]}"
    target = MODULES_DIR / "generated" / f"{safe_stem}.py"

    # Write to temp file for sandbox validation
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as tmp:
        tmp.write(code)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                f"import importlib.util; spec=importlib.util.spec_from_file_location('m','{tmp_path}'); "
                f"mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); "
                f"assert hasattr(mod,'FINGERPRINT') and isinstance(mod.FINGERPRINT,list); "
                f"assert hasattr(mod,'MODULE_VERSION') and isinstance(mod.MODULE_VERSION,str); "
                f"assert callable(getattr(mod,'extract',None)); print('OK')",
            ],
            capture_output=True,
            text=True,
            timeout=SANDBOX_TIMEOUT,
        )
        if result.returncode != 0 or "OK" not in result.stdout:
            logger.warning("Generated module failed sandbox: %s", result.stderr)
            return None
    except subprocess.TimeoutExpired:
        logger.warning("Generated module sandbox timed out")
        return None
    except Exception as exc:
        logger.warning("Generated module sandbox error: %s", exc)
        return None
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    # Save and register
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(code)
    registry.register_module(target, "generated")
    logger.info("Saved and registered generated module: %s", target)
    return safe_stem
