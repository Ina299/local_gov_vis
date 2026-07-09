/**
 * 全国平均・中央値データ（build-averages.tsが生成するbudget-averages.json）の
 * 型と共有ローダー。収支図（SankeyModal）と収支サマリーのドーナツが参照する
 */
import { dataUrl } from './paths';
import { fetchJson } from './fetchJson';
import type { AverageTable } from './sankey';

/**
 * レベル → 表 → 年度 → 項目名 → 値。
 * 直下は構成比（単純平均）、perCapita配下は1人あたり額の全国中央値（円/人）
 */
export type AverageTables = Record<AverageTable, Record<string, Record<string, number>>>;
export type BudgetAverages = Record<'pref' | 'muni', AverageTables & { perCapita: AverageTables }>;

let averagesPromise: Promise<BudgetAverages> | null = null;

/** budget-averages.jsonを取得する（結果はモジュール内でキャッシュ） */
export function loadAverages(): Promise<BudgetAverages> {
  averagesPromise ??= fetchJson<BudgetAverages>(dataUrl('/budget-averages.json'));
  return averagesPromise;
}
