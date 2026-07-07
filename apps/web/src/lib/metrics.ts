import type { LocalGovBudget, MapScale } from '@/types/budget';
import { formatAmount } from './format';

/** 地図で色分けする指標 */
export type MapMetricKey =
  | 'expenditure'
  | 'revenue'
  | 'population'
  | 'fiscalIndex'
  | 'currentBalanceRatio'
  | 'debtServiceRatio'
  | 'futureBurdenRatio';

export interface MetricDef {
  key: MapMetricKey;
  label: string;
  /** money: 総額/一人当たり切替あり, index: 指数, ratio: 割合, population: 人数 */
  kind: 'money' | 'population' | 'index' | 'ratio';
  /** fiscalIndicators から引く場合の指標名 */
  indicatorName?: string;
  /** 補足説明（メニューに表示） */
  description?: string;
  /** 高いほど良い指標。色の濃淡を反転（低い＝悪い＝濃い）する */
  invertColor?: boolean;
}

export const METRICS: MetricDef[] = [
  { key: 'expenditure', label: '歳出', kind: 'money' },
  { key: 'revenue', label: '歳入', kind: 'money' },
  { key: 'population', label: '人口', kind: 'population' },
  {
    key: 'fiscalIndex',
    label: '財政力指数',
    kind: 'index',
    indicatorName: '財政力指数',
    description: '高いほど自主財源が豊か（1以上は交付税不交付）',
    invertColor: true,
  },
  {
    key: 'currentBalanceRatio',
    label: '経常収支比率',
    kind: 'ratio',
    indicatorName: '経常収支比率',
    description: '高いほど財政が硬直的',
  },
  {
    key: 'debtServiceRatio',
    label: '実質公債費比率',
    kind: 'ratio',
    indicatorName: '実質公債費比率',
    description: '高いほど借金返済の負担が重い',
  },
  {
    key: 'futureBurdenRatio',
    label: '将来負担比率',
    kind: 'ratio',
    indicatorName: '将来負担比率',
    description: '高いほど将来の負債負担が大きい',
  },
];

export function metricDef(key: MapMetricKey): MetricDef {
  return METRICS.find((m) => m.key === key) ?? METRICS[0];
}

/** 指標値を取得（データなしは null） */
export function metricValue(
  budget: LocalGovBudget | undefined,
  key: MapMetricKey,
  scale: MapScale
): number | null {
  if (!budget) return null;
  const def = metricDef(key);

  if (def.kind === 'money') {
    const amount = key === 'revenue' ? budget.totalRevenue : budget.totalExpenditure;
    if (scale === 'perCapita') {
      if (!budget.population) return null;
      return amount / budget.population;
    }
    return amount;
  }
  if (def.kind === 'population') {
    return budget.population ?? null;
  }
  const indicator = budget.fiscalIndicators?.find((i) => i.name === def.indicatorName);
  return indicator ? indicator.value : null;
}

/** 値の表示形式（ツールチップ・凡例） */
export function formatMetricValue(value: number, key: MapMetricKey): string {
  const def = metricDef(key);
  switch (def.kind) {
    case 'money':
      return formatAmount(value);
    case 'population':
      return value >= 10_000
        ? `${(value / 10_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}万人`
        : `${Math.round(value).toLocaleString()}人`;
    case 'index':
      return value.toFixed(2);
    case 'ratio':
      return `${(value * 100).toFixed(1)}%`;
  }
}

/** 指標の表示名（例: 歳出総額 / 一人当たり歳入 / 財政力指数） */
export function metricDisplayLabel(key: MapMetricKey, scale: MapScale): string {
  const def = metricDef(key);
  if (def.kind === 'money') {
    return scale === 'perCapita' ? `一人当たり${def.label}` : `${def.label}総額`;
  }
  return def.label;
}
