#!/usr/bin/env python3
"""
複数の都道府県予算PDFから款・項データを抽出
"""
import json
import os
import requests
from pathlib import Path
from urllib.parse import urljoin
import torch
from PIL import Image

# Poppler path
POPPLER_PATH = Path(__file__).parent.parent.parent.parent / "tools" / "poppler-24.08.0" / "Library" / "bin"

# 抽出対象の都道府県とPDF URL
PREFECTURES = {
    "27_osaka": {
        "name": "大阪府",
        "code": "27",
        "pdf_url": "https://www.pref.osaka.lg.jp/documents/13257/r06_yosansyo_ippan.pdf",
        "summary_pages": [6, 7, 8, 9, 10],  # 款項別総括表のページ（推定）
    },
    "14_kanagawa": {
        "name": "神奈川県",
        "code": "14",
        "pdf_url": "https://www.pref.kanagawa.jp/documents/3847/00_6nendoyosanan_sankou.pdf",
        "summary_pages": [4, 5, 6, 7, 8],
    },
}

MODEL_ID = "Qwen/Qwen2-VL-2B-Instruct"


def download_pdf(url: str, output_path: Path) -> bool:
    """PDFをダウンロード"""
    if output_path.exists():
        print(f"Already exists: {output_path}")
        return True

    print(f"Downloading: {url}")
    try:
        response = requests.get(url, timeout=60, stream=True)
        response.raise_for_status()

        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        print(f"Saved: {output_path} ({output_path.stat().st_size / 1024 / 1024:.1f}MB)")
        return True
    except Exception as e:
        print(f"Failed to download: {e}")
        return False


def convert_pdf_to_images(pdf_path: Path, output_dir: Path, pages: list[int], dpi: int = 150) -> list[Path]:
    """PDFを画像に変換"""
    from pdf2image import convert_from_path

    output_dir.mkdir(parents=True, exist_ok=True)
    saved_paths = []

    for page_num in pages:
        output_path = output_dir / f"page_{page_num:04d}.png"
        if output_path.exists():
            print(f"Already exists: {output_path}")
            saved_paths.append(output_path)
            continue

        try:
            images = convert_from_path(
                str(pdf_path),
                dpi=dpi,
                first_page=page_num,
                last_page=page_num,
                poppler_path=str(POPPLER_PATH)
            )
            if images:
                images[0].save(str(output_path), "PNG")
                print(f"Converted: {output_path}")
                saved_paths.append(output_path)
        except Exception as e:
            print(f"Failed to convert page {page_num}: {e}")

    return saved_paths


def load_model():
    """VLMモデルを読み込み"""
    from transformers import AutoProcessor, Qwen2VLForConditionalGeneration

    print(f"Loading model: {MODEL_ID}")
    processor = AutoProcessor.from_pretrained(MODEL_ID)
    model = Qwen2VLForConditionalGeneration.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16,
        device_map="auto",
    )
    print("Model loaded")
    return model, processor


def extract_budget_data(model, processor, image_path: Path, crop_right: bool = False) -> str:
    """画像から予算データを抽出"""
    image = Image.open(image_path)

    # 右半分をクロップ（歳出部分）
    if crop_right:
        width, height = image.size
        image = image.crop((width // 2, 0, width, height))

    prompt = """この表から歳出予算の款別データを読み取ってください。
各行の款番号、款名、本年度予算額（千円または百万円）をJSON配列で出力してください。

出力形式:
```json
[
  {"款番号": "01", "款名": "議会費", "予算額": 5419000},
  {"款番号": "02", "款名": "総務費", "予算額": 123456000}
]
```"""

    messages = [
        {"role": "system", "content": ""},
        {"role": "user", "content": [
            {"type": "image", "image": str(image_path)},
            {"type": "text", "text": prompt},
        ]},
    ]

    texts = [processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)]
    inputs = processor(text=texts, images=image, padding=True, return_tensors="pt")

    with torch.no_grad():
        device = next(model.parameters()).device
        inputs = inputs.to(device)
        input_len = inputs["input_ids"].shape[1]
        output_ids = model.generate(**inputs, max_new_tokens=4096, do_sample=False)
        generated_ids = output_ids[:, input_len:]

    return processor.batch_decode(generated_ids, skip_special_tokens=True)[0]


def parse_json(response: str) -> list:
    """レスポンスからJSONを抽出"""
    import re
    match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except:
            pass
    try:
        return json.loads(response)
    except:
        return []


def main():
    base_dir = Path(__file__).parent.parent / "output" / "prefectures"
    base_dir.mkdir(parents=True, exist_ok=True)

    # モデルを読み込み
    model, processor = load_model()

    all_results = {}

    for pref_key, pref_info in PREFECTURES.items():
        print(f"\n{'='*60}")
        print(f"Processing: {pref_info['name']} ({pref_info['code']})")
        print(f"{'='*60}")

        pref_dir = base_dir / pref_key
        pref_dir.mkdir(exist_ok=True)

        # PDFをダウンロード
        pdf_path = pref_dir / "budget.pdf"
        if not download_pdf(pref_info["pdf_url"], pdf_path):
            continue

        # 画像に変換
        images_dir = pref_dir / "images"
        image_paths = convert_pdf_to_images(pdf_path, images_dir, pref_info["summary_pages"])

        if not image_paths:
            print("No images converted")
            continue

        # VLMで抽出
        extracted_items = []
        seen_names = set()

        for image_path in image_paths:
            print(f"\nExtracting from: {image_path.name}")

            # 通常抽出
            result = extract_budget_data(model, processor, image_path, crop_right=False)
            items = parse_json(result)

            for item in items:
                name = item.get("款名", "")
                if name and name not in seen_names:
                    seen_names.add(name)
                    extracted_items.append(item)
                    amount = item.get('予算額', 'N/A')
                    # Console encoding safe print
                    try:
                        print(f"  + {name}: {amount}")
                    except UnicodeEncodeError:
                        print(f"  + [extracted]: {amount}")

        # 結果を保存
        result_data = {
            "prefecture": pref_info["name"],
            "code": pref_info["code"],
            "source_url": pref_info["pdf_url"],
            "categories": extracted_items,
        }

        output_file = pref_dir / "budget_data.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2)

        all_results[pref_info["code"]] = result_data
        print(f"\nSaved: {output_file}")

    # 全結果を保存
    all_output = base_dir / "all_prefectures.json"
    with open(all_output, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"All results saved to: {all_output}")
    print(f"Processed {len(all_results)} prefectures")


if __name__ == "__main__":
    main()
