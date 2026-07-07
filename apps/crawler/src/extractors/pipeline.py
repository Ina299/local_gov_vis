"""
Extraction pipeline orchestrator.
"""
import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

from .config import Config, PrefectureConfig
from .pdf import PDFConverter
from .vlm import VLMExtractor, BudgetItem
from .validator import validate_budget, estimate_unit

logger = logging.getLogger(__name__)


@dataclass
class ExtractionResult:
    """Result of budget extraction for a prefecture."""
    prefecture: str
    code: str
    source_url: str
    fiscal_year: int
    unit: str
    categories: list[dict] = field(default_factory=list)
    extracted_at: str = ""
    success: bool = True
    error: Optional[str] = None
    validation_warnings: list[str] = field(default_factory=list)
    validation_errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        result = {
            "prefecture": self.prefecture,
            "code": self.code,
            "source_url": self.source_url,
            "fiscal_year": self.fiscal_year,
            "unit": self.unit,
            "categories": self.categories,
            "extracted_at": self.extracted_at,
        }
        if self.validation_warnings:
            result["validation_warnings"] = self.validation_warnings
        if self.validation_errors:
            result["validation_errors"] = self.validation_errors
        return result


class ExtractionPipeline:
    """
    Orchestrates the full extraction pipeline:
    1. Download PDF
    2. Convert to images
    3. Extract budget data using VLM
    4. Save results
    """

    def __init__(
        self,
        config: Optional[Config] = None,
        output_dir: Optional[Path] = None
    ):
        self.config = config or Config.load()
        self.output_dir = output_dir or Path(__file__).parent.parent.parent / "output" / "prefectures"

        self.pdf_converter = PDFConverter()
        self.vlm_extractor: Optional[VLMExtractor] = None

    def _get_vlm(self, model_id: str) -> VLMExtractor:
        """Get or create VLM extractor."""
        if self.vlm_extractor is None or self.vlm_extractor.model_id != model_id:
            if self.vlm_extractor is not None:
                self.vlm_extractor.unload_model()
            self.vlm_extractor = VLMExtractor(model_id)
        return self.vlm_extractor

    def extract_prefecture(
        self,
        pref_config: PrefectureConfig,
        force_download: bool = False,
        force_convert: bool = False
    ) -> ExtractionResult:
        """
        Extract budget data for a single prefecture.

        Args:
            pref_config: Prefecture configuration
            force_download: Force re-download of PDF
            force_convert: Force re-conversion of images

        Returns:
            ExtractionResult with extracted data
        """
        logger.info(f"Processing: {pref_config.name} ({pref_config.code})")

        pref_dir = self.output_dir / pref_config.key
        pref_dir.mkdir(parents=True, exist_ok=True)

        # Step 1: Download PDF
        pdf_path = pref_dir / "budget.pdf"
        if force_download and pdf_path.exists():
            pdf_path.unlink()

        if not self.pdf_converter.download(pref_config.pdf_url, pdf_path):
            return ExtractionResult(
                prefecture=pref_config.name,
                code=pref_config.code,
                source_url=pref_config.pdf_url,
                fiscal_year=pref_config.fiscal_year,
                unit=pref_config.unit,
                success=False,
                error="Failed to download PDF"
            )

        # Step 2: Convert to images
        images_dir = pref_dir / "images"
        image_paths = self.pdf_converter.convert_to_images(
            pdf_path,
            images_dir,
            pref_config.pages,
            dpi=pref_config.dpi,
            force=force_convert
        )

        if not image_paths:
            return ExtractionResult(
                prefecture=pref_config.name,
                code=pref_config.code,
                source_url=pref_config.pdf_url,
                fiscal_year=pref_config.fiscal_year,
                unit=pref_config.unit,
                success=False,
                error="No images converted"
            )

        # Step 3: Extract using VLM
        vlm = self._get_vlm(pref_config.model)
        prompt = self.config.get_prompt("budget_extraction")

        extracted_items: list[BudgetItem] = []
        seen_names: set[str] = set()

        for image_path in image_paths:
            logger.info(f"Extracting from: {image_path.name}")

            items = vlm.extract_budget_items(
                image_path, prompt, crop_right=pref_config.crop_right
            )

            for item in items:
                if item.category_name and item.category_name not in seen_names:
                    seen_names.add(item.category_name)
                    extracted_items.append(item)
                    logger.debug(f"  + {item.category_name}: {item.amount}")

        # Convert to output format
        categories = [
            {
                "款番号": item.category_id,
                "款名": item.category_name,
                "予算額": item.amount,
            }
            for item in extracted_items
        ]

        # Calculate raw total and validate
        raw_total = sum(item.amount for item in extracted_items)
        unit = pref_config.unit

        # Auto-estimate unit if it seems wrong
        suggested_unit, multiplier = estimate_unit(pref_config.code, raw_total, unit)
        if suggested_unit != unit:
            logger.warning(f"Unit auto-corrected: {unit} -> {suggested_unit}")
            unit = suggested_unit

        # Convert to yen for validation
        total_yen = raw_total * multiplier

        # Validate
        validation = validate_budget(
            pref_config.code,
            total_yen,
            categories,
            unit
        )

        if validation.errors:
            for err in validation.errors:
                logger.error(f"Validation error: {err}")
        if validation.warnings:
            for warn in validation.warnings:
                logger.warning(f"Validation warning: {warn}")

        result = ExtractionResult(
            prefecture=pref_config.name,
            code=pref_config.code,
            source_url=pref_config.pdf_url,
            fiscal_year=pref_config.fiscal_year,
            unit=unit,
            categories=categories,
            extracted_at=datetime.now().isoformat(),
            success=True,
            validation_warnings=validation.warnings,
            validation_errors=validation.errors,
        )

        # Save result
        output_file = pref_dir / "budget_data.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(result.to_dict(), f, ensure_ascii=False, indent=2)

        logger.info(f"Saved: {output_file} ({len(categories)} categories)")
        return result

    def extract_all(
        self,
        prefectures: Optional[list[str]] = None,
        force_download: bool = False,
        force_convert: bool = False
    ) -> dict[str, ExtractionResult]:
        """
        Extract budget data for multiple prefectures.

        Args:
            prefectures: List of prefecture keys to process (None = all)
            force_download: Force re-download of PDFs
            force_convert: Force re-conversion of images

        Returns:
            Dictionary of prefecture code -> ExtractionResult
        """
        if prefectures is None:
            prefectures = self.config.list_prefectures()

        results = {}

        for pref_key in prefectures:
            pref_config = self.config.get_prefecture(pref_key)
            if pref_config is None:
                logger.warning(f"Prefecture not found: {pref_key}")
                continue

            result = self.extract_prefecture(
                pref_config,
                force_download=force_download,
                force_convert=force_convert
            )
            results[pref_config.code] = result

        # Save combined results
        all_output = self.output_dir / "all_prefectures.json"
        combined = {
            code: result.to_dict()
            for code, result in results.items()
            if result.success
        }
        with open(all_output, "w", encoding="utf-8") as f:
            json.dump(combined, f, ensure_ascii=False, indent=2)

        logger.info(f"All results saved to: {all_output}")
        return results

    def cleanup(self) -> None:
        """Clean up resources."""
        if self.vlm_extractor is not None:
            self.vlm_extractor.unload_model()
