export interface CorrelationResult {
  coefficient: number | null;
  slope: number | null;
  intercept: number | null;
}

/**
 * Pearson の相関係数と最小二乗法の回帰直線を求める。
 * 同じ値しかない軸では相関・回帰を定義できないため null を返す。
 */
export function calculateCorrelation(
  points: ReadonlyArray<{ x: number; y: number }>
): CorrelationResult {
  if (points.length < 2) {
    return { coefficient: null, slope: null, intercept: null };
  }

  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;

  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }

  if (varianceX === 0 || varianceY === 0) {
    return { coefficient: null, slope: null, intercept: null };
  }

  const slope = covariance / varianceX;
  return {
    coefficient: covariance / Math.sqrt(varianceX * varianceY),
    slope,
    intercept: meanY - slope * meanX,
  };
}

export function correlationLabel(coefficient: number | null): string {
  if (coefficient === null) return '算出できません';
  const absolute = Math.abs(coefficient);
  const strength =
    absolute >= 0.7 ? '強い' : absolute >= 0.4 ? '中程度の' : absolute >= 0.2 ? '弱い' : 'ほぼない';
  if (strength === 'ほぼない') return 'ほぼ相関なし';
  return `${strength}${coefficient > 0 ? '正' : '負'}の相関`;
}
