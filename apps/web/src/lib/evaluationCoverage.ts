/**
 * 事務事業評価の整備状況（evaluation-coverage.json、crawler の build:evaluation-coverage が生成）。
 * 地図の「事務事業評価」層の区分と、収支図からの遷移先（事業コストの流れ／資料一覧）の判定に使う。
 * 段階は「このアプリでどこまで読めるか」であり、自治体の評価の実施・公開状況ではない。
 */
import { fetchJson } from './fetchJson';
import { dataUrl } from './paths';

/** 進んでいる順。添字が evaluation-coverage.json の level */
export const COVERAGE_LEVELS = [
  '事業コストの流れまで',
  '整理済み事業票あり',
  '評価資料の本文あり',
  'その他の公式テキストあり',
  '評価の案内ページのみ',
  '資料を未確認',
] as const;
export type CoverageLabel = (typeof COVERAGE_LEVELS)[number];

/** 一色の濃淡（濃い＝整備が進んでいる）。未確認は欠損（データなし）と区別した薄い灰 */
export const COVERAGE_COLORS: Record<CoverageLabel, string> = {
  事業コストの流れまで: '#123f20',
  整理済み事業票あり: '#2c7241',
  評価資料の本文あり: '#4fa763',
  その他の公式テキストあり: '#96d1a0',
  評価の案内ページのみ: '#d3ecd6',
  資料を未確認: '#d9dde3',
};

export interface CoverageEntry {
  level: number;
  flowYear?: number;
  /**
   * 透明度: 評価資料から事業別に読み取れた決算額の合計 ÷ 歳出総額（決算）。比べられる年度のうち最も高い年度の値。
   * 0 は読み取れた決算額がない。省略は比べられない（決算額はあるが歳出総額の収録年度と重ならない等）
   */
  transparency?: number;
  transparencyYear?: number;
  /** 割った歳出総額の年度（transparencyYear の決算が未公表のときは直近の年度） */
  transparencyTotalYear?: number;
}

/**
 * 透明度を計算する: 年度ごとの「読み取れた決算額の合計」を歳出総額（決算）で割り、比べられる年度のうち最も高い値を返す。
 * その年度の歳出総額が未収録（決算の公表待ち）なら、2 年以内の直近の年度の歳出総額で代える（totalYear に残す）。
 * 0 は読み取れた決算額がない。null は比べられない（歳出総額がない・収録額が歳出総額を上回る）
 */
export function transparencyOf(recordedByYear: Record<string, number>, totalsByYear: Record<string, number> | undefined): { ratio: number; year: number; totalYear: number } | null | 0 {
  const years = Object.keys(recordedByYear).filter((y) => recordedByYear[y] > 0);
  if (!years.length) return 0;
  let best: { ratio: number; year: number; totalYear: number } | null = null;
  for (const y of years) {
    const totalYear = [0, 1, 2].map((d) => Number(y) - d).find((t) => (totalsByYear?.[String(t)] ?? 0) > 0);
    if (totalYear === undefined) continue;
    const total = totalsByYear![String(totalYear)];
    // 収録額が歳出総額を上回る年度は、年度の対応がずれている可能性があるため比べない
    if (recordedByYear[y] > total) continue;
    const ratio = recordedByYear[y] / total;
    // 同じ年度の歳出総額で割れる年度を優先し、その中で割合が高い（同じなら新しい）年度
    const rank = (c: { ratio: number; year: number; totalYear: number }) => [Number(c.totalYear === c.year), c.ratio, c.year];
    const cand = { ratio, year: Number(y), totalYear };
    const [a1, a2, a3] = rank(cand); const [b1, b2, b3] = best ? rank(best) : [-1, -1, -1];
    if (a1 > b1 || (a1 === b1 && (a2 > b2 || (a2 === b2 && a3 > b3)))) best = cand;
  }
  return best;
}
export interface EvaluationCoverageFile {
  schemaVersion: 1;
  evidenceSnapshotAt: string;
  structuredGeneratedAt: string;
  levels: string[];
  municipalities: Record<string, CoverageEntry>;
}

export function coverageLabel(entry: CoverageEntry | undefined): CoverageLabel | null {
  return entry ? (COVERAGE_LEVELS[entry.level] ?? null) : null;
}

/** 収支図などからの遷移先。事業コストの流れ（サンキー）があればそこへ、なければ自治体の資料一覧へ */
// 地図の画面に評価ローダー一式を読み込ませないよう、evaluationLoader の evaluationMunicipalityHref と同じ形をここで組む
// 都道府県（地図では 2 桁）は評価データでは 13000 の形
export function evaluationEntryHref(code: string, entry: CoverageEntry | undefined): string {
  const target = code.length === 2 ? `${code}000` : code;
  if (target.length !== 5) return '/evaluations/';
  if (entry?.level === 0) return `/evaluations/?${new URLSearchParams({ municipality: target, view: 'normalized' })}#${COST_FLOW_ANCHOR}`;
  return `/evaluations/?${new URLSearchParams({ municipality: target })}`;
}
export const COST_FLOW_ANCHOR = 'evaluation-cost-flow';

let pending: Promise<EvaluationCoverageFile> | null = null;
/** 一度だけ取得して使い回す（失敗したら次回に再試行） */
export function loadEvaluationCoverage(): Promise<EvaluationCoverageFile> {
  pending ??= fetchJson<EvaluationCoverageFile>(dataUrl('/evaluation-coverage.json')).catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}

/** 年度別の歳出総額（決算）。事業コストの流れの左端に「全体」として置く */
export interface BudgetTotalsFile {
  schemaVersion: 1;
  source: string;
  /** 自治体コード（都道府県は 2 桁）→ 年度 → 歳出総額（円） */
  totals: Record<string, Record<string, number>>;
}
let pendingTotals: Promise<BudgetTotalsFile> | null = null;
export function loadBudgetTotals(): Promise<BudgetTotalsFile> {
  pendingTotals ??= fetchJson<BudgetTotalsFile>(dataUrl('/evaluation-budget-totals.json')).catch((error) => {
    pendingTotals = null;
    throw error;
  });
  return pendingTotals;
}
