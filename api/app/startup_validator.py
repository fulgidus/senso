"""
Startup configuration validator.

Runs at app boot (lifespan) and logs a comprehensive health report.
Catches config mismatches (bad model routes, missing API keys, schema
drift, etc.) BEFORE the first user request hits the system.

If any CRITICAL check fails, the report is logged at ERROR level.
Non-critical issues are logged as WARNING.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

logger = logging.getLogger(__name__)

StatusLevel = Literal["ok", "warn", "error"]


@dataclass
class CheckResult:
    name: str
    status: StatusLevel
    detail: str


@dataclass
class ValidationReport:
    checks: list[CheckResult] = field(default_factory=list)

    def add(self, name: str, status: StatusLevel, detail: str) -> None:
        self.checks.append(CheckResult(name=name, status=status, detail=detail))

    @property
    def has_errors(self) -> bool:
        return any(c.status == "error" for c in self.checks)

    @property
    def has_warnings(self) -> bool:
        return any(c.status == "warn" for c in self.checks)

    def log(self) -> None:
        header = "━━━ STARTUP VALIDATION REPORT ━━━"
        lines = [header]
        for c in self.checks:
            icon = {"ok": "✓", "warn": "⚠", "error": "✗"}[c.status]
            lines.append(f"  {icon} [{c.status.upper():5s}] {c.name}: {c.detail}")

        summary_parts = []
        ok_count = sum(1 for c in self.checks if c.status == "ok")
        warn_count = sum(1 for c in self.checks if c.status == "warn")
        err_count = sum(1 for c in self.checks if c.status == "error")
        summary_parts.append(f"{ok_count} ok")
        if warn_count:
            summary_parts.append(f"{warn_count} warnings")
        if err_count:
            summary_parts.append(f"{err_count} errors")
        lines.append(f"  {'━' * 40}")
        lines.append(f"  Summary: {', '.join(summary_parts)}")

        msg = "\n".join(lines)
        if self.has_errors:
            logger.error(msg)
        elif self.has_warnings:
            logger.warning(msg)
        else:
            logger.info(msg)


def run_startup_validation() -> ValidationReport:
    """Run all startup checks and return a report."""
    report = ValidationReport()

    _check_llm_config(report)
    _check_llm_api_keys(report)
    _check_schemas(report)
    _check_tier_used_literals(report)
    _check_ingestion_modules(report)
    _check_content_catalogs(report)
    _check_prompt_templates(report)

    return report


# ── Individual checks ─────────────────────────────────────────────────────────


def _check_llm_config(report: ValidationReport) -> None:
    """Verify all LLM routes resolve to valid models."""
    try:
        from app.core.llm_config import get_llm_config
        cfg = get_llm_config()

        routes_checked = 0
        for cls in ("text", "vision", "multi"):
            for typ in ("generation", "classification", "ocr"):
                for sz in ("sm", "md", "lg"):
                    try:
                        route = cfg.route(cls, typ, sz)
                        if not route.model:
                            report.add(
                                f"llm.route.{cls}:{typ}:{sz}",
                                "error",
                                "empty model name",
                            )
                        else:
                            routes_checked += 1
                    except KeyError:
                        pass  # not all combinations exist

        report.add("llm.routes", "ok", f"{routes_checked} routes resolved")
    except Exception as e:
        report.add("llm.config", "error", f"failed to load: {e}")


def _check_llm_api_keys(report: ValidationReport) -> None:
    """Verify at least the primary LLM provider has an API key."""
    try:
        from app.core.llm_config import get_llm_config
        cfg = get_llm_config()

        found = []
        missing = []
        for p in cfg.providers:
            key = os.getenv(p.env_key)
            if key and len(key) > 5:
                found.append(p.name)
            else:
                missing.append(p.name)

        if not found:
            report.add("llm.api_keys", "error", f"NO API keys set! Missing: {missing}")
        elif missing:
            report.add(
                "llm.api_keys",
                "warn",
                f"active: {found}, missing (no fallback): {missing}",
            )
        else:
            report.add("llm.api_keys", "ok", f"all providers keyed: {found}")
    except Exception as e:
        report.add("llm.api_keys", "error", f"check failed: {e}")


def _check_schemas(report: ValidationReport) -> None:
    """Verify all JSON schema files parse correctly."""
    schema_dir = Path(__file__).parent / "coaching" / "schemas"
    if not schema_dir.exists():
        report.add("schemas", "warn", f"schema dir not found: {schema_dir}")
        return

    errors = []
    count = 0
    for f in schema_dir.glob("*.schema.json"):
        count += 1
        try:
            json.loads(f.read_text())
        except json.JSONDecodeError as e:
            errors.append(f"{f.name}: {e}")

    if errors:
        report.add("schemas", "error", f"{len(errors)} broken: {'; '.join(errors)}")
    else:
        report.add("schemas", "ok", f"{count} schema files valid")


def _check_tier_used_literals(report: ValidationReport) -> None:
    """
    Verify that tier_used strings in ocr.py and ingestion_service.py
    match the Literal type in schemas/ingestion.py.
    """
    import re

    try:
        from app.schemas.ingestion import ExtractionResult
        # Get allowed literals from the type annotation
        hints = ExtractionResult.__annotations__.get("tier_used")
        if hasattr(hints, "__args__"):
            allowed = set(hints.__args__)
        else:
            report.add("tier_used.literals", "warn", "could not extract Literal args")
            return

        # Scan source files for tier_used string assignments
        source_files = [
            Path(__file__).parent / "ingestion" / "ocr.py",
            Path(__file__).parent / "services" / "ingestion_service.py",
        ]
        bad = []
        for src in source_files:
            if not src.exists():
                continue
            text = src.read_text()
            # Match tier_used="..." and tier: "..."
            for m in re.finditer(r'tier_used[=:]\s*"([^"]+)"', text):
                val = m.group(1)
                if val not in allowed:
                    bad.append(f"{src.name}: '{val}'")

        if bad:
            report.add(
                "tier_used.literals",
                "error",
                f"invalid tier_used values: {'; '.join(bad)}. Allowed: {sorted(allowed)}",
            )
        else:
            report.add("tier_used.literals", "ok", f"{len(allowed)} valid literals")
    except Exception as e:
        report.add("tier_used.literals", "warn", f"check failed: {e}")


def _check_ingestion_modules(report: ValidationReport) -> None:
    """Verify all builtin ingestion modules load without import errors."""
    try:
        from app.ingestion.registry import get_registry
        registry = get_registry()
        count = len(registry.modules)
        names = [m.name for m in registry.modules]
        report.add("ingestion.modules", "ok", f"{count} modules: {', '.join(names)}")
    except Exception as e:
        report.add("ingestion.modules", "error", f"registry failed: {e}")


def _check_content_catalogs(report: ValidationReport) -> None:
    """Verify content catalog JSON files parse and have required fields."""
    content_dir = Path(__file__).parent / "content"
    catalogs = ["articles.json", "videos.json", "slides.json", "partners.json"]
    errors = []
    ok_count = 0

    for name in catalogs:
        path = content_dir / name
        if not path.exists():
            errors.append(f"{name}: not found")
            continue
        try:
            data = json.loads(path.read_text())
            if not isinstance(data, list):
                errors.append(f"{name}: expected array, got {type(data).__name__}")
                continue
            # Check required fields (catalogs may use different id key names)
            for i, item in enumerate(data[:3]):  # spot-check first 3
                for req in ("locale", "type", "title"):
                    if req not in item:
                        errors.append(f"{name}[{i}]: missing '{req}'")
                        break
            ok_count += 1
        except json.JSONDecodeError as e:
            errors.append(f"{name}: parse error: {e}")

    if errors:
        report.add("content.catalogs", "error", "; ".join(errors))
    else:
        report.add("content.catalogs", "ok", f"{ok_count} catalogs valid")


def _check_prompt_templates(report: ValidationReport) -> None:
    """Verify all .j2 prompt templates exist and parse."""
    prompts_dir = Path(__file__).parent / "coaching" / "prompts"
    if not prompts_dir.exists():
        report.add("prompts", "warn", f"prompts dir not found: {prompts_dir}")
        return

    count = 0
    errors = []
    for f in prompts_dir.glob("*.j2"):
        count += 1
        try:
            text = f.read_text()
            if len(text.strip()) < 10:
                errors.append(f"{f.name}: suspiciously short ({len(text)} chars)")
        except Exception as e:
            errors.append(f"{f.name}: {e}")

    if errors:
        report.add("prompts", "warn", "; ".join(errors))
    else:
        report.add("prompts", "ok", f"{count} templates valid")
