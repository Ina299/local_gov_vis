"""
Vision Language Model (VLM) based budget data extraction.
"""
import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import torch
from PIL import Image

logger = logging.getLogger(__name__)


@dataclass
class BudgetItem:
    """Extracted budget item."""
    category_id: str
    category_name: str
    amount: int
    subcategory_id: Optional[str] = None
    subcategory_name: Optional[str] = None


class VLMExtractor:
    """Extract budget data from images using Vision Language Models."""

    def __init__(self, model_id: str = "Qwen/Qwen2-VL-2B-Instruct"):
        self.model_id = model_id
        self.model = None
        self.processor = None
        self._loaded = False

    def load_model(self) -> None:
        """Load the VLM model and processor."""
        if self._loaded:
            return

        from transformers import AutoProcessor, Qwen2VLForConditionalGeneration

        logger.info(f"Loading VLM model: {self.model_id}")

        self.processor = AutoProcessor.from_pretrained(self.model_id)
        self.model = Qwen2VLForConditionalGeneration.from_pretrained(
            self.model_id,
            torch_dtype=torch.float16,
            device_map="auto",
        )

        self._loaded = True
        logger.info("VLM model loaded successfully")

    def unload_model(self) -> None:
        """Unload the model to free memory."""
        if self.model is not None:
            del self.model
            del self.processor
            self.model = None
            self.processor = None
            self._loaded = False
            torch.cuda.empty_cache()
            logger.info("VLM model unloaded")

    def extract_from_image(
        self,
        image_path: Path,
        prompt: str,
        crop_region: Optional[tuple[float, float, float, float]] = None,
        max_tokens: int = 4096
    ) -> str:
        """
        Extract text from an image using the VLM.

        Args:
            image_path: Path to the image file
            prompt: Extraction prompt
            crop_region: Optional (left, top, right, bottom) as ratios (0-1)
            max_tokens: Maximum tokens to generate

        Returns:
            Raw model response text
        """
        if not self._loaded:
            self.load_model()

        image = Image.open(image_path)

        # Apply crop if specified
        if crop_region:
            width, height = image.size
            left = int(width * crop_region[0])
            top = int(height * crop_region[1])
            right = int(width * crop_region[2])
            bottom = int(height * crop_region[3])
            image = image.crop((left, top, right, bottom))

        messages = [
            {"role": "system", "content": ""},
            {"role": "user", "content": [
                {"type": "image", "image": str(image_path)},
                {"type": "text", "text": prompt},
            ]},
        ]

        texts = [self.processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )]
        inputs = self.processor(
            text=texts, images=image, padding=True, return_tensors="pt"
        )

        with torch.no_grad():
            device = next(self.model.parameters()).device
            inputs = inputs.to(device)
            input_len = inputs["input_ids"].shape[1]

            output_ids = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                do_sample=False
            )
            generated_ids = output_ids[:, input_len:]

        return self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

    def extract_budget_items(
        self,
        image_path: Path,
        prompt: str,
        crop_right: bool = False
    ) -> list[BudgetItem]:
        """
        Extract budget items from an image.

        Args:
            image_path: Path to the image
            prompt: Extraction prompt
            crop_right: If True, only process right half of image

        Returns:
            List of extracted BudgetItem objects
        """
        crop_region = (0.5, 0, 1, 1) if crop_right else None

        response = self.extract_from_image(image_path, prompt, crop_region)
        items_data = self._parse_json_response(response)

        items = []
        for item in items_data:
            try:
                items.append(BudgetItem(
                    category_id=str(item.get("款番号", "")),
                    category_name=item.get("款名", ""),
                    amount=int(item.get("予算額", 0)),
                    subcategory_id=str(item.get("項番号", "")) if "項番号" in item else None,
                    subcategory_name=item.get("項名") if "項名" in item else None,
                ))
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse item: {item}, error: {e}")
                continue

        return items

    def _parse_json_response(self, response: str) -> list[dict]:
        """Parse JSON from model response."""
        # Try to extract JSON from markdown code block
        match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try to parse as raw JSON
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # Try to find array in response
        match = re.search(r'\[.*\]', response, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        logger.warning(f"Failed to parse JSON from response: {response[:200]}...")
        return []
