#!/usr/bin/env python3
"""
東京都予算PDFの詳細ページから項レベルの予算データをバッチ抽出
"""
import json
import tempfile
from pathlib import Path
import torch
from PIL import Image

print(f"PyTorch: {torch.__version__}")
print(f"CUDA: {torch.cuda.is_available()}")

MODEL_ID = "Qwen/Qwen2-VL-2B-Instruct"


def load_model():
    """モデルとプロセッサを読み込み"""
    from transformers import AutoProcessor, Qwen2VLForConditionalGeneration

    print(f"Loading model: {MODEL_ID}")

    processor = AutoProcessor.from_pretrained(MODEL_ID)
    model = Qwen2VLForConditionalGeneration.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16,
        device_map="auto",
    )

    print("Model loaded successfully")
    return model, processor


def extract_kou_data(model, processor, image_path: str) -> str:
    """詳細ページから項データを抽出"""
    image = Image.open(image_path)

    prompt = """この予算書のページを読み、以下を抽出してください:

1. ページ下部に「第○○款 ○○費」と記載されている款の名前
2. 表の左端にある「項」欄の番号と名前
3. 「本年度予算額」列の金額（千円単位）

注意:
- 「節」や「目」のような細かい費目は無視してください
- 「項」は2桁の番号（01, 02, 03など）で始まる行です
- 予算額は表の中央付近にある大きな金額です

JSON形式で出力:
```json
{
  "款名": "福祉費",
  "項目": [
    {"項番号": "03", "項名": "生活保護費", "予算額": 22374000}
  ]
}
```"""

    messages = [
        {"role": "system", "content": ""},
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image_path},
                {"type": "text", "text": prompt},
            ],
        }
    ]

    texts = [processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)]
    inputs = processor(text=texts, images=image, padding=True, return_tensors="pt")

    with torch.no_grad():
        device = next(model.parameters()).device
        inputs = inputs.to(device)
        input_len = inputs["input_ids"].shape[1]
        output_ids = model.generate(
            **inputs,
            max_new_tokens=2048,
            do_sample=False,
        )
        generated_ids = output_ids[:, input_len:]

    result = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
    return result


def parse_json_from_response(response: str) -> dict:
    """レスポンスからJSONを抽出"""
    import re
    # ```json ... ``` ブロックを探す
    match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    # 直接JSONとして解析を試みる
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        return None


def main():
    # モデルを読み込み
    model, processor = load_model()

    # 詳細ページの画像を処理
    image_dir = Path(__file__).parent.parent / "output" / "images"

    # 歳出予算の各款開始ページ
    # 目次とページ内容から特定した正しいページ番号
    detail_pages = [
        "page_0118.png",  # 第1款 議会費
        "page_0119.png",  # 第2款 総務費の開始
        "page_0144.png",  # 第3款 徴税費
        "page_0150.png",  # 第4款 生活文化スポーツ費
        "page_0172.png",  # 第5款 都市整備費
        "page_0176.png",  # 第6款 環境費
        "page_0190.png",  # 第7款 福祉費
        "page_0214.png",  # 第8款 保健医療費
        "page_0226.png",  # 第9款 産業労働費
        "page_0236.png",  # 第10款 土木費
        "page_0270.png",  # 第11款 港湾費
        "page_0280.png",  # 第12款 教育費
        "page_0294.png",  # 第13款 警視庁
        "page_0314.png",  # 第14款 警察費（学務費?）
        "page_0360.png",  # 第15款 消防費
        "page_0366.png",  # 第16款 公債費
        "page_0368.png",  # 第17款 諸支出金
        "page_0370.png",  # 第18款 予備費
    ]

    all_data = {}

    for page_name in detail_pages:
        image_path = image_dir / page_name
        if not image_path.exists():
            print(f"Skipping (not found): {page_name}")
            continue

        print(f"\n{'='*60}")
        print(f"Processing: {page_name}")
        print(f"{'='*60}")

        result = extract_kou_data(model, processor, str(image_path))
        print(f"Raw output: {result[:200]}...")

        parsed = parse_json_from_response(result)
        if parsed:
            kan_name = parsed.get("款名", "不明")
            items = parsed.get("項目", [])

            if kan_name not in all_data:
                all_data[kan_name] = {}

            # 項番号をキーにして重複を防ぐ
            for item in items:
                kou_num = item.get("項番号", "")
                if kou_num and kou_num not in all_data[kan_name]:
                    all_data[kan_name][kou_num] = item

            print(f"Extracted: {kan_name} with {len(items)} items")
        else:
            print(f"Failed to parse JSON from response")

    # 辞書形式からリスト形式に変換
    final_data = {}
    for kan_name, items_dict in all_data.items():
        final_data[kan_name] = list(items_dict.values())

    # 結果を保存
    output_dir = image_dir.parent / "extracted"
    output_dir.mkdir(exist_ok=True)
    output_file = output_dir / "tokyo_kou_budget.json"

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"All data saved to: {output_file}")
    print(f"{'='*60}")

    # サマリを表示
    for kan_name, items in final_data.items():
        total = sum(item.get("予算額", 0) for item in items if isinstance(item.get("予算額"), (int, float)))
        print(f"{kan_name}: {len(items)} 項, 計 {total:,} 千円")


if __name__ == "__main__":
    main()
