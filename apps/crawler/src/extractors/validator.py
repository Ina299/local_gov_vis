"""
Budget data validation module.
"""
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of budget validation."""
    valid: bool
    warnings: list[str]
    errors: list[str]
    suggested_unit: Optional[str] = None


# 都道府県の予算規模の目安（円）
# 人口規模別の一般会計予算の概算範囲
BUDGET_RANGES = {
    # 大規模（東京、大阪、神奈川、愛知）
    "large": (2_000_000_000_000, 10_000_000_000_000),  # 2兆〜10兆円
    # 中規模（北海道、福岡、埼玉、千葉など）
    "medium": (1_000_000_000_000, 4_000_000_000_000),  # 1兆〜4兆円
    # 小規模（鳥取、島根、高知など）
    "small": (300_000_000_000, 1_500_000_000_000),  # 3000億〜1.5兆円
}

# 都道府県コード→規模
PREFECTURE_SCALE = {
    "13": "large",   # 東京
    "27": "large",   # 大阪
    "14": "large",   # 神奈川
    "23": "large",   # 愛知
    "01": "medium",  # 北海道
    "40": "medium",  # 福岡
    "11": "medium",  # 埼玉
    "12": "medium",  # 千葉
    # その他はデフォルトで small
}

# 款別の予算構成比の目安（%）
CATEGORY_RATIO_RANGES = {
    "教育費": (10, 35),
    "福祉費": (5, 30),
    "民生費": (5, 30),
    "保健福祉費": (10, 40),
    "公債費": (5, 25),
    "警察費": (3, 15),
    "土木費": (5, 20),
    "建設費": (5, 20),
    "総務費": (3, 20),
}


def validate_budget(
    code: str,
    total_amount: int,
    categories: list[dict],
    unit: str = "千円"
) -> ValidationResult:
    """
    Validate extracted budget data.

    Args:
        code: Prefecture code
        total_amount: Total budget in yen
        categories: List of category dicts with 款名 and 予算額
        unit: Original unit of extracted data

    Returns:
        ValidationResult with warnings and errors
    """
    warnings = []
    errors = []
    suggested_unit = None

    # 1. 総額の範囲チェック
    scale = PREFECTURE_SCALE.get(code, "small")
    min_budget, max_budget = BUDGET_RANGES[scale]

    if total_amount < min_budget / 100:
        # 100分の1以下 → 単位が間違っている可能性
        errors.append(
            f"総額が小さすぎます: {total_amount:,}円 "
            f"(期待: {min_budget/1e12:.1f}〜{max_budget/1e12:.1f}兆円)"
        )
        # 単位修正の提案
        if unit == "千円" and total_amount * 1000 >= min_budget / 10:
            suggested_unit = "百万円"
            warnings.append(f"単位が「百万円」の可能性があります")
        elif unit == "百万円" and total_amount * 1000 >= min_budget / 10:
            suggested_unit = "十億円"

    elif total_amount < min_budget:
        warnings.append(
            f"総額が期待より小さい: {total_amount/1e12:.2f}兆円 "
            f"(期待: {min_budget/1e12:.1f}兆円以上)"
        )

    elif total_amount > max_budget:
        warnings.append(
            f"総額が期待より大きい: {total_amount/1e12:.2f}兆円 "
            f"(期待: {max_budget/1e12:.1f}兆円以下)"
        )

    # 2. カテゴリ数チェック
    if len(categories) < 5:
        warnings.append(f"カテゴリ数が少ない: {len(categories)}件 (通常10-20件)")
    elif len(categories) > 30:
        warnings.append(f"カテゴリ数が多い: {len(categories)}件 (重複の可能性)")

    # 3. 構成比チェック
    if total_amount > 0:
        for cat in categories:
            name = cat.get("款名", "")
            amount = cat.get("予算額", 0)

            # 単位変換
            if unit == "千円":
                amount_yen = amount * 1000
            elif unit == "百万円":
                amount_yen = amount * 1_000_000
            else:
                amount_yen = amount

            ratio = (amount_yen / total_amount) * 100

            # 既知のカテゴリの構成比チェック
            for cat_name, (min_ratio, max_ratio) in CATEGORY_RATIO_RANGES.items():
                if cat_name in name:
                    if ratio < min_ratio / 10:  # 期待の1/10以下
                        warnings.append(
                            f"{name}の構成比が小さい: {ratio:.1f}% "
                            f"(期待: {min_ratio}-{max_ratio}%)"
                        )
                    elif ratio > max_ratio * 2:  # 期待の2倍以上
                        warnings.append(
                            f"{name}の構成比が大きい: {ratio:.1f}% "
                            f"(期待: {min_ratio}-{max_ratio}%)"
                        )
                    break

    # 4. 合計値の整合性チェック
    category_sum = sum(
        cat.get("予算額", 0) for cat in categories
    )

    # 単位変換
    if unit == "千円":
        category_sum_yen = category_sum * 1000
    elif unit == "百万円":
        category_sum_yen = category_sum * 1_000_000
    else:
        category_sum_yen = category_sum

    if total_amount > 0:
        diff_ratio = abs(category_sum_yen - total_amount) / total_amount
        if diff_ratio > 0.1:  # 10%以上の差
            warnings.append(
                f"カテゴリ合計と総額に差があります: "
                f"合計{category_sum_yen/1e12:.2f}兆円 vs 総額{total_amount/1e12:.2f}兆円"
            )

    valid = len(errors) == 0
    return ValidationResult(
        valid=valid,
        warnings=warnings,
        errors=errors,
        suggested_unit=suggested_unit
    )


def estimate_unit(
    code: str,
    raw_total: int,
    current_unit: str
) -> tuple[str, int]:
    """
    Estimate the correct unit based on expected budget range.

    Args:
        code: Prefecture code
        raw_total: Raw total from extraction (before unit conversion)
        current_unit: Currently assumed unit

    Returns:
        Tuple of (suggested_unit, multiplier)
    """
    scale = PREFECTURE_SCALE.get(code, "small")
    min_budget, max_budget = BUDGET_RANGES[scale]

    # 現在の単位での変換後の値
    if current_unit == "千円":
        current_multiplier = 1000
    elif current_unit == "百万円":
        current_multiplier = 1_000_000
    else:
        current_multiplier = 1

    current_total = raw_total * current_multiplier

    # 範囲内ならそのまま
    if min_budget / 2 <= current_total <= max_budget * 2:
        return current_unit, current_multiplier

    # 単位を調整して範囲に収まるか試す
    for unit, mult in [("円", 1), ("千円", 1000), ("百万円", 1_000_000), ("十億円", 10_000_000_000)]:
        adjusted = raw_total * mult
        if min_budget / 2 <= adjusted <= max_budget * 2:
            logger.info(f"Unit adjusted: {current_unit} -> {unit}")
            return unit, mult

    # どれも合わない場合は元のまま
    return current_unit, current_multiplier
