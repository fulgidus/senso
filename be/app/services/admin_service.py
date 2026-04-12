"""
AdminService: module listing, promotion, and source retrieval.
All methods require caller to have already verified is_admin=True.
"""

import logging
import shutil
from pathlib import Path

from app.ingestion.registry import MODULES_DIR, get_registry
from app.schemas.ingestion import ModuleInfo

logger = logging.getLogger(__name__)


class AdminService:
    def list_modules(self) -> list[ModuleInfo]:
        registry = get_registry()
        modules = []
        for entry in registry.get_all():
            modules.append(
                ModuleInfo(
                    name=entry.file_path.stem,
                    source=entry.source,
                    version=entry.version,
                    fingerprint=entry.fingerprint,
                    is_new=(entry.source == "generated"),
                )
            )
        return modules

    def promote_module(self, module_name: str) -> dict:
        registry = get_registry()
        # Find in generated/
        gen_path = MODULES_DIR / "generated" / f"{module_name}.py"
        if not gen_path.exists():
            raise ValueError(f"Module '{module_name}' not found in generated/")

        prom_path = MODULES_DIR / "promoted" / f"{module_name}.py"
        prom_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(gen_path), str(prom_path))

        # Re-register as promoted (D-20)
        registry.register_module(prom_path, "promoted")
        logger.info("Promoted module %s to promoted/", module_name)
        return {"promoted": True}

    def get_module_source(self, module_name: str) -> str:
        registry = get_registry()
        for entry in registry.get_all():
            if entry.file_path.stem == module_name:
                return entry.file_path.read_text()
        raise ValueError(f"Module '{module_name}' not found")
