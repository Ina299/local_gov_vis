/** 予算項目 */
export interface BudgetItem {
  name: string;
  amount: number;
  category: BudgetCategory;
  yearOverYear?: number;
  /** 充当一般財源等（円。地方財政状況調査の目的別財源内訳。歳出の大項目のみ） */
  generalFunds?: number;
  /** 性質別の内訳（構成比%の上位のみ。地方財政状況調査の目的別×性質別クロス。歳出の大項目のみ） */
  natures?: Array<{ name: string; share: number }>;
  /** サブカテゴリ（内訳） */
  children?: BudgetItem[];
}

/** 予算カテゴリ */
export type BudgetCategory =
  | 'general_affairs'
  | 'welfare'
  | 'health'
  | 'labor'
  | 'agriculture'
  | 'commerce'
  | 'civil_engineering'
  | 'fire_police'
  | 'police'
  | 'education'
  | 'public_debt'
  | 'assembly'
  | 'other';

/** カテゴリ表示名 */
export const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  general_affairs: '総務費',
  welfare: '民生費',
  health: '衛生費',
  labor: '労働費',
  agriculture: '農林水産業費',
  commerce: '商工費',
  civil_engineering: '土木費',
  fire_police: '消防費',
  police: '警察費',
  education: '教育費',
  public_debt: '公債費',
  assembly: '議会費',
  other: 'その他',
};

/** 財政指標（財政力指数・経常収支比率など） */
export interface FiscalIndicator {
  name: string;
  value: number;
  unit: string;
}

/**
 * 人口統計（住民基本台帳・国土地理院 面積調）。年度別の値で、
 * 人口・比率は年度の翌年1月1日時点、出生・増減は年度に対応する暦年中の値。
 * 比率は0〜1の小数で保持する
 */
export interface Demographics {
  /** 面積（km²） */
  areaKm2?: number;
  /** 高齢化比率（65歳以上人口 ÷ 総人口） */
  elderlyRatio?: number;
  /** 外国人比率（外国人住民 ÷ 総人口） */
  foreignRatio?: number;
  /** 出生数（年度に対応する暦年中の住民票記載数） */
  births?: number;
  /** 人口増減数（年度に対応する暦年中。転入・出生等 − 転出・死亡等） */
  populationChange?: number;
  /** 外国人出生割合（外国人の出生数 ÷ 全出生数） */
  foreignBirthRatio?: number;
}

/**
 * 安全（警察庁 交通事故統計オープンデータの市区町村別集計）。
 * 年度に対応する暦年中の人身事故の値。都道府県は県内市区町村の合算
 */
export interface Safety {
  /** 人身事故の件数 */
  accidents?: number;
  /** 死者数（24時間以内） */
  fatalities?: number;
  /** 負傷者数 */
  injuries?: number;
  /** 刑法犯認知件数（警察庁 犯罪統計。都道府県のみ） */
  penalCodeOffenses?: number;
  /** 殺人認知件数（都道府県のみ） */
  homicides?: number;
  /** 強盗認知件数（都道府県のみ） */
  robberies?: number;
  /** 侵入盗（空き巣・事務所荒し等）認知件数（都道府県のみ） */
  burglaries?: number;
  /** 不同意性交等（旧 強姦・強制性交等）認知件数（都道府県のみ） */
  sexualAssaults?: number;
}

/**
 * インフラ（年度別）。道路・公園・公営住宅・下水道は総務省 公共施設状況調
 * （最新は令和5年度末で2024年度レコードには付かない）、水道管・病院は
 * 内閣府 見える化DB。都道府県は自団体分＋県内市町村の合算（下水道は市町村のみ）
 */
export interface Infrastructure {
  /** 道路実延長（m） */
  roadLengthM?: number;
  /** 公園面積（m²。都市公園等＋都市計画区域外） */
  parkAreaM2?: number;
  /** 公営住宅等の戸数（公営・改良・単独の合計） */
  publicHousingUnits?: number;
  /** 公共下水道の現在処理区域内人口（施設のない団体は0） */
  seweragePopulation?: number;
  /**
   * 水道管の経年化率（法定耐用年数超の管路割合、0〜1。年度別）。
   * 見える化DB（地方公営企業決算）。都道府県は県内市区町村の単純平均（参考値）
   */
  waterPipeAgingRatio?: number;
  /** 病院数（医療施設調査。年度別。都道府県は県内合算） */
  hospitals?: number;
  /** 病院の病床数（医療施設調査。年度別。都道府県は県内合算） */
  hospitalBeds?: number;
  /** 点検済みの橋の数（道路メンテナンス年報・直近5年度の合算。管理者ベースの静的値） */
  bridgesInspected?: number;
  /** 要修繕（判定Ⅲ・Ⅳ）の橋の数 */
  bridgesNeedRepair?: number;
}

/**
 * 就労・所得（課税状況調・国勢調査に基づく静的値）。
 * avgIncomeは納税義務者1人あたり課税対象所得（円/年）
 */
export interface Employment {
  /** 平均所得（課税対象所得 ÷ 所得割納税義務者数。円/年） */
  avgIncome?: number;
  /** 所得割納税義務者数 */
  taxpayers?: number;
  /** 産業別就業者の構成比%（全業種・降順。国勢調査 産業大分類） */
  industries?: Array<{ name: string; share: number }>;
}

/** 自治体予算データ */
export interface LocalGovBudget {
  code: string;
  name: string;
  prefecture: string;
  fiscalYear: number;
  /** 予算種別（軽量データ municipal-all/{年度}.json では省略） */
  budgetType?: 'initial' | 'supplementary' | 'final';
  totalRevenue: number;
  totalExpenditure: number;
  expenditures: BudgetItem[];
  revenues: BudgetItem[];
  /** 歳出内訳（性質別） */
  expendituresByNature?: BudgetItem[];
  /** 財政指標 */
  fiscalIndicators?: FiscalIndicator[];
  population?: number;
  /** 人口統計（年度別） */
  demographics?: Demographics;
  /** 就労・所得（年度によらず同一の静的値） */
  employment?: Employment;
  /** インフラ（年度別） */
  infrastructure?: Infrastructure;
  /** 安全（年度別。暦年中の交通事故） */
  safety?: Safety;
  perCapitaExpenditure?: number;
  /** 軽量データ municipal-all/{年度}.json では省略 */
  sourceUrl?: string;
  crawledAt?: string;
}

/** 地図の表示スケール（総額/一人当たり） */
export type MapScale = 'total' | 'perCapita';

/** GeoJSONフィーチャー */
export interface GeoFeature {
  type: 'Feature';
  properties: {
    code: string;
    name: string;
    center?: [number, number] | null;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}
