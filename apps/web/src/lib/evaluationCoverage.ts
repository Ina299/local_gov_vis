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

export interface CoverageEntry { level: number; flowYear?: number }
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
export function evaluationEntryHref(code: string, entry: CoverageEntry | undefined): string {
  if (code.length !== 5) return '/evaluations/';
  if (entry?.level === 0) return `/evaluations/?${new URLSearchParams({ municipality: code, view: 'normalized' })}#${COST_FLOW_ANCHOR}`;
  return `/evaluations/?${new URLSearchParams({ municipality: code })}`;
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
