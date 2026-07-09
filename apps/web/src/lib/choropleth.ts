import { metricCategory, metricDef, INDUSTRY_METRIC_NAMES, type MapMetricKey } from './metrics';
import { INDUSTRY_COLORS } from './industry';
import { EXPENDITURE_COLORS, REVENUE_COLORS } from './donut';

// 検証済みパレットのシーケンシャル（blue）ランプ: steps 100/250/400/550/700
export const SEQUENTIAL_BLUES = ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'];
export const SEQUENTIAL_REDS = ['#fcdcd3', '#f2a891', '#e06a4b', '#b03c22', '#6b1a0d'];
export const SEQUENTIAL_GREENS = ['#d3ecd6', '#96d1a0', '#4fa763', '#2c7241', '#123f20'];
// データなしはランプの色と絶対に紛れない原色ピンク（マゼンタ）で示す
export const NO_DATA_COLOR = '#ff00ff';

/** hexカラーを t (0〜1) だけ target 色へ寄せる */
function mixHex(hex: string, target: [number, number, number], t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) + (target[0] - ((n >> 16) & 255)) * t);
  const g = Math.round(((n >> 8) & 255) + (target[1] - ((n >> 8) & 255)) * t);
  const b = Math.round((n & 255) + (target[2] - (n & 255)) * t);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 基準色から5段階のシーケンシャルランプ（淡→濃）を生成する */
export function sequentialRamp(base: string): string[] {
  return [
    mixHex(base, [255, 255, 255], 0.78),
    mixHex(base, [255, 255, 255], 0.45),
    base,
    mixHex(base, [16, 16, 24], 0.3),
    mixHex(base, [16, 16, 24], 0.55),
  ];
}

const rampCache = new Map<string, string[]>();

/** 基準色からのランプをキャッシュ付きで返す */
function cachedRamp(base: string): string[] {
  let ramp = rampCache.get(base);
  if (!ramp) {
    ramp = sequentialRamp(base);
    rampCache.set(base, ramp);
  }
  return ramp;
}

// 平均所得の金色ランプ（豊かなほど濃い金）
export const SEQUENTIAL_GOLDS = sequentialRamp('#c9a227');

// インフラの茶色ランプ（土木・構造物の連想）
export const SEQUENTIAL_BROWNS = sequentialRamp('#a0632a');

// 指標カテゴリごとの色ランプ（歳入・歳出: 青 / 人口: 緑 / 財政指標: 赤で危機感を強調 /
// 平均所得: 金 / インフラ: 茶 / 業種割合・款・歳入項目: 円グラフの固定色と同じ色相の濃淡）
export function rampFor(metricKey: MapMetricKey): string[] {
  if (metricKey === 'avgIncome') return SEQUENTIAL_GOLDS;
  const industryName = INDUSTRY_METRIC_NAMES[metricKey];
  if (industryName) return cachedRamp(INDUSTRY_COLORS[industryName]);
  // 款・歳入項目の指標は収支サマリーのドーナツと同じ固定色の濃淡にする
  const item = metricDef(metricKey).budgetItem;
  if (item) {
    const base = (item.list === 'expenditures' ? EXPENDITURE_COLORS : REVENUE_COLORS)[item.name];
    if (base) return cachedRamp(base);
  }
  const category = metricCategory(metricKey);
  if (category === 'population') return SEQUENTIAL_GREENS;
  if (category === 'money') return SEQUENTIAL_BLUES;
  if (category === 'infra') return SEQUENTIAL_BROWNS;
  return SEQUENTIAL_REDS;
}

// 分位点ベースで階級の境界値を計算（5階級 → 境界4つ）。
// ゼロが多い指標などで分位点が重複する場合は境界を間引き、階級数を減らす
export function computeBreaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const quantiles = [0.2, 0.4, 0.6, 0.8].map((q) => {
    const pos = q * (sorted.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  });
  // 重複と最小値ちょうどの境界（空階級になる）を除く
  return Array.from(new Set(quantiles)).filter((b) => b > sorted[0]);
}

/** 階級数が5未満に縮退してもランプの明暗の幅を使い切るように色を選ぶ */
export function classColor(ramp: string[], classIndex: number, classCount: number): string {
  if (classCount <= 1) return ramp[Math.floor(ramp.length / 2)];
  return ramp[Math.round((classIndex * (ramp.length - 1)) / (classCount - 1))];
}

export function getClassColor(
  value: number | null,
  breaks: number[],
  invert: boolean,
  ramp: string[]
): string {
  if (value === null) return NO_DATA_COLOR;
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  const classCount = breaks.length + 1;
  return classColor(ramp, invert ? breaks.length - i : i, classCount);
}

// 増減数など符号付き指標の発散配色（マイナス: 赤の濃→淡 / プラス: 青の淡→濃）
export const DIVERGING_NEG = [SEQUENTIAL_REDS[4], SEQUENTIAL_REDS[2], SEQUENTIAL_REDS[0]];
export const DIVERGING_POS = [SEQUENTIAL_BLUES[0], SEQUENTIAL_BLUES[2], SEQUENTIAL_BLUES[4]];

export interface SignedBreaks {
  neg: number[]; // 負値内の分位境界（昇順）
  pos: number[]; // 正値内の分位境界（昇順）
}

/** 0を中心に、正負それぞれの内部で3分位の境界を計算する */
export function computeSignedBreaks(values: number[]): SignedBreaks {
  const tercileBreaks = (vals: number[]): number[] => {
    const sorted = [...vals].sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    const quantiles = [1 / 3, 2 / 3].map((q) => {
      const pos = q * (sorted.length - 1);
      const lo = Math.floor(pos);
      const hi = Math.ceil(pos);
      return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
    });
    return Array.from(new Set(quantiles)).filter((b) => b > sorted[0]);
  };
  return {
    neg: tercileBreaks(values.filter((v) => v < 0)),
    pos: tercileBreaks(values.filter((v) => v > 0)),
  };
}

export function getDivergingColor(value: number | null, breaks: SignedBreaks): string {
  if (value === null) return NO_DATA_COLOR;
  if (value < 0) {
    let i = 0;
    while (i < breaks.neg.length && value >= breaks.neg[i]) i++;
    return classColor(DIVERGING_NEG, i, breaks.neg.length + 1);
  }
  let i = 0;
  while (i < breaks.pos.length && value >= breaks.pos[i]) i++;
  return classColor(DIVERGING_POS, i, breaks.pos.length + 1);
}
