/** 予算項目 */
export interface BudgetItem {
  name: string;
  amount: number;
  category: BudgetCategory;
  yearOverYear?: number;
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
  perCapitaExpenditure?: number;
  sourceUrl: string;
  crawledAt: string;
}

/** 地図の表示指標 */
export type MapMetric = 'total' | 'perCapita';

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
