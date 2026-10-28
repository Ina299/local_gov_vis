import type { Entry } from '../batch9/i1-util';
import { extractTaitoSheet } from './n0-taito';
import { extractYashioSheets } from './n0-yashio';

export const entries: Record<string, Entry> = {
  '13106': { extract: extractTaitoSheet, scope: '令和元年度 事務事業評価シート（PDFdata/NNN.pdf、評価対象H30年度）の人件費・総経費（H28〜H30年度決算額、費用・財源の両内訳の検算一致時のみ）・指標（R2目標値、H28〜H30実績、H30目標値。達成率で検算）・評価の視点（必要性・効率性・手段の適切性）。事業名は区の事務事業評価一覧表の行で特定。' },
  '11234': { extract: extractYashioSheets, scope: '令和7年度 事務事業評価シート（対象：R6年度実施事業）のうち費用表が列ごとに割れた様式の、R5・R6決算列の職員人件費・総事業費（人件費率・予算執行率で列を検算できるもののみ）。指標表・財源内訳は対象外。' },
};
