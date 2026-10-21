import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Extract, municipality, normalize } from './g6-util';

const HEADER = /^[^\n]+ 事業評価一覧（令和６年度に実施した事業）/;
/** Names already structured from 02/01.pdf for the same fiscal year (collision → incoming side excluded). */
const EXCLUDED = ['ＭＩＣＥ推進事業', '宇都宮ブランド戦略の推進', '交通ＩＣカード普及促進事業', '運賃負担軽減事業', '夜間休日救急診療所運営事業',
  '医事・薬事監視指導事務', '相談支援事業', '多機関協働事業'];

/** 宇都宮市 事業評価一覧（令和６年度に実施した事業）: only the NO + 事業名 lines are column-safe. */
function parse(input: CachedInput): ProjectEvaluation[] {
  const header = HEADER.exec(input.text);
  if (!header) return [];
  const rows = [...input.text.matchAll(/^(\d{1,3}) ([^\n]+)\n\n/gm)].filter(m => !/[。、]|^[・【（(]/.test(m[2]));
  const count = new Map<string, number>();
  for (const m of rows) count.set(normalize(m[2]), (count.get(normalize(m[2])) ?? 0) + 1);
  return rows.filter(m => count.get(normalize(m[2])) === 1).map(m => {
    const raw = `${m[1]} ${m[2]}`, p = project(input, m[2], m[2], null, raw, m.index);
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, header[0], 0));
    p.warnings.push('宇都宮市 事業評価一覧（令和６年度に実施した事業）の行。評価対象年度は表題の令和6年度。評価年度は資料中に明示がないため未設定。',
      '抽出テキストでは表の列（施策・事業費・進捗・方向性・評価コメント）が行をまたいで混在し対応が確定できないため、事業名のみ構造化。事業名が複数行に折り返す行と、同一資料内で同名の行は除外。');
    return p;
  });
}

export const entries: Record<string, { extract: Extract; scope: string }> = {
  '09201': { extract: municipality('09201', parse, EXCLUDED), scope: '事業評価一覧（令和６年度に実施した事業、分野別7資料）の事業名のみ（評価対象年度令和6年度）。事業費・進捗・方向性・評価コメントは列対応が確定できず対象外。施策カルテ・施策評価一覧・案内ページも対象外。' },
};
