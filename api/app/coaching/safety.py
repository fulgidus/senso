"""
SafetyScanner: implements hard-boundaries.yml groups for input and output scanning.

Phase 4: pattern-only matching. own_pii_unsolicited uses patterns only — live
userProfile cross-check deferred to Phase 7. Groups with no patterns[] are skipped.
"""

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger(__name__)

# Severity ordering: higher index = more severe
_SEVERITY_ORDER = ["censor", "warn", "block", "temp_ban", "hard_ban"]

PERSONAS_DIR = Path(__file__).parent.parent / "personas"


@dataclass
class ScanResult:
    safe: bool
    severity: Optional[str] = None
    group: Optional[str] = None
    reason: str = ""
    substitute_message: Optional[str] = None
    is_warn: bool = False  # True when severity=warn but response passes through


class SafetyScanner:
    """
    Loads hard-boundaries.yml and exposes scan_input / scan_output methods.
    Groups are evaluated in descending severity order (hard_ban first).
    Groups with no regex patterns are skipped (e.g. own_pii_unsolicited in Phase 4).
    """

    def __init__(self, boundaries_path: Optional[Path] = None) -> None:
        path = boundaries_path or PERSONAS_DIR / "hard-boundaries.yml"
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        self._groups = data.get("groups", [])
        # Pre-compile patterns, sorted by descending severity
        self._compiled: list[dict] = []
        for group in sorted(
            self._groups,
            key=lambda g: (
                _SEVERITY_ORDER.index(g.get("severity", "warn"))
                if g.get("severity") in _SEVERITY_ORDER
                else 0
            ),
            reverse=True,
        ):
            patterns = group.get("patterns", [])
            if not patterns:
                # Phase 4: skip groups with no regex patterns (e.g. own_pii_unsolicited)
                logger.debug(
                    "SafetyScanner: skipping group %s — no patterns defined (Phase 4)",
                    group.get("name"),
                )
                continue
            compiled_patterns = []
            for p in patterns:
                try:
                    compiled_patterns.append(re.compile(p, re.IGNORECASE))
                except re.error as exc:
                    logger.warning(
                        "SafetyScanner: invalid pattern %r in group %s: %s",
                        p,
                        group.get("name"),
                        exc,
                    )
            if compiled_patterns:
                self._compiled.append(
                    {
                        "name": group["name"],
                        "severity": group.get("severity", "warn"),
                        "scope": group.get("scope", "both"),
                        "substituteMessage": group.get("substituteMessage"),
                        "patterns": compiled_patterns,
                    }
                )

    def scan_input(self, text: str) -> ScanResult:
        """Scan user input. Returns safe=False for temp_ban/hard_ban matches."""
        return self._scan(text, scope_filter={"input", "both"}, is_output=False)

    def scan_output(self, text: str) -> ScanResult:
        """Scan LLM output. Returns safe=False for block/temp_ban/hard_ban matches."""
        return self._scan(text, scope_filter={"output", "both"}, is_output=True)

    def _scan(self, text: str, scope_filter: set, is_output: bool) -> ScanResult:
        for group in self._compiled:
            if group["scope"] not in scope_filter:
                continue
            severity = group["severity"]
            for pattern in group["patterns"]:
                if pattern.search(text):
                    sub = group["substituteMessage"]
                    logger.warning(
                        "SafetyScanner hit: group=%s severity=%s is_output=%s",
                        group["name"],
                        severity,
                        is_output,
                    )
                    if is_output:
                        # Output: block/temp_ban/hard_ban → unsafe; warn/censor → pass-through
                        if severity in ("block", "temp_ban", "hard_ban"):
                            return ScanResult(
                                safe=False,
                                severity=severity,
                                group=group["name"],
                                reason=f"Output blocked by group '{group['name']}' (severity={severity})",
                                substitute_message=sub,
                            )
                        else:  # warn or censor
                            return ScanResult(
                                safe=True,
                                severity=severity,
                                group=group["name"],
                                reason=f"Output flagged (severity={severity}) — passing through",
                                substitute_message=None,
                                is_warn=True,
                            )
                    else:
                        # Input: temp_ban/hard_ban → unsafe; block/warn/censor → warn only
                        if severity in ("temp_ban", "hard_ban"):
                            return ScanResult(
                                safe=False,
                                severity=severity,
                                group=group["name"],
                                reason=f"Input rejected by group '{group['name']}' (severity={severity})",
                                substitute_message=sub,
                            )
                        else:
                            return ScanResult(
                                safe=True,
                                severity=severity,
                                group=group["name"],
                                reason=f"Input flagged (severity={severity}) — allowing",
                                is_warn=True,
                            )
        return ScanResult(safe=True, reason="No safety violations detected")
