import type { LocalGovBudget, MapScale } from '@/types/budget';
import { formatAmount } from './format';

/** 地図で色分けする指標 */
export type MapMetricKey =
  | 'expenditure'
  | 'revenue'
  | 'population'
  | 'populationDensity'
  | 'elderlyRatio'
  | 'foreignRatio'
  | 'births'
  | 'populationChange'
  | 'foreignBirthRatio'
  | 'fiscalIndex'
  | 'currentBalanceRatio'
  | 'debtServiceRatio'
  | 'futureBurdenRatio';

/** ハンバーガーメニューで選ぶ表示カテゴリ */
export type MetricCategory = 'money' | 'population' | 'fiscal';

export interface MetricDef {
  key: MapMetricKey;
  label: string;
  /**
   * money: 総額/一人当たり切替あり, index: 指数, ratio: 割合,
   * population: 人数, density: 人口密度, change: 符号付き人数
   */
  kind: 'money' | 'population' | 'index' | 'ratio' | 'density' | 'change';
  /** メニュー・トグルのカテゴリ */
  category: MetricCategory;
  /** fiscalIndicators から引く場合の指標名 */
  indicatorName?: string;
  /** 補足説明（メニューに表示） */
  description?: string;
  /** 高いほど良い指標。色の濃淡を反転（低い＝悪い＝濃い）する */
  invertColor?: boolean;
  /**
   * 年度によらない静的値（住基 令和7年1月1日等）。
   * 選択中は年度トグルを無効化し、推移グラフも出さない
   */
  yearIndependent?: boolean;
}

export const METRICS: MetricDef[] = [
  { key: 'expenditure', label: '歳出', kind: 'money', category: 'money' },
  { key: 'revenue', label: '歳入', kind: 'money', category: 'money' },
  { key: 'population', label: '人口', kind: 'population', category: 'population' },
  {
    key: 'populationDensity',
    label: '人口密度',
    kind: 'density',
    category: 'population',
    description: '1km²当たりの人口（面積は国土地理院 面積調）',
  },
  {
    key: 'elderlyRatio',
    label: '高齢化比率',
    kind: 'ratio',
    category: 'population',
    description: '65歳以上人口の割合（住民基本台帳 令和7年1月1日）',
    yearIndependent: true,
  },
  {
    key: 'births',
    label: '出生数',
    kind: 'population',
    category: 'population',
    description: '出生者数（令和6年中・住民基本台帳）',
    yearIndependent: true,
  },
  {
    key: 'foreignRatio',
    label: '外国人比率',
    kind: 'ratio',
    category: 'population',
    description: '外国人住民の割合（住民基本台帳 令和7年1月1日）',
    yearIndependent: true,
  },
  {
    key: 'foreignBirthRatio',
    label: '外国人出生割合',
    kind: 'ratio',
    category: 'population',
    description: '出生数に占める外国人住民の割合（令和6年中・住民基本台帳）',
    yearIndependent: true,
  },
  {
    key: 'populationChange',
    label: '増減数',
    kind: 'change',
    category: 'population',
    description: '人口増減数（令和6年中。転入・出生等 − 転出・死亡等）',
    yearIndependent: true,
  },
  {
    key: 'fiscalIndex',
    label: '財政力指数',
    kind: 'index',
    category: 'fiscal',
    indicatorName: '財政力指数',
    description: '高いほど自主財源が豊か（1以上は交付税不交付）',
    invertColor: true,
  },
  {
    key: 'currentBalanceRatio',
    label: '経常収支比率',
    kind: 'ratio',
    category: 'fiscal',
    indicatorName: '経常収支比率',
    description: '高いほど財政が硬直的',
  },
  {
    key: 'debtServiceRatio',
    label: '実質公債費比率',
    kind: 'ratio',
    category: 'fiscal',
    indicatorName: '実質公債費比率',
    description: '高いほど借金返済の負担が重い',
  },
  {
    key: 'futureBurdenRatio',
    label: '将来負担比率',
    kind: 'ratio',
    category: 'fiscal',
    indicatorName: '将来負担比率',
    description: '高いほど将来の負債負担が大きい',
  },
];

export function metricCategory(key: MapMetricKey): MetricCategory {
  return metricDef(key).category;
}

/** カテゴリ内でトグル表示する指標キー */
export function categoryKeys(category: MetricCategory): MapMetricKey[] {
  return METRICS.filter((m) => m.category === category).map((m) => m.key);
}

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
  if (key === 'population') {
    return budget.population ?? null;
  }
  if (key === 'populationDensity') {
    const area = budget.demographics?.areaKm2;
    return budget.population && area ? budget.population / area : null;
  }
  if (
    key === 'elderlyRatio' ||
    key === 'foreignRatio' ||
    key === 'births' ||
    key === 'populationChange' ||
    key === 'foreignBirthRatio'
  ) {
    return budget.demographics?.[key] ?? null;
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
    case 'density':
      return `${Math.round(value).toLocaleString()}人/km²`;
    case 'change': {
      const abs = Math.abs(value);
      const formatted =
        abs >= 10_000
          ? `${(abs / 10_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}万人`
          : `${Math.round(abs).toLocaleString()}人`;
      return value < 0 ? `-${formatted}` : `+${formatted}`;
    }
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
