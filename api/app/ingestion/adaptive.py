"""
Adaptive pipeline: when no builtin module matches, use LLM to:
1. Classify the document type
2. Generate a Python extraction module
3. Generate unit tests for that module
4. Run unit tests in a subprocess sandbox against the actual file
5. Save + register the module if tests pass
6. Partial-failure mitigation: fall back to direct LLM extraction if module extracts 0 txns
7. Complete-failure mitigation: return best-effort LLM extraction with low confidence

Failure modes are enumerated in AdaptiveFailureMode.
"""

from __future__ import annotations

import json
import jsonschema
import logging
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

from app.ingestion.llm import LLMClient, LLMError
from app.ingestion.prompts.loader import (
    get_schema,
    render_classify_system,
    render_classify_prompt,
    render_llm_text_ocr_system,
    render_llm_text_ocr_prompt,
    render_llm_text_ocr_retry_prompt,
    render_module_gen_system,
    render_module_gen_prompt,
    render_module_gen_retry_prompt,
    render_unit_test_system,
    render_unit_test_prompt,
    validate,
)
from app.schemas.ingestion import ExtractedDocument, ExtractionResult

logger = logging.getLogger(__name__)

MODULES_DIR = Path(__file__).parent / "modules"
SANDBOX_TIMEOUT = 15  # seconds per subprocess call
MAX_MODULE_RETRIES = 2
MAX_TEXT_CHARS = 8000
MAX_TEST_CHARS = 4000


# ── Failure taxonomy ──────────────────────────────────────────────────────────


class AdaptiveFailureMode(str, Enum):
    """All possible failure modes in the adaptive pipeline."""

    LLM_UNAVAILABLE = "llm_unavailable"
    JSON_INVALID = "json_invalid"
    SCHEMA_VALIDATION_FAILED = "schema_validation_failed"
    MODULE_SYNTAX_ERROR = "module_syntax_error"
    MODULE_RUNTIME_ERROR = "module_runtime_error"
    MODULE_TEST_GENERATION_FAILED = "module_test_generation_failed"
    MODULE_TEST_FAILED = "module_test_failed"
    PARTIAL_EXTRACTION = "partial_extraction"  # module ran but extracted 0 txns
    COMPLETE_FAILURE = "complete_failure"  # nothing extracted at all


# ── Internal result dataclass ─────────────────────────────────────────────────


@dataclass
class AdaptiveResult:
    extraction: ExtractedDocument | None = None
    module_name: str | None = None
    failure_modes: list[AdaptiveFailureMode] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    confidence: float = 0.0
    tier_used: str = "adaptive"


# ═══════════════════════════════════════════════════════════════════════════════
# Public entry point
# ═══════════════════════════════════════════════════════════════════════════════


_NON_LEDGER_TYPES = frozenset({"payslip", "receipt", "invoice", "utility_bill"})


def _extraction_has_content(ext: ExtractedDocument) -> bool:
    """Return True if extraction produced usable content.

    For bank statements: requires at least one transaction.
    For non-ledger types: requires at least one non-null key field.
    Unknown with no content: False.
    """
    if ext.transactions:
        return True
    if ext.document_type in _NON_LEDGER_TYPES:
        return any([
            ext.net_income,
            ext.gross_income,
            ext.total_due,       # utility_bill
            ext.total_amount,    # receipt / invoice
            ext.merchant,
            ext.provider,
        ])
    return False


def run_adaptive_pipeline(
    file_path: Path,
    raw_text: str,
    llm_client: LLMClient,
    registry,  # ModuleRegistry
    hint: str | None = None,
) -> ExtractionResult:
    """
    Full adaptive pipeline. Never raises - returns ExtractionResult with
    appropriate tier_used and warnings describing what happened.
    """
    result = AdaptiveResult()

    # Phase 1: Classify document type
    doc_type = _classify_document(raw_text, llm_client, result)

    # Phase 2: Generate + validate module (with retries)
    module_name = _generate_and_validate_module(
        file_path, raw_text, doc_type, llm_client, registry, result
    )
    result.module_name = module_name

    # Phase 3: If module is registered, run it on the actual file
    if module_name:
        extraction = _run_registered_module(file_path, module_name, registry, result)
        if extraction is not None:
            if _extraction_has_content(extraction):
                result.extraction = extraction
                result.confidence = 0.7
                result.tier_used = "pdf_adaptive_module"
                return _to_extraction_result(result)
            else:
                # Module ran but extracted nothing (partial failure)
                result.failure_modes.append(AdaptiveFailureMode.PARTIAL_EXTRACTION)
                result.warnings.append(
                    f"Module {module_name!r} ran but extracted 0 transactions; "
                    "falling back to direct LLM extraction"
                )

    # Phase 4: Direct LLM text extraction (fallback or partial-failure path)
    extraction = _llm_text_extraction(raw_text, llm_client, result, hint=hint)
    if extraction is not None:
        result.extraction = extraction
        result.confidence = 0.45
        result.tier_used = "pdf_llm_text"
        return _to_extraction_result(result)

    # Phase 5: Complete failure - return empty doc with all warnings
    result.failure_modes.append(AdaptiveFailureMode.COMPLETE_FAILURE)
    result.warnings.append(
        "All adaptive pipeline stages failed; returning empty document"
    )
    result.extraction = ExtractedDocument(document_type="unknown")
    result.confidence = 0.0
    result.tier_used = "adaptive"
    return _to_extraction_result(result)


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 1 - Document classification
# ═══════════════════════════════════════════════════════════════════════════════


def _classify_document(text: str, llm_client: LLMClient, result: AdaptiveResult) -> str:
    """Return document_type string; falls back to 'unknown' on any error."""
    try:
        prompt = render_classify_prompt(text, max_chars=MAX_TEXT_CHARS)
        raw = llm_client.complete(
            prompt=prompt,
            system=render_classify_system(),
            response_schema=get_schema("classify_response"),
            route="text:classification:sm",
        )
        parsed = json.loads(raw)
        validate(parsed, "classify_response")
        doc_type = parsed.get("document_type", "unknown")
        logger.info(
            "Adaptive: classified as %r (confidence %.2f)",
            doc_type,
            parsed.get("confidence", 0),
        )
        return doc_type
    except LLMError as exc:
        result.failure_modes.append(AdaptiveFailureMode.LLM_UNAVAILABLE)
        result.warnings.append(f"Classification LLM failed: {exc}")
        return "unknown"
    except (json.JSONDecodeError, KeyError) as exc:
        result.failure_modes.append(AdaptiveFailureMode.JSON_INVALID)
        result.warnings.append(f"Classification JSON parse error: {exc}")
        return "unknown"
    except jsonschema.ValidationError as exc:
        result.failure_modes.append(AdaptiveFailureMode.SCHEMA_VALIDATION_FAILED)
        result.warnings.append(f"Classification schema invalid: {exc.message}")
        return "unknown"


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 2 - Module generation, unit-test generation, sandbox validation
# ═══════════════════════════════════════════════════════════════════════════════


def _generate_and_validate_module(
    file_path: Path,
    text: str,
    doc_type: str,
    llm_client: LLMClient,
    registry,
    result: AdaptiveResult,
) -> str | None:
    """
    Try up to MAX_MODULE_RETRIES times to generate a valid module.
    Returns module stem name on success, None on all-retries failure.
    """
    last_error: str = ""

    for attempt in range(MAX_MODULE_RETRIES):
        # Generate module code
        module_code = _call_module_gen(
            text,
            doc_type,
            llm_client,
            result,
            retry_error=last_error if attempt > 0 else None,
        )
        if module_code is None:
            break  # LLM unavailable - no point retrying

        # Sandbox syntax + interface check
        sandbox_ok, sandbox_error = _sandbox_validate_module(module_code, result)
        if not sandbox_ok:
            last_error = sandbox_error
            result.warnings.append(
                f"Module gen attempt {attempt + 1} failed sandbox: {sandbox_error}"
            )
            continue

        # Generate unit tests
        test_code = _call_test_gen(text, module_code, file_path, llm_client, result)

        # Run unit tests in subprocess
        if test_code:
            tests_passed, test_error = _run_unit_tests(
                module_code, test_code, file_path, result
            )
            if not tests_passed:
                last_error = test_error
                result.warnings.append(
                    f"Module gen attempt {attempt + 1} unit tests failed: {test_error}"
                )
                continue

        # All checks passed - save and register
        module_name = _save_and_register_module(
            module_code, file_path, registry, result
        )
        if module_name:
            return module_name
        break  # save failed - don't retry

    return None


def _call_module_gen(
    text: str,
    doc_type: str,
    llm_client: LLMClient,
    result: AdaptiveResult,
    retry_error: str | None,
) -> str | None:
    """Call LLM to generate module code. Returns code string or None."""
    try:
        if retry_error:
            prompt = render_module_gen_retry_prompt(
                error=retry_error,
                hint="Fix the specific error described above",
                document_type=doc_type,
                text=text,
                max_chars=MAX_TEXT_CHARS,
            )
        else:
            prompt = render_module_gen_prompt(
                document_type=doc_type,
                text=text,
                max_chars=MAX_TEXT_CHARS,
            )

        raw = llm_client.complete(
            prompt=prompt,
            system=render_module_gen_system(),
            response_schema=get_schema("module_gen_response"),
            route="text:generation:lg",
            timeout=90.0,
        )
        parsed = json.loads(raw)
        validate(parsed, "module_gen_response")
        code = parsed.get("module_code", "")
        if not code or not isinstance(code, str):
            result.failure_modes.append(AdaptiveFailureMode.MODULE_SYNTAX_ERROR)
            result.warnings.append("Module gen returned empty code")
            return None
        return code
    except LLMError as exc:
        result.failure_modes.append(AdaptiveFailureMode.LLM_UNAVAILABLE)
        result.warnings.append(f"Module generation LLM failed: {exc}")
        return None
    except (json.JSONDecodeError, KeyError) as exc:
        result.failure_modes.append(AdaptiveFailureMode.JSON_INVALID)
        result.warnings.append(f"Module generation JSON parse error: {exc}")
        return None
    except jsonschema.ValidationError as exc:
        result.failure_modes.append(AdaptiveFailureMode.SCHEMA_VALIDATION_FAILED)
        result.warnings.append(f"Module gen schema invalid: {exc.message}")
        return None


def _sandbox_validate_module(code: str, result: AdaptiveResult) -> tuple[bool, str]:
    """
    Validate module in subprocess:
    - imports cleanly
    - exposes FINGERPRINT (list), MODULE_VERSION (str), extract (callable)
    Returns (ok, error_message).
    """
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as tmp:
        tmp.write(code)
        tmp_path = tmp.name

    try:
        check_script = (
            f"import importlib.util; "
            f"spec=importlib.util.spec_from_file_location('m',{tmp_path!r}); "
            f"mod=importlib.util.module_from_spec(spec); "
            f"spec.loader.exec_module(mod); "
            f"assert hasattr(mod,'FINGERPRINT') and isinstance(mod.FINGERPRINT,list), "
            f"'FINGERPRINT must be list'; "
            f"assert hasattr(mod,'MODULE_VERSION') and isinstance(mod.MODULE_VERSION,str), "
            f"'MODULE_VERSION must be str'; "
            f"assert callable(getattr(mod,'extract',None)), 'extract must be callable'; "
            f"print('OK')"
        )
        proc = subprocess.run(
            [sys.executable, "-c", check_script],
            capture_output=True,
            text=True,
            timeout=SANDBOX_TIMEOUT,
        )
        if proc.returncode != 0 or "OK" not in proc.stdout:
            err = (proc.stderr or proc.stdout or "unknown error")[:500]
            result.failure_modes.append(AdaptiveFailureMode.MODULE_SYNTAX_ERROR)
            return False, err
        return True, ""
    except subprocess.TimeoutExpired:
        result.failure_modes.append(AdaptiveFailureMode.MODULE_RUNTIME_ERROR)
        return False, "sandbox validation timed out"
    except Exception as exc:
        result.failure_modes.append(AdaptiveFailureMode.MODULE_RUNTIME_ERROR)
        return False, str(exc)
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _call_test_gen(
    text: str,
    module_code: str,
    file_path: Path,
    llm_client: LLMClient,
    result: AdaptiveResult,
) -> str | None:
    """Generate unit tests via LLM. Returns test code or None on failure."""
    try:
        prompt = render_unit_test_prompt(
            module_code=module_code,
            text=text,
            file_path=str(file_path),
            max_chars=MAX_TEST_CHARS,
        )
        raw = llm_client.complete(
            prompt=prompt,
            system=render_unit_test_system(),
            response_schema=get_schema("unit_test_response"),
            route="text:generation:md",
            timeout=60.0,
        )
        parsed = json.loads(raw)
        validate(parsed, "unit_test_response")
        test_code = parsed.get("test_code", "")
        if not test_code or not isinstance(test_code, str):
            result.failure_modes.append(
                AdaptiveFailureMode.MODULE_TEST_GENERATION_FAILED
            )
            result.warnings.append("Test generation returned empty code")
            return None
        return test_code
    except (LLMError, json.JSONDecodeError, KeyError) as exc:
        result.failure_modes.append(AdaptiveFailureMode.MODULE_TEST_GENERATION_FAILED)
        result.warnings.append(f"Test generation failed: {exc}")
        return None
    except jsonschema.ValidationError as exc:
        result.failure_modes.append(AdaptiveFailureMode.MODULE_TEST_GENERATION_FAILED)
        result.warnings.append(f"Test gen schema invalid: {exc.message}")
        return None


def _run_unit_tests(
    module_code: str,
    test_code: str,
    file_path: Path,
    result: AdaptiveResult,
) -> tuple[bool, str]:
    """
    Write module + test to temp files, run pytest in subprocess.
    Returns (passed, error_message).
    """
    with (
        tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False, prefix="senso_mod_"
        ) as mod_tmp,
        tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False, prefix="senso_test_"
        ) as test_tmp,
    ):
        mod_tmp.write(module_code)
        mod_path = mod_tmp.name
        test_tmp.write(test_code)
        test_path = test_tmp.name

    try:
        proc = subprocess.run(
            [
                sys.executable,
                "-m",
                "pytest",
                test_path,
                "-x",
                "-q",
                "--tb=short",
                "--no-header",
                f"--file_path={file_path}",
                f"--module_path={mod_path}",
            ],
            capture_output=True,
            text=True,
            timeout=SANDBOX_TIMEOUT * 2,
        )
        if proc.returncode != 0:
            err = (proc.stdout + proc.stderr)[:800]
            result.failure_modes.append(AdaptiveFailureMode.MODULE_TEST_FAILED)
            return False, err
        return True, ""
    except subprocess.TimeoutExpired:
        result.failure_modes.append(AdaptiveFailureMode.MODULE_TEST_FAILED)
        return False, "unit test run timed out"
    except Exception as exc:
        result.failure_modes.append(AdaptiveFailureMode.MODULE_TEST_FAILED)
        return False, str(exc)
    finally:
        Path(mod_path).unlink(missing_ok=True)
        Path(test_path).unlink(missing_ok=True)


def _save_and_register_module(
    code: str, source_file: Path, registry, result: AdaptiveResult
) -> str | None:
    """Save generated module to modules/generated/ and register it. Returns stem or None."""
    import hashlib

    safe_stem = f"generated_{hashlib.md5(source_file.name.encode()).hexdigest()[:8]}"
    target = MODULES_DIR / "generated" / f"{safe_stem}.py"
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(code)
        registry.register_module(target, "generated")
        logger.info("Saved and registered generated module: %s", target)
        return safe_stem
    except Exception as exc:
        result.warnings.append(f"Failed to save/register module: {exc}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 3 - Run registered module on actual file
# ═══════════════════════════════════════════════════════════════════════════════


def _run_registered_module(
    file_path: Path, module_name: str, registry, result: AdaptiveResult
) -> ExtractedDocument | None:
    """Look up module in registry by stem and call extract(). Returns doc or None."""
    try:
        # Find the entry by name
        entry = next((e for e in registry.modules if e.name == module_name), None)
        if entry is None:
            result.warnings.append(
                f"Registered module {module_name!r} not found in registry"
            )
            return None
        raw = entry.extract_fn(file_path)
        if isinstance(raw, ExtractionResult):
            return raw.document
        if isinstance(raw, dict):
            return ExtractedDocument(**raw)
        result.warnings.append(
            f"Module {module_name!r} returned unexpected type: {type(raw)}"
        )
        return None
    except Exception as exc:
        result.failure_modes.append(AdaptiveFailureMode.MODULE_RUNTIME_ERROR)
        result.warnings.append(
            f"Module {module_name!r} raised during extraction: {exc}"
        )
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 4 - Direct LLM text extraction
# ═══════════════════════════════════════════════════════════════════════════════


def _llm_text_extraction(
    text: str,
    llm_client: LLMClient,
    result: AdaptiveResult,
    hint: str | None = None,
) -> ExtractedDocument | None:
    """Extract directly via LLM text prompt. Returns doc or None."""
    from app.schemas.ingestion import ExtractedDocument as ED

    for attempt in range(2):
        try:
            if attempt == 0:
                prompt = render_llm_text_ocr_prompt(text, max_chars=MAX_TEXT_CHARS)
            else:
                last_err = result.warnings[-1] if result.warnings else "unknown error"
                prompt = render_llm_text_ocr_retry_prompt(
                    error=last_err,
                    text=text,
                    hint=hint,
                    max_chars=MAX_TEXT_CHARS,
                )

            raw = llm_client.complete(
                prompt=prompt,
                system=render_llm_text_ocr_system(),
                response_schema=get_schema("extracted_document"),
                route="text:generation:md",
                timeout=60.0,
            )
            parsed = json.loads(raw)
            return ED(**parsed)
        except LLMError as exc:
            result.failure_modes.append(AdaptiveFailureMode.LLM_UNAVAILABLE)
            result.warnings.append(
                f"LLM text extraction attempt {attempt + 1} failed: {exc}"
            )
            break  # no fallback - LLM unavailable
        except json.JSONDecodeError as exc:
            result.failure_modes.append(AdaptiveFailureMode.JSON_INVALID)
            result.warnings.append(
                f"LLM text extraction JSON error (attempt {attempt + 1}): {exc}"
            )
        except Exception as exc:
            result.failure_modes.append(AdaptiveFailureMode.SCHEMA_VALIDATION_FAILED)
            result.warnings.append(
                f"LLM text extraction schema error (attempt {attempt + 1}): {exc}"
            )

    return None


# ═══════════════════════════════════════════════════════════════════════════════
# Helper
# ═══════════════════════════════════════════════════════════════════════════════


def _to_extraction_result(r: AdaptiveResult) -> ExtractionResult:
    assert r.extraction is not None
    failure_warnings = [f"failure:{fm.value}" for fm in r.failure_modes]
    return ExtractionResult(
        document=r.extraction,
        confidence=r.confidence,
        tier_used=r.tier_used,  # type: ignore[arg-type]
        warnings=failure_warnings + r.warnings,
    )
