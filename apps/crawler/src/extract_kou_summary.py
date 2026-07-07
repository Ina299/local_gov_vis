#!/usr/bin/env python3
"""
東京都予算の項別総括表（ページ10-14）から項レベルデータを抽出
"""
import json
from pathlib import Path
import torch
from PIL import Image

MODEL_ID = "Qwen/Qwen2-VL-2B-Instruct"


def load_model():
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


def extract_from_page(model, processor, image_path: str) -> str:
    """ページから項データを抽出"""
    image = Image.open(image_path)

    prompt = """この表は東京都予算の「項別」一覧です。
表の各行から以下を読み取ってJSON配列で出力してください：
- 区分（項の名前）
- 令和6年度の予算額（千円）

左端の「区分」列の項目名と、「令和6年度」列の金額を抽出してください。
「人件費」「事業費」などの内訳列は無視してください。

出力形式:
```json
[
  {"項名": "都議会費", "予算額": 5419000},
  {"項名": "総務管理費", "予算額": 123456000}
]
```"""

    messages = [
        {"role": "system", "content": ""},
        {"role": "user", "content": [
            {"type": "image", "image": image_path},
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
    model, processor = load_model()

    image_dir = Path(__file__).parent.parent / "output" / "images"

    # 項別総括表のページ（10-14）
    pages = ["page_0010.png", "page_0011.png", "page_0012.png", "page_0013.png", "page_0014.png"]

    all_items = []
    seen_names = set()

    for page in pages:
        path = image_dir / page
        if not path.exists():
            continue

        print(f"\nProcessing: {page}")
        result = extract_from_page(model, processor, str(path))
        print(f"Raw: {result[:300]}...")

        items = parse_json(result)
        for item in items:
            name = item.get("項名", "")
            if name and name not in seen_names:
                seen_names.add(name)
                all_items.append(item)
                print(f"  + {name}: {item.get('予算額', 'N/A')}")

    # 保存
    output_dir = image_dir.parent / "extracted"
    output_dir.mkdir(exist_ok=True)

    with open(output_dir / "tokyo_kou_summary.json", "w", encoding="utf-8") as f:
        json.dump(all_items, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"Extracted {len(all_items)} 項 items")
    print(f"Saved to: {output_dir / 'tokyo_kou_summary.json'}")


if __name__ == "__main__":
    main()
