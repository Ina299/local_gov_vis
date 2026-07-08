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
  /** 充当一般財源等（円。地方財政状況調査の目的別財源内訳。歳出の大項目のみ） */
  generalFunds?: number;
  /** 性質別の内訳（構成比%の上位のみ。地方財政状況調査の目的別×性質別クロス。歳出の大項目のみ） */
  natures?: Array<{ name: string; share: number }>;
  /** サブカテゴリ（内訳） */
  children?: BudgetItem[];
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
  | 'police'               // 警察費
  | 'education'            // 教育費
  | 'public_debt'          // 公債費
  | 'assembly'             // 議会費
  | 'other';               // その他

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
  /** 歳出内訳（性質別） */
  expendituresByNature?: BudgetItem[];
  /** 財政指標 */
  fiscalIndicators?: FiscalIndicator[];
  /** 人口 */
  population?: number;
  /** 人口統計（年度によらず同一の静的値） */
  demographics?: Demographics;
  /** 就労・所得（年度によらず同一の静的値） */
  employment?: Employment;
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
