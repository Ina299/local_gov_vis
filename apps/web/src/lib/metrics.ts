import type { LocalGovBudget, MapScale } from '@/types/budget';
import { formatAmount } from './format';

/** 地図で色分けする指標 */
export type MapMetricKey =
  | 'expenditure'
  | 'revenue'
  | 'localAllocationTax'
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
  | 'futureBurdenRatio'
  | 'avgIncome'
  | 'industryMedical'
  | 'industryConstruction'
  | 'industryManufacturing'
  | 'industryAgriculture'
  | 'industryHospitality'
  | 'industryTransport'
  | 'industryIT'
  | 'industryPublic';

/** ハンバーガーメニューで選ぶ表示カテゴリ */
export type MetricCategory = 'money' | 'population' | 'fiscal' | 'labor';

export interface MetricDef {
  key: MapMetricKey;
  label: string;
  /**
   * money: 総額/一人当たり切替あり, index: 指数, ratio: 割合,
   * population: 人数, density: 人口密度, change: 符号付き人数,
   * yenPerPerson: 1人あたり年額（スケール切替なし）
   */
  kind: 'money' | 'population' | 'index' | 'ratio' | 'density' | 'change' | 'yenPerPerson';
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
  {
    key: 'localAllocationTax',
    label: '地方交付税',
    kind: 'money',
    category: 'money',
    description: '国から交付される使途自由な財源。自前の税収で標準的な行政サービスを賄えない分を補填（不交付団体は0円）',
  },
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
  {
    key: 'avgIncome',
    label: '平均所得',
    kind: 'yenPerPerson',
    category: 'labor',
    description:
      '納税義務者1人あたりの課税対象所得（2024年中の所得。総務省「市町村税課税状況等の調」令和7年度）。豊かなほど濃い金色',
    yearIndependent: true,
  },
  // 医療・福祉／公務／建設は税・保険料・公共事業に支えられる「国への依存度」を示す並び
  {
    key: 'industryMedical',
    label: '医療・福祉',
    kind: 'ratio',
    category: 'labor',
    description:
      '就業者に占める医療・福祉の割合（令和2年国勢調査）。医療・介護は保険料と公費で成り立つため、高いほど地域の雇用が公的マネーに依存している',
    yearIndependent: true,
  },
  {
    key: 'industryPublic',
    label: '公務',
    kind: 'ratio',
    category: 'labor',
    description:
      '就業者に占める公務の割合（令和2年国勢調査）。高いほど役場・官公庁が地域雇用の柱になっている',
    yearIndependent: true,
  },
  {
    key: 'industryConstruction',
    label: '建設業',
    kind: 'ratio',
    category: 'labor',
    description:
      '就業者に占める建設業の割合（令和2年国勢調査）。高いほど公共事業が地域雇用を支えている傾向',
    yearIndependent: true,
  },
  {
    key: 'industryManufacturing',
    label: '製造業',
    kind: 'ratio',
    category: 'labor',
    description: '就業者に占める製造業の割合（令和2年国勢調査）',
    yearIndependent: true,
  },
  {
    key: 'industryAgriculture',
    label: '農林業',
    kind: 'ratio',
    category: 'labor',
    description: '就業者に占める農業・林業の割合（令和2年国勢調査）',
    yearIndependent: true,
  },
  {
    key: 'industryHospitality',
    label: '宿泊・飲食',
    kind: 'ratio',
    category: 'labor',
    description:
      '就業者に占める宿泊業・飲食サービス業の割合（令和2年国勢調査）。高いほど観光への依存が大きい',
    yearIndependent: true,
  },
  {
    key: 'industryTransport',
    label: '運輸・郵便',
    kind: 'ratio',
    category: 'labor',
    description:
      '就業者に占める運輸業・郵便業の割合（令和2年国勢調査）。港湾・空港・物流拠点の自治体で高い',
    yearIndependent: true,
  },
  {
    key: 'industryIT',
    label: '情報通信',
    kind: 'ratio',
    category: 'labor',
    description: '就業者に占める情報通信業の割合（令和2年国勢調査）',
    yearIndependent: true,
  },
];

/** 業種割合指標 → 国勢調査の産業大分類名 */
export const INDUSTRY_METRIC_NAMES: Partial<Record<MapMetricKey, string>> = {
  industryMedical: '医療・福祉',
  industryConstruction: '建設業',
  industryManufacturing: '製造業',
  industryAgriculture: '農業・林業',
  industryHospitality: '宿泊業・飲食サービス業',
  industryTransport: '運輸業・郵便業',
  industryIT: '情報通信業',
  industryPublic: '公務（他に分類されるものを除く）',
};

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
    const amount =
      key === 'revenue'
        ? budget.totalRevenue
        : key === 'localAllocationTax'
          ? (budget.revenues.find((r) => r.name === '地方交付税')?.amount ?? 0)
          : budget.totalExpenditure;
    if (scale === 'perCapita') {
      if (!budget.population) return null;
      return amount / budget.population;
    }
    return amount;
  }
  if (key === 'avgIncome') {
    return budget.employment?.avgIncome ?? null;
  }
  const industryName = INDUSTRY_METRIC_NAMES[key];
  if (industryName) {
    const industries = budget.employment?.industries;
    if (!industries) return null;
    // 全業種を保存しているので、リストにない業種は就業者がいない（0%）とみなす
    return (industries.find((i) => i.name === industryName)?.share ?? 0) / 100;
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
    case 'yenPerPerson':
      return `${Math.round(value / 10_000).toLocaleString()}万円`;
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
