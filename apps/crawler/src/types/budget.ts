/** 予算項目 */
export interface BudgetItem {
  /** 項目名 */
  name: string;
  /** 金額（円） */
  amount: number;
  /** カテゴリ */
  category: BudgetCategory;
  /** 前年比（%） */
  yearOverYear?: number;
}

/** 予算カテゴリ */
export type BudgetCategory =
  | 'general_affairs'      // 総務費
  | 'welfare'              // 民生費
  | 'health'               // 衛生費
  | 'labor'                // 労働費
  | 'agriculture'          // 農林水産業費
  | 'commerce'             // 商工費
  | 'civil_engineering'    // 土木費
  | 'fire_police'          // 消防費
  | 'education'            // 教育費
  | 'public_debt'          // 公債費
  | 'other';               // その他

/** 自治体予算データ */
export interface LocalGovBudget {
  /** 自治体コード（JIS X 0401/0402） */
  code: string;
  /** 自治体名 */
  name: string;
  /** 都道府県名 */
  prefecture: string;
  /** 年度 */
  fiscalYear: number;
  /** 予算種別 */
  budgetType: 'initial' | 'supplementary' | 'final';
  /** 歳入総額 */
  totalRevenue: number;
  /** 歳出総額 */
  totalExpenditure: number;
  /** 歳出内訳 */
  expenditures: BudgetItem[];
  /** 歳入内訳 */
  revenues: BudgetItem[];
  /** 人口 */
  population?: number;
  /** 一人当たり歳出 */
  perCapitaExpenditure?: number;
  /** データソースURL */
  sourceUrl: string;
  /** 取得日時 */
  crawledAt: string;
}

/** クローラーオプション */
export interface CrawlerOptions {
  prefectureCode?: string;
  outputDir: string;
}
