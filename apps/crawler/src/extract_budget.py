#!/usr/bin/env python3
"""
東京都予算説明書PDFから項レベルの予算データを抽出するスクリプト
"""
import os
import sys
from pathlib import Path

# Poppler path
POPPLER_PATH = Path(__file__).parent.parent.parent.parent / "tools" / "poppler-24.08.0" / "Library" / "bin"

def convert_pdf_to_images(pdf_path: str, output_dir: str, pages: list[int] = None, dpi: int = 150):
    """PDFを画像に変換"""
    from pdf2image import convert_from_path

    os.makedirs(output_dir, exist_ok=True)

    if pages:
        images = []
        for page_num in pages:
            page_images = convert_from_path(
                pdf_path,
                dpi=dpi,
                first_page=page_num,
                last_page=page_num,
                poppler_path=str(POPPLER_PATH)
            )
            images.extend(page_images)
    else:
        images = convert_from_path(pdf_path, dpi=dpi, poppler_path=str(POPPLER_PATH))

    saved_paths = []
    for i, image in enumerate(images):
        page_num = pages[i] if pages else i + 1
        output_path = os.path.join(output_dir, f"page_{page_num:04d}.png")
        image.save(output_path, "PNG")
        saved_paths.append(output_path)
        print(f"Saved: {output_path}")

    return saved_paths


def get_pdf_page_count(pdf_path: str) -> int:
    """PDFのページ数を取得"""
    from pdf2image import pdfinfo_from_path
    info = pdfinfo_from_path(pdf_path, poppler_path=str(POPPLER_PATH))
    return info["Pages"]


if __name__ == "__main__":
    pdf_path = Path(__file__).parent.parent / "output" / "tokyo_budget_detail.pdf"
    output_dir = Path(__file__).parent.parent / "output" / "images"

    print(f"PDF: {pdf_path}")
    print(f"Poppler: {POPPLER_PATH}")

    # ページ数確認
    page_count = get_pdf_page_count(str(pdf_path))
    print(f"Total pages: {page_count}")

    # 各款の開始ページ（目次に基づく）
    # 第1款 議会費: 116
    # 第2款 総務費: 118
    # 第3款 徴税費: 144
    # 第4款 生活文化スポーツ費: 150
    # 第5款 都市整備費: 176
    # 第6款 環境費: 172
    # 第7款 福祉費: 190
    # 第8款 保健医療費: 214
    # 第9款 産業労働費: 226
    # 第10款 土木費: 236
    # 第11款 港湾費: 270
    # 第12款 教育費: 280
    # 第13款 警視庁: 294
    # 第14款 警察費: 314
    # 第15款 消防費: 360
    # 第16款 公債費: 366
    # 第17款 諸支出金: 368
    # 第18款 予備費: 370

    kan_start_pages = [
        116, 117,  # 議会費
        118, 119,  # 総務費
        144, 145,  # 徴税費
        150, 151,  # 生活文化スポーツ費
        172, 173,  # 環境費
        176, 177,  # 都市整備費
        190, 191,  # 福祉費
        214, 215,  # 保健医療費
        226, 227,  # 産業労働費
        236, 237,  # 土木費
        270, 271,  # 港湾費
        280, 281,  # 教育費
        294, 295,  # 警視庁
        314, 315,  # 警察費
        360, 361,  # 消防費
        366, 367,  # 公債費
        368, 369,  # 諸支出金
        370,       # 予備費
    ]

    print(f"\nConverting {len(kan_start_pages)} pages for 款 summaries")

    saved = convert_pdf_to_images(str(pdf_path), str(output_dir), pages=kan_start_pages)
    print(f"\nConverted {len(saved)} pages")
