/** 予算項目 */
export interface BudgetItem {
  name: string;
  amount: number;
  category: BudgetCategory;
  yearOverYear?: number;
  /** 充当一般財源等（円。地方財政状況調査の目的別財源内訳。歳出の大項目のみ） */
  generalFunds?: number;
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
 * 人口統計（住民基本台帳 令和7年1月1日・国土地理院 面積調に基づく静的値）。
 * 比率は0〜1の小数で保持する
 */
export interface Demographics {
  /** 面積（km²） */
  areaKm2?: number;
  /** 高齢化比率（65歳以上人口 ÷ 総人口） */
  elderlyRatio?: number;
  /** 外国人比率（外国人住民 ÷ 総人口） */
  foreignRatio?: number;
  /** 出生数（令和6年中の住民票記載数） */
  births?: number;
  /** 人口増減数（令和6年中。転入・出生等 − 転出・死亡等） */
  populationChange?: number;
  /** 外国人出生割合（外国人の出生数 ÷ 全出生数。令和6年中の住民票記載数） */
  foreignBirthRatio?: number;
}

/** 自治体予算データ */
export interface LocalGovBudget {
  code: string;
  name: string;
  prefecture: string;
  fiscalYear: number;
  budgetType: 'initial' | 'supplementary' | 'final';
  totalRevenue: number;
  totalExpenditure: number;
  expenditures: BudgetItem[];
  revenues: BudgetItem[];
  /** 歳出内訳（性質別） */
  expendituresByNature?: BudgetItem[];
  /** 財政指標 */
  fiscalIndicators?: FiscalIndicator[];
  population?: number;
  /** 人口統計（年度によらず同一の静的値） */
  demographics?: Demographics;
  perCapitaExpenditure?: number;
  sourceUrl: string;
  crawledAt: string;
}

/** 地図の集計対象（歳出/歳入） */
export type BudgetBasis = 'expenditure' | 'revenue';

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
