#!/usr/bin/env python3
"""
Qwen2-VLを使って予算PDFの画像から項レベルのデータを抽出
"""
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


def extract_budget_data(model, processor, image_path: str, crop_right: bool = False) -> str:
    """画像から予算データを抽出"""
    import tempfile
    from PIL import Image as PILImage

    image = PILImage.open(image_path)
    use_path = image_path

    # 右半分だけを切り出す
    if crop_right:
        width, height = image.size
        image = image.crop((width // 2, 0, width, height))
        print(f"Cropped to right half: {image.size}")
        # 一時ファイルに保存
        temp_file = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        image.save(temp_file.name)
        use_path = temp_file.name

    prompt = """この表から全ての行を読み取ってください。
各行の区分番号、費目名（款名）、令和6年度の金額をJSON配列で出力してください。"""

    messages = [
        {"role": "system", "content": ""},
        {
            "role": "user",
            "content": [
                {"type": "image", "image": use_path},
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
        # Only decode newly generated tokens (not the input)
        generated_ids = output_ids[:, input_len:]

    result = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
    return result


def main():
    # モデルを読み込み
    model, processor = load_model()

    # テスト: 総括表ページを処理
    image_dir = Path(__file__).parent.parent / "output" / "images"
    test_image = image_dir / "page_0006.png"

    if not test_image.exists():
        print(f"Image not found: {test_image}")
        return

    print(f"\n{'='*60}")
    print(f"Processing: {test_image}")
    print(f"{'='*60}")

    # Qwen2-VLで抽出（右半分だけをクロップ）
    result = extract_budget_data(model, processor, str(test_image), crop_right=True)

    print("\n--- Extracted Data ---")
    print(result)

    # 結果を保存
    output_dir = image_dir.parent / "extracted"
    output_dir.mkdir(exist_ok=True)
    output_file = output_dir / f"{test_image.stem}_budget.txt"

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(result)

    print(f"\nSaved to: {output_file}")


if __name__ == "__main__":
    main()
