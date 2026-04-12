"""
Tests for the module registry (app.ingestion.registry).

Uses tmp_path to create isolated module dirs; patches MODULES_DIR to avoid
touching real builtin modules.
"""

import importlib
from pathlib import Path
from unittest.mock import patch

import pytest

from app.ingestion.registry import ModuleRegistry, MODULES_DIR


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _write_valid_module(dir_path: Path, name: str = "test_module") -> Path:
    """Write a minimal valid conversion module to dir_path."""
    py_file = dir_path / f"{name}.py"
    py_file.write_text(
        f"""
FINGERPRINT = ["test_keyword_unique_abc", "another_keyword_xyz"]
MODULE_VERSION = "1.0.0"

def extract(file_path):
    return {{
        "document_type": "unknown",
        "transactions": [],
        "currency": "EUR",
    }}
"""
    )
    return py_file


def _write_module_missing_fingerprint(dir_path: Path, name: str = "bad_module") -> Path:
    """Write a module that is missing FINGERPRINT - should be skipped."""
    py_file = dir_path / f"{name}.py"
    py_file.write_text(
        """
MODULE_VERSION = "1.0.0"

def extract(file_path):
    return {}
"""
    )
    return py_file


def _write_module_missing_version(dir_path: Path, name: str = "no_ver") -> Path:
    """Write a module missing MODULE_VERSION - should be skipped."""
    py_file = dir_path / f"{name}.py"
    py_file.write_text(
        """
FINGERPRINT = ["some_keyword"]

def extract(file_path):
    return {}
"""
    )
    return py_file


# ---------------------------------------------------------------------------
# Registry loading tests
# ---------------------------------------------------------------------------


def test_empty_modules_dir_loads_zero_modules(tmp_path):
    """Registry with empty directories loads 0 modules."""
    (tmp_path / "builtin").mkdir()
    (tmp_path / "generated").mkdir()
    (tmp_path / "promoted").mkdir()

    with patch("app.ingestion.registry.MODULES_DIR", tmp_path):
        registry = ModuleRegistry()

    assert len(registry.get_all()) == 0


def test_module_missing_fingerprint_is_skipped(tmp_path):
    """Module without FINGERPRINT attribute is skipped - no crash."""
    builtin_dir = tmp_path / "builtin"
    builtin_dir.mkdir(parents=True)
    _write_module_missing_fingerprint(builtin_dir)

    with patch("app.ingestion.registry.MODULES_DIR", tmp_path):
        registry = ModuleRegistry()

    assert len(registry.get_all()) == 0


def test_module_missing_version_is_skipped(tmp_path):
    """Module without MODULE_VERSION attribute is skipped - no crash."""
    builtin_dir = tmp_path / "builtin"
    builtin_dir.mkdir(parents=True)
    _write_module_missing_version(builtin_dir)

    with patch("app.ingestion.registry.MODULES_DIR", tmp_path):
        registry = ModuleRegistry()

    assert len(registry.get_all()) == 0


def test_valid_module_is_loaded(tmp_path):
    """Registry with one valid module file loads it successfully."""
    builtin_dir = tmp_path / "builtin"
    builtin_dir.mkdir(parents=True)
    _write_valid_module(builtin_dir)

    with patch("app.ingestion.registry.MODULES_DIR", tmp_path):
        registry = ModuleRegistry()

    modules = registry.get_all()
    assert len(modules) == 1
    assert modules[0].source == "builtin"
    assert modules[0].version == "1.0.0"
    assert "test_keyword_unique_abc" in modules[0].fingerprint


def test_module_from_generated_dir_has_source_generated(tmp_path):
    """Module in generated/ dir has source='generated'."""
    gen_dir = tmp_path / "generated"
    gen_dir.mkdir(parents=True)
    _write_valid_module(gen_dir, "gen_module")

    with patch("app.ingestion.registry.MODULES_DIR", tmp_path):
        registry = ModuleRegistry()

    modules = registry.get_all()
    assert len(modules) == 1
    assert modules[0].source == "generated"


def test_module_from_promoted_dir_has_source_promoted(tmp_path):
    """Module in promoted/ dir has source='promoted'."""
    prom_dir = tmp_path / "promoted"
    prom_dir.mkdir(parents=True)
    _write_valid_module(prom_dir, "prom_module")

    with patch("app.ingestion.registry.MODULES_DIR", tmp_path):
        registry = ModuleRegistry()

    modules = registry.get_all()
    assert len(modules) == 1
    assert modules[0].source == "promoted"


# ---------------------------------------------------------------------------
# Registry match tests
# ---------------------------------------------------------------------------


def test_match_returns_none_for_empty_registry(tmp_path):
    """match() returns (None, scan_text) when no modules are loaded."""
    (tmp_path / "builtin").mkdir()

    with patch("app.ingestion.registry.MODULES_DIR", tmp_path):
        registry = ModuleRegistry()

    module, scan_text = registry.match(tmp_path / "file.csv", "some content without keywords")
    assert module is None
    assert isinstance(scan_text, str)


def test_match_returns_module_for_matching_content(tmp_path):
    """match() returns the module when content contains fingerprint keywords."""
    builtin_dir = tmp_path / "builtin"
    builtin_dir.mkdir(parents=True)
    _write_valid_module(builtin_dir)

    with patch("app.ingestion.registry.MODULES_DIR", tmp_path):
        registry = ModuleRegistry()

    # Content with both fingerprint keywords
    module, scan_text = registry.match(
        tmp_path / "file.csv",
        content_preview="test_keyword_unique_abc\nanother_keyword_xyz\nsome other data",
    )
    assert module is not None
    assert module.source == "builtin"
    assert scan_text == "test_keyword_unique_abc\nanother_keyword_xyz\nsome other data"


def test_match_returns_none_for_non_matching_content(tmp_path):
    """match() returns (None, scan_text) when content does not match fingerprint."""
    builtin_dir = tmp_path / "builtin"
    builtin_dir.mkdir(parents=True)
    _write_valid_module(builtin_dir)

    with patch("app.ingestion.registry.MODULES_DIR", tmp_path):
        registry = ModuleRegistry()

    module, scan_text = registry.match(
        tmp_path / "file.csv",
        content_preview="completely unrelated content without the magic words",
    )
    assert module is None
    assert scan_text == "completely unrelated content without the magic words"


def test_register_module_adds_new_module(tmp_path):
    """register_module() dynamically adds a new module to the registry."""
    gen_dir = tmp_path / "generated"
    gen_dir.mkdir(parents=True)

    # Start with empty registry
    with patch("app.ingestion.registry.MODULES_DIR", tmp_path):
        registry = ModuleRegistry()
    assert len(registry.get_all()) == 0

    # Write and register a new module
    new_module = _write_valid_module(gen_dir, "dynamic_mod")
    with patch("app.ingestion.registry.MODULES_DIR", tmp_path):
        success = registry.register_module(new_module, "generated")

    assert success is True
    assert len(registry.get_all()) == 1


def test_underscored_files_are_skipped(tmp_path):
    """Files starting with underscore (like __init__.py) are not loaded."""
    builtin_dir = tmp_path / "builtin"
    builtin_dir.mkdir(parents=True)

    # Write an __init__.py that would crash if loaded
    init_file = builtin_dir / "__init__.py"
    init_file.write_text("")

    # Write a valid module too
    _write_valid_module(builtin_dir)

    with patch("app.ingestion.registry.MODULES_DIR", tmp_path):
        registry = ModuleRegistry()

    # Only the valid module (not __init__.py) should be loaded
    assert len(registry.get_all()) == 1
