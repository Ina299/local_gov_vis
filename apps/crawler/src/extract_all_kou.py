#!/usr/bin/env python3
"""
東京都予算の全款から項データを抽出
各款の詳細ページを処理
"""
import json
import re
from pathlib import Path
import torch
from PIL import Image

MODEL_ID = "Qwen/Qwen2-VL-2B-Instruct"

# 款と対応するページ範囲
KAN_PAGES = {
    "01_議会費": [118],
    "02_総務費": [119, 144],  # 144は退職費を含む
    "03_徴税費": [145],
    "04_生活文化スポーツ費": [150, 151],
    "05_都市整備費": [172, 173],
    "06_環境費": [176, 177],
    "07_福祉費": [186, 187, 188, 190, 191],
    "08_保健医療費": [214, 215],
    "09_産業労働費": [226, 227],
    "10_土木費": [234, 235, 236, 237],
    "11_港湾費": [270, 271],
    "12_教育費": [280, 281],
    "13_学務費": [294, 295],  # 警視庁かも
    "14_警察費": [314, 315],
    "15_消防費": [360, 361],
    "16_公債費": [366, 367],
    "17_諸支出金": [368, 369],
    "18_予備費": [370],
}


def load_model():
    from transformers import AutoProcessor, Qwen2VLForConditionalGeneration
    print(f"Loading: {MODEL_ID}")
    processor = AutoProcessor.from_pretrained(MODEL_ID)
    model = Qwen2VLForConditionalGeneration.from_pretrained(
        MODEL_ID, torch_dtype=torch.float16, device_map="auto"
    )
    return model, processor


def extract_kou(model, processor, image_path: str, kan_name: str) -> list:
    """ページから項データを抽出"""
    image = Image.open(image_path)

    prompt = f"""この予算書ページは「{kan_name}」の詳細です。

表の左側にある「項」の行を探してください。
項は2桁の番号（01, 02, 03...）で始まり、その右に項の名前と予算額があります。

款や目ではなく、「項」レベルの行だけを抽出してください。
項の番号、名前、本年度予算額（千円）をJSON配列で出力してください。

```json
[
  {{"項番号": "01", "項名": "○○費", "予算額": 12345000}}
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
        output_ids = model.generate(**inputs, max_new_tokens=2048, do_sample=False)
        generated_ids = output_ids[:, input_len:]

    result = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

    # JSONを抽出
    match = re.search(r'```json\s*(.*?)\s*```', result, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except:
            pass
    try:
        return json.loads(result)
    except:
        return []


def main():
    model, processor = load_model()
    image_dir = Path(__file__).parent.parent / "output" / "images"

    all_kan_data = {}

    for kan_key, pages in KAN_PAGES.items():
        kan_id, kan_name = kan_key.split("_", 1)
        print(f"\n{'='*50}")
        print(f"款{kan_id}: {kan_name}")
        print(f"{'='*50}")

        kou_items = {}

        for page_num in pages:
            image_path = image_dir / f"page_{page_num:04d}.png"
            if not image_path.exists():
                print(f"  Skip: page_{page_num:04d}.png not found")
                continue

            print(f"  Processing page {page_num}...")
            items = extract_kou(model, processor, str(image_path), kan_name)

            for item in items:
                kou_num = item.get("項番号", "")
                if kou_num and kou_num not in kou_items:
                    kou_items[kou_num] = item
                    print(f"    + 項{kou_num}: {item.get('項名', '?')} = {item.get('予算額', '?'):,}")

        all_kan_data[kan_key] = {
            "款番号": kan_id,
            "款名": kan_name,
            "項目": list(kou_items.values())
        }

    # 保存
    output_dir = image_dir.parent / "extracted"
    output_file = output_dir / "tokyo_all_kou.json"

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_kan_data, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*50}")
    print(f"Saved to: {output_file}")

    # サマリ
    total_kou = sum(len(v["項目"]) for v in all_kan_data.values())
    print(f"Total: {len(all_kan_data)} 款, {total_kou} 項")


if __name__ == "__main__":
    main()
