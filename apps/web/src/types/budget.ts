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
  | 'education'
  | 'public_debt'
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
  education: '教育費',
  public_debt: '公債費',
  other: 'その他',
};

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
  population?: number;
  perCapitaExpenditure?: number;
  sourceUrl: string;
  crawledAt: string;
}

/** GeoJSONフィーチャー */
export interface GeoFeature {
  type: 'Feature';
  properties: {
    code: string;
    name: string;
    budget?: LocalGovBudget;
    center?: [number, number];
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}
