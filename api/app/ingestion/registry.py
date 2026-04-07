"""
Module registry: discovers, validates, and matches conversion modules.
Scans builtin/, generated/, promoted/ at startup.
Modules failing validation are skipped with a warning - no crash.
"""

import importlib.util
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

MODULES_DIR = Path(__file__).parent / "modules"
FINGERPRINT_SCAN_BYTES = 4096
MATCH_THRESHOLD = 0.3  # minimum score to consider a match

# MIME types for XLSX files
_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@dataclass
class ModuleEntry:
    name: str
    source: str  # "builtin" | "generated" | "promoted"
    version: str
    fingerprint: list[str]
    extract_fn: Any  # callable
    file_path: Path
    mime_types: list[str] = field(default_factory=list)


def _extract_xlsx_text(file_path: Path, max_cells: int = 200) -> str:
    """Extract plain text from the first XLSX sheet for keyword fingerprinting.
    Returns empty string on any error (graceful fallback to adaptive pipeline)."""
    try:
        import openpyxl
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        sheet = wb.active
        if sheet is None:
            return ""
        parts: list[str] = []
        count = 0
        for row in sheet.iter_rows(values_only=True):
            for cell in row:
                if cell is not None:
                    parts.append(str(cell))
                    count += 1
                    if count >= max_cells:
                        break
            if count >= max_cells:
                break
        wb.close()
        return " ".join(parts)
    except Exception as exc:
        logger.debug("XLSX text extraction failed for %s: %s", file_path, exc)
        return ""


def _get_scan_text(file_path: Path, mime_type: str) -> str:
    """Return the text to use for keyword fingerprint scoring.

    - XLSX: extract cell text (ZIP bytes contain no readable keywords)
    - PDF / plain text / CSV: read first FINGERPRINT_SCAN_BYTES as UTF-8
    - Other binary: return empty string → falls through to adaptive pipeline
    """
    if mime_type == _XLSX_MIME or file_path.suffix.lower() in (".xlsx", ".xlsm"):
        return _extract_xlsx_text(file_path)
    try:
        return file_path.read_bytes()[:FINGERPRINT_SCAN_BYTES].decode(
            "utf-8", errors="ignore"
        )
    except Exception:
        return ""


class ModuleRegistry:
    def __init__(self) -> None:
        self.modules: list[ModuleEntry] = []
        self._load_all()

    def _load_all(self) -> None:
        for source in ("builtin", "generated", "promoted"):
            subdir = MODULES_DIR / source
            if not subdir.exists():
                continue
            for py_file in sorted(subdir.glob("*.py")):
                if py_file.name.startswith("_"):
                    continue
                self._try_load_module(py_file, source)

    def _try_load_module(self, py_file: Path, source: str) -> None:
        module_name = f"ingestion_module_{source}_{py_file.stem}"
        try:
            spec = importlib.util.spec_from_file_location(module_name, py_file)
            if spec is None or spec.loader is None:
                logger.warning("Cannot load %s: spec is None", py_file)
                return
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore

            fingerprint = getattr(mod, "FINGERPRINT", None)
            version = getattr(mod, "MODULE_VERSION", None)
            extract_fn = getattr(mod, "extract", None)
            mime_types = getattr(mod, "MIME_TYPES", [])

            if not isinstance(fingerprint, list) or not fingerprint:
                logger.warning("Skipping %s: FINGERPRINT missing or empty", py_file)
                return
            if not isinstance(version, str):
                logger.warning("Skipping %s: MODULE_VERSION missing", py_file)
                return
            if not callable(extract_fn):
                logger.warning("Skipping %s: extract() not callable", py_file)
                return

            self.modules.append(
                ModuleEntry(
                    name=mod.__name__ if hasattr(mod, "__name__") else py_file.stem,
                    source=source,
                    version=version,
                    fingerprint=fingerprint,
                    extract_fn=extract_fn,
                    file_path=py_file,
                    mime_types=mime_types if isinstance(mime_types, list) else [],
                )
            )
            logger.info("Loaded module %s from %s", py_file.stem, source)
        except Exception as exc:
            logger.warning("Failed to load module %s: %s", py_file, exc)

    def match(
        self, file_path: Path, content_preview: str = "", mime_type: str = ""
    ) -> ModuleEntry | None:
        """
        Two-step match:
        1. MIME-type pre-filter: skip modules whose MIME_TYPES list excludes this file
        2. Content fingerprint scoring: keywords matched in scan text
           - XLSX: cell text extracted from workbook (not ZIP bytes)
           - Other: first 4KB as UTF-8
        Returns best match above MATCH_THRESHOLD, or None.
        """
        # Get scan text (XLSX-aware)
        if not content_preview:
            scan_text = _get_scan_text(file_path, mime_type)
        else:
            scan_text = content_preview

        content_lower = scan_text.lower()
        best_score = 0.0
        best_module: ModuleEntry | None = None

        for entry in self.modules:
            # MIME pre-filter: if the module declares MIME_TYPES, skip if no match
            if entry.mime_types and mime_type and mime_type not in entry.mime_types:
                continue

            if not entry.fingerprint:
                continue
            matched = sum(1 for kw in entry.fingerprint if kw.lower() in content_lower)
            score = matched / len(entry.fingerprint)
            # GenericCSV has a floor score override (D-27)
            if entry.file_path.stem == "generic_csv":
                score = min(score, 0.1)
            if score > best_score and score >= MATCH_THRESHOLD:
                best_score = score
                best_module = entry

        return best_module

    def register_module(self, py_file: Path, source: str) -> bool:
        """Dynamically register a newly written module. Returns True on success."""
        initial_count = len(self.modules)
        self._try_load_module(py_file, source)
        return len(self.modules) > initial_count

    def get_all(self) -> list[ModuleEntry]:
        return list(self.modules)


# Singleton registry - initialized at module import time
_registry: ModuleRegistry | None = None


def get_registry() -> ModuleRegistry:
    global _registry
    if _registry is None:
        _registry = ModuleRegistry()
    return _registry
