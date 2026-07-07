"""
PDF download and conversion utilities.
"""
import logging
from pathlib import Path
from typing import Optional
import requests

logger = logging.getLogger(__name__)

# Default Poppler path for Windows
DEFAULT_POPPLER_PATH = Path(__file__).parent.parent.parent.parent.parent / "tools" / "poppler-24.08.0" / "Library" / "bin"


class PDFConverter:
    """Handles PDF download and conversion to images."""

    def __init__(self, poppler_path: Optional[Path] = None):
        self.poppler_path = poppler_path or DEFAULT_POPPLER_PATH

    def download(self, url: str, output_path: Path, timeout: int = 120) -> bool:
        """
        Download PDF from URL.

        Args:
            url: PDF URL
            output_path: Path to save the PDF
            timeout: Request timeout in seconds

        Returns:
            True if successful, False otherwise
        """
        if output_path.exists():
            logger.info(f"PDF already exists: {output_path}")
            return True

        output_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Downloading PDF: {url}")
        try:
            response = requests.get(
                url,
                timeout=timeout,
                stream=True,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            response.raise_for_status()

            with open(output_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            size_mb = output_path.stat().st_size / 1024 / 1024
            logger.info(f"Downloaded: {output_path} ({size_mb:.1f}MB)")
            return True

        except requests.RequestException as e:
            logger.error(f"Failed to download PDF: {e}")
            return False

    def convert_to_images(
        self,
        pdf_path: Path,
        output_dir: Path,
        pages: list[int],
        dpi: int = 150,
        force: bool = False
    ) -> list[Path]:
        """
        Convert PDF pages to images.

        Args:
            pdf_path: Path to the PDF file
            output_dir: Directory to save images
            pages: List of page numbers (1-indexed)
            dpi: Image resolution
            force: Force regeneration even if images exist

        Returns:
            List of paths to generated images
        """
        from pdf2image import convert_from_path

        output_dir.mkdir(parents=True, exist_ok=True)
        saved_paths = []

        for page_num in pages:
            output_path = output_dir / f"page_{page_num:04d}.png"

            if output_path.exists() and not force:
                logger.debug(f"Image already exists: {output_path}")
                saved_paths.append(output_path)
                continue

            try:
                images = convert_from_path(
                    str(pdf_path),
                    dpi=dpi,
                    first_page=page_num,
                    last_page=page_num,
                    poppler_path=str(self.poppler_path) if self.poppler_path.exists() else None
                )

                if images:
                    images[0].save(str(output_path), "PNG")
                    logger.info(f"Converted page {page_num}: {output_path.name}")
                    saved_paths.append(output_path)

            except Exception as e:
                logger.error(f"Failed to convert page {page_num}: {e}")

        return saved_paths

    def get_page_count(self, pdf_path: Path) -> int:
        """Get the total number of pages in a PDF."""
        try:
            from pdf2image import pdfinfo_from_path
            info = pdfinfo_from_path(
                str(pdf_path),
                poppler_path=str(self.poppler_path) if self.poppler_path.exists() else None
            )
            return info.get("Pages", 0)
        except Exception as e:
            logger.error(f"Failed to get page count: {e}")
            return 0
