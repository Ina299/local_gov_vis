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
  /**
   * 地域人口再生産率（RRR）。
   * 年齢別出生率と人口移動を含む累積残存率から算出し、1が世代交代の維持水準
   */
  regionalReproductionRate?: number;
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
/**
 * 道路分の国費（配分）。国交省 道路局の都道府県別 箇所表「社会資本整備総合交付金の配分（道路分）」で、
 * この自治体が事業実施主体の工区の想定国費（円）を配分年度ごとに合計したもの。当初配分（4月公表）であって決算ではない。
 * 決算より新しい年度まであるため、全年度のレコードに同じ値を持たせ、地図では latestYear と前年度を使う
 */
export interface RoadFunding {
  /** 配分年度（西暦）→ 想定国費（円）。箇所表に記載の無い年度は 0 */
  byYear: Record<string, number>;
  latestYear: number;
  source: string;
  /**
   * 最新の配分年度ペアでの「説明の付きにくい減額」（教師なしの異常検知。警報ではなく原資料で確かめる優先度）。
   * 継続工区の増減から同じ県・同じ交付金の他市区町村の中央値（expectedPct）を引いた残差を全国で標準化し、
   * 継続工区が一斉に減っているほど・工区数が多いほど重くした値。両年度に継続工区が無い自治体は無し
   */
  /**
   * 要確認度の状態。scored = 継続工区で算出、scored-all-routes = 継続工区が無く全工区で算出した予備の値、
   * single-year = 最新ペアの片方の年度にしか記載がない（新規・終了）、no-comparison = 両年度あるが比較できない
   */
  anomalyStatus?: 'scored' | 'scored-all-routes' | 'single-year' | 'no-comparison';
  anomaly?: {
    /** 0 以上。大きいほど説明しにくい減額 */
    score: number;
    /** スコア順位（1 が最も説明しにくい）。score 0 は null */
    rank: number | null;
    /** 継続工区の前年度比（%） */
    residualPct: number;
    /** 県内の期待値（%） */
    expectedPct: number;
    routes: number;
    decreased: number;
    /** continuing = 継続工区で比較、all = 全工区で比較（予備） */
    basis: 'continuing' | 'all';
  };
}

/**
 * 衆議院議員総選挙（小選挙区）の結果。総務省の候補者別・市区町村別得票数から作る。
 * 「有権者の支持」であって首長の支持ではない。年度によらず同じ値（date の選挙）
 */
export interface Election {
  /** 回次（第48回など） */
  no: number;
  /** 執行年（西暦） */
  year: number;
  name: string;
  /** 執行日（YYYY-MM-DD） */
  date: string;
  /** この自治体が属する小選挙区（分割市は複数）と、その当選者・届出政党 */
  districts: Array<{ district: string; winner: string; party: string }>;
  /** 当選者の届出政党（複数の小選挙区にまたがる市は、この市で最も得票した当選者の政党）。都道府県は null */
  winnerParty: string | null;
  /** 当選者の得票 ÷ 有効得票（この自治体内。複数選挙区は合算） */
  winnerShare: number | null;
  /** 当選者の得票率 − 自治体内で当選者以外の最多候補の得票率（負なら地元では別の候補が上）。都道府県は null */
  winnerMargin: number | null;
  /** 届出政党ごとの得票率（0〜1。この自治体内の有効得票に対する割合。得票の多い順） */
  partyShare: Record<string, number>;
  source: string;
}

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
  /** 道路分の国費（配分）。年度によらず同じ値（配分年度は byYear のキー） */
  roadFunding?: RoadFunding;
  /** 衆院選（小選挙区）の結果。選挙ごと（古い順）。年度によらず同じ配列 */
  elections?: Election[];
  /** 事務事業評価の整備状況。budgets JSON には無く、画面で evaluation-coverage.json から付ける（市区町村のみ） */
  evaluationCoverage?: { level: number; flowYear?: number };
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
