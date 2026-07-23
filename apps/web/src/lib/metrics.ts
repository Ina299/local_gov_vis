import type { LocalGovBudget, MapScale } from '@/types/budget';
import { formatAmount } from './format';

/** 地図で色分けする指標 */
export type MapMetricKey =
  | 'expenditure'
  | 'expenditureEducation'
  | 'expenditureWelfare'
  | 'expenditureHealth'
  | 'expenditureCivil'
  | 'expenditureAgriculture'
  | 'expenditureCommerce'
  | 'revenue'
  | 'revenueLocalTax'
  | 'localAllocationTax'
  | 'revenueNationalTreasury'
  | 'population'
  | 'populationDensity'
  | 'elderlyRatio'
  | 'foreignRatio'
  | 'births'
  | 'regionalReproductionRate'
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
  | 'industryPublic'
  | 'roadPerCapita'
  | 'bridgeRepairRate'
  | 'waterPipeAging'
  | 'sewerageRatio'
  | 'parkPerCapita'
  | 'publicHousingRate'
  | 'hospitals'
  | 'hospitalBeds'
  | 'trafficAccidents'
  | 'trafficFatalities'
  | 'penalCodeOffenses'
  | 'homicides'
  | 'robberies'
  | 'burglaries'
  | 'sexualAssaults';

/** ハンバーガーメニューで選ぶ表示カテゴリ */
export type MetricCategory = 'money' | 'population' | 'fiscal' | 'labor' | 'infra' | 'safety';

export interface MetricDef {
  key: MapMetricKey;
  label: string;
  /**
   * money: 総額/一人当たり切替あり, index: 指数, ratio: 割合,
   * population: 人数, density: 人口密度, change: 符号付き人数,
   * yenPerPerson: 1人あたり年額（スケール切替なし）,
   * meterPerPerson/sqmPerPerson: 1人あたりの長さ・面積,
   * per1000/per100k: 千人・10万人あたりの数（単位はunitで指定）
   */
  kind:
    | 'money'
    | 'population'
    | 'index'
    | 'ratio'
    | 'density'
    | 'change'
    | 'yenPerPerson'
    | 'meterPerPerson'
    | 'sqmPerPerson'
    | 'per1000'
    | 'per100k';
  /** per1000/per100kの単位（戸・件など） */
  unit?: string;
  /** kind: money で総額ではなく内訳項目（款・歳入項目）を参照する場合の指定 */
  budgetItem?: { list: 'expenditures' | 'revenues'; name: string };
  /** メニュー・トグルのカテゴリ */
  category: MetricCategory;
  /** fiscalIndicators から引く場合の指標名 */
  indicatorName?: string;
  /** 補足説明（メニューに表示） */
  description?: string;
  /** 高いほど良い指標。色の濃淡を反転（低い＝悪い＝濃い）する */
  invertColor?: boolean;
  /**
   * 年度によらない静的値（課税状況調・国勢調査等）。
   * 選択中は年度トグルを無効化し、推移グラフも出さない
   */
  yearIndependent?: boolean;
  /**
   * 都道府県別のみの指標（犯罪統計等。市区町村別の全国統計が存在しない）。
   * 選択中は市区町村ビューへの切替・ドリルダウンを無効化する
   */
  prefOnly?: boolean;
  /**
   * データが存在する最新年度（公表が遅れる統計）。
   * 選択中はこの年度までしか年度トグルに出さず、超えていたら丸める
   */
  maxYear?: number;
}

export const METRICS: MetricDef[] = [
  {
    key: 'expenditure',
    label: '歳出',
    kind: 'money',
    category: 'money',
    description: 'その年度に自治体が使ったお金の総額（決算）',
  },
  {
    key: 'expenditureEducation',
    label: '教育費',
    kind: 'money',
    category: 'money',
    budgetItem: { list: 'expenditures', name: '教育費' },
    description: '小中学校・高校・幼稚園・生涯学習など教育への支出（目的別歳出）',
  },
  {
    key: 'expenditureWelfare',
    label: '民生費',
    kind: 'money',
    category: 'money',
    budgetItem: { list: 'expenditures', name: '民生費' },
    description: '子育て・高齢者・障害者・生活保護など暮らしを支える福祉の支出（目的別歳出）',
  },
  {
    key: 'expenditureCivil',
    label: '土木費',
    kind: 'money',
    category: 'money',
    budgetItem: { list: 'expenditures', name: '土木費' },
    description: '道路・河川・公園・住宅などインフラ整備の支出（目的別歳出）',
  },
  {
    key: 'expenditureCommerce',
    label: '商工費',
    kind: 'money',
    category: 'money',
    budgetItem: { list: 'expenditures', name: '商工費' },
    description:
      '商業・工業・観光の振興への支出（目的別歳出。市区町村の決算データには商工費の款がないため都道府県のみ）',
    prefOnly: true,
  },
  {
    key: 'expenditureAgriculture',
    label: '農林水産業費',
    kind: 'money',
    category: 'money',
    budgetItem: { list: 'expenditures', name: '農林水産業費' },
    description: '農業・林業・水産業の振興や基盤整備への支出（目的別歳出）',
  },
  {
    key: 'expenditureHealth',
    label: '衛生費',
    kind: 'money',
    category: 'money',
    budgetItem: { list: 'expenditures', name: '衛生費' },
    description: '健康づくり・保健所・ごみ処理・上下水道の繰出など衛生の支出（目的別歳出）',
  },
  {
    key: 'revenue',
    label: '歳入',
    kind: 'money',
    category: 'money',
    description: 'その年度に自治体に入ってきたお金の総額（決算）',
  },
  {
    key: 'revenueLocalTax',
    label: '地方税',
    kind: 'money',
    category: 'money',
    budgetItem: { list: 'revenues', name: '地方税' },
    description: '住民税・固定資産税など、その団体が自前で集める税収',
  },
  {
    key: 'localAllocationTax',
    label: '地方交付税',
    kind: 'money',
    category: 'money',
    budgetItem: { list: 'revenues', name: '地方交付税' },
    description: '国から交付される使途自由な財源。自前の税収で標準的な行政サービスを賄えない分を補填（不交付団体は0円）',
  },
  {
    key: 'revenueNationalTreasury',
    label: '国庫支出金',
    kind: 'money',
    category: 'money',
    budgetItem: { list: 'revenues', name: '国庫支出金' },
    description: '使いみちが決められた国からの補助金・負担金',
  },
  {
    key: 'population',
    label: '人口',
    kind: 'population',
    category: 'population',
    description: '住民基本台帳に基づく人口（各年度の翌年1月1日時点）',
  },
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
    description: '65歳以上人口の割合（住民基本台帳・各年度の翌年1月1日時点）',
  },
  {
    key: 'births',
    label: '出生数',
    kind: 'population',
    category: 'population',
    description: '出生者数（住民基本台帳・各年の1〜12月中）',
  },
  {
    key: 'regionalReproductionRate',
    label: '地域再生産率',
    kind: 'index',
    category: 'population',
    description:
      '年齢別出生率と、出生から再生産年齢まで地域に残る累積残存率を統合した地域人口再生産率（RRR）。1が現在の出生・死亡・人口移動の下で世代交代を維持できる水準。厚労省 人口動態保健所・市区町村別統計（出生率: 2018〜2022年）／総務省 住民基本台帳人口（残存率: 2020〜2025年）。小規模自治体は人口移動による振れが大きい',
    yearIndependent: true,
  },
  {
    key: 'foreignRatio',
    label: '外国人比率',
    kind: 'ratio',
    category: 'population',
    description: '外国人住民の割合（住民基本台帳・各年度の翌年1月1日時点）',
  },
  {
    key: 'foreignBirthRatio',
    label: '外国人出生割合',
    kind: 'ratio',
    category: 'population',
    description: '出生数に占める外国人住民の割合（住民基本台帳・各年の1〜12月中）',
  },
  {
    key: 'populationChange',
    label: '増減数',
    kind: 'change',
    category: 'population',
    description: '人口増減数（各年の1〜12月中。転入・出生等 − 転出・死亡等）',
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
  {
    key: 'roadPerCapita',
    label: '道路の長さ',
    kind: 'meterPerPerson',
    category: 'infra',
    description:
      '住民1人あたりの道路の長さ（公共施設状況調・年度期首時点。市区町村は市町村道、都道府県は県道＋県内市町村道）。長いほど少ない人数で多くの道路を維持している',
  },
  {
    key: 'bridgeRepairRate',
    label: '橋の要修繕率',
    kind: 'ratio',
    category: 'infra',
    description:
      '点検で「早めに修繕が必要（判定Ⅲ）」「緊急（Ⅳ）」とされた橋の割合（国交省 道路メンテナンス年報・2020〜2024年度点検の合算。その団体が管理する橋が対象）',
    yearIndependent: true,
  },
  {
    key: 'waterPipeAging',
    label: '水道管の老朽化',
    kind: 'ratio',
    category: 'infra',
    description:
      '法定耐用年数（40年）を超えた水道管の割合＝管路経年化率（地方公営企業決算・各年度。内閣府 見える化DB経由。都道府県は県内市区町村の平均）',
  },
  {
    key: 'sewerageRatio',
    label: '下水道普及率',
    kind: 'ratio',
    category: 'infra',
    description:
      '公共下水道の処理区域に住む人の割合（公共施設状況調・年度期首時点。浄化槽・農業集落排水は含まない）',
    invertColor: true,
  },
  {
    key: 'parkPerCapita',
    label: '公園の広さ',
    kind: 'sqmPerPerson',
    category: 'infra',
    description: '住民1人あたりの公園面積（公共施設状況調・年度期首時点）',
    invertColor: true,
  },
  {
    key: 'publicHousingRate',
    label: '公営住宅',
    kind: 'per1000',
    unit: '戸',
    category: 'infra',
    description: '人口千人あたりの公営住宅等の戸数（公共施設状況調・年度期首時点）',
  },
  {
    key: 'hospitals',
    label: '病院',
    kind: 'per100k',
    unit: '施設',
    category: 'infra',
    description: '人口10万人あたりの病院数（医療施設調査・各年度）。高いほど濃い＝医療施設が身近',
    invertColor: true,
  },
  {
    key: 'hospitalBeds',
    label: '病床数',
    kind: 'per100k',
    unit: '床',
    category: 'infra',
    description: '人口10万人あたりの病院の病床数（医療施設調査・各年度）',
    invertColor: true,
  },
  {
    key: 'trafficAccidents',
    label: '交通事故',
    kind: 'per1000',
    unit: '件',
    category: 'safety',
    description:
      '人口千人あたりの人身事故の件数（警察庁 交通事故統計オープンデータ・各年の1〜12月中。物損事故は含まない）',
  },
  {
    key: 'trafficFatalities',
    label: '交通事故死者数',
    kind: 'per100k',
    unit: '人',
    category: 'safety',
    description:
      '人口10万人あたりの交通事故死者数（発生から24時間以内。警察庁 交通事故統計オープンデータ・各年の1〜12月中）',
  },
  {
    key: 'penalCodeOffenses',
    label: '刑法犯',
    kind: 'per1000',
    unit: '件',
    category: 'safety',
    description:
      '人口千人あたりの刑法犯認知件数（警察庁 犯罪統計・各年の1〜12月中。市区町村別の統計は存在しないため都道府県のみ）',
    prefOnly: true,
  },
  {
    key: 'homicides',
    label: '殺人',
    kind: 'per100k',
    unit: '件',
    category: 'safety',
    description:
      '人口10万人あたりの殺人認知件数（警察庁 犯罪統計・各年の1〜12月中。都道府県のみ）',
    prefOnly: true,
  },
  {
    key: 'robberies',
    label: '強盗',
    kind: 'per100k',
    unit: '件',
    category: 'safety',
    description:
      '人口10万人あたりの強盗認知件数（警察庁 犯罪統計・各年の1〜12月中。都道府県のみ）',
    prefOnly: true,
  },
  {
    key: 'burglaries',
    label: '侵入盗',
    kind: 'per100k',
    unit: '件',
    category: 'safety',
    description:
      '人口10万人あたりの侵入盗（空き巣・忍込み・事務所荒し等）の認知件数（警察庁 犯罪統計・各年の1〜12月中。都道府県のみ）',
    prefOnly: true,
  },
  {
    key: 'sexualAssaults',
    label: '不同意性交等',
    kind: 'per100k',
    unit: '件',
    category: 'safety',
    description:
      '人口10万人あたりの不同意性交等（2023年改正前は強姦・強制性交等）の認知件数（警察庁 犯罪統計・各年の1〜12月中。都道府県のみ）',
    prefOnly: true,
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
    // 内訳項目（款・歳入項目）はリストにない場合0円（不交付団体の地方交付税等）とみなす
    const item = def.budgetItem;
    const amount = item
      ? (budget[item.list].find((i) => i.name === item.name)?.amount ?? 0)
      : key === 'revenue'
        ? budget.totalRevenue
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
  if (
    key === 'roadPerCapita' ||
    key === 'bridgeRepairRate' ||
    key === 'waterPipeAging' ||
    key === 'sewerageRatio' ||
    key === 'parkPerCapita' ||
    key === 'publicHousingRate' ||
    key === 'hospitals' ||
    key === 'hospitalBeds'
  ) {
    const infra = budget.infrastructure;
    if (!infra || !budget.population) return null;
    if (key === 'roadPerCapita') {
      return infra.roadLengthM !== undefined ? infra.roadLengthM / budget.population : null;
    }
    if (key === 'bridgeRepairRate') {
      // 管理する橋がない（点検0件の）団体はデータなし
      return infra.bridgesInspected
        ? (infra.bridgesNeedRepair ?? 0) / infra.bridgesInspected
        : null;
    }
    if (key === 'waterPipeAging') {
      return infra.waterPipeAgingRatio ?? null;
    }
    if (key === 'sewerageRatio') {
      return infra.seweragePopulation !== undefined
        ? Math.min(1, infra.seweragePopulation / budget.population)
        : null;
    }
    if (key === 'parkPerCapita') {
      return infra.parkAreaM2 !== undefined ? infra.parkAreaM2 / budget.population : null;
    }
    if (key === 'hospitals') {
      return infra.hospitals !== undefined
        ? (infra.hospitals / budget.population) * 100_000
        : null;
    }
    if (key === 'hospitalBeds') {
      return infra.hospitalBeds !== undefined
        ? (infra.hospitalBeds / budget.population) * 100_000
        : null;
    }
    return infra.publicHousingUnits !== undefined
      ? (infra.publicHousingUnits / budget.population) * 1000
      : null;
  }
  if (
    key === 'trafficAccidents' ||
    key === 'trafficFatalities' ||
    key === 'penalCodeOffenses' ||
    key === 'homicides' ||
    key === 'robberies' ||
    key === 'burglaries' ||
    key === 'sexualAssaults'
  ) {
    const safety = budget.safety;
    if (!safety || !budget.population) return null;
    if (key === 'trafficAccidents') {
      return safety.accidents !== undefined ? (safety.accidents / budget.population) * 1000 : null;
    }
    if (key === 'penalCodeOffenses') {
      return safety.penalCodeOffenses !== undefined
        ? (safety.penalCodeOffenses / budget.population) * 1000
        : null;
    }
    const count =
      key === 'trafficFatalities'
        ? safety.fatalities
        : key === 'homicides'
          ? safety.homicides
          : key === 'robberies'
            ? safety.robberies
            : key === 'burglaries'
              ? safety.burglaries
              : safety.sexualAssaults;
    return count !== undefined ? (count / budget.population) * 100_000 : null;
  }
  if (key === 'populationDensity') {
    const area = budget.demographics?.areaKm2;
    return budget.population && area ? budget.population / area : null;
  }
  if (
    key === 'elderlyRatio' ||
    key === 'foreignRatio' ||
    key === 'births' ||
    key === 'regionalReproductionRate' ||
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
    case 'meterPerPerson':
      return value >= 1000
        ? `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}km`
        : `${value.toFixed(1)}m`;
    case 'sqmPerPerson':
      return `${value.toFixed(1)}m²`;
    case 'per1000':
    case 'per100k':
      return `${value.toFixed(1)}${def.unit ?? ''}`;
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
