"""
Configuration loader for prefecture extraction settings.
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import yaml


@dataclass
class PrefectureConfig:
    """Configuration for a single prefecture."""
    key: str
    name: str
    code: str
    pdf_url: str
    pages: list[int]
    notes: str = ""
    enabled: bool = True
    dpi: int = 150
    model: str = "Qwen/Qwen2-VL-2B-Instruct"
    fiscal_year: int = 2024
    unit: str = "千円"
    crop_right: bool = False  # Crop to right half (for 歳出 in combined tables)


@dataclass
class Config:
    """Main configuration container."""
    prefectures: dict[str, PrefectureConfig] = field(default_factory=dict)
    prompts: dict[str, str] = field(default_factory=dict)
    category_mapping: dict[str, str] = field(default_factory=dict)
    defaults: dict = field(default_factory=dict)

    _config_path: Optional[Path] = field(default=None, repr=False)

    @classmethod
    def load(cls, config_path: Optional[Path] = None) -> "Config":
        """Load configuration from YAML file."""
        if config_path is None:
            config_path = Path(__file__).parent.parent.parent / "config" / "prefectures.yaml"

        if not config_path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")

        with open(config_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        defaults = data.get("defaults", {})
        prefectures = {}

        for key, pref_data in data.get("prefectures", {}).items():
            if not pref_data.get("enabled", True):
                continue
            if not pref_data.get("pdf_url"):
                continue

            prefectures[key] = PrefectureConfig(
                key=key,
                name=pref_data["name"],
                code=pref_data["code"],
                pdf_url=pref_data["pdf_url"],
                pages=pref_data.get("pages", []),
                notes=pref_data.get("notes", ""),
                enabled=pref_data.get("enabled", True),
                dpi=pref_data.get("dpi", defaults.get("dpi", 150)),
                model=pref_data.get("model", defaults.get("model", "Qwen/Qwen2-VL-2B-Instruct")),
                fiscal_year=pref_data.get("fiscal_year", defaults.get("fiscal_year", 2024)),
                unit=pref_data.get("unit", defaults.get("unit", "千円")),
                crop_right=pref_data.get("crop_right", False),
            )

        return cls(
            prefectures=prefectures,
            prompts=data.get("prompts", {}),
            category_mapping=data.get("category_mapping", {}),
            defaults=defaults,
            _config_path=config_path,
        )

    def get_prefecture(self, key: str) -> Optional[PrefectureConfig]:
        """Get a prefecture config by key or code."""
        if key in self.prefectures:
            return self.prefectures[key]
        # Try to find by code
        for pref in self.prefectures.values():
            if pref.code == key:
                return pref
        return None

    def list_prefectures(self) -> list[str]:
        """List all enabled prefecture keys."""
        return list(self.prefectures.keys())

    def get_prompt(self, name: str) -> str:
        """Get a prompt by name."""
        return self.prompts.get(name, "")

    def get_category(self, name: str) -> str:
        """Get category for a budget item name."""
        return self.category_mapping.get(name, "other")
