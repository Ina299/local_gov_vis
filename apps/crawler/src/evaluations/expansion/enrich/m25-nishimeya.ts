/**
 * 02343 西目屋村: 電源立地地域対策交付金 事業評価個表（令和7年度）。「交付金事業の概要」の段落を事業内容として収録する
 * （目的の欄はない。「事業実施により期待される効果」は見込みのため採らない。定性的な成果の欄は空欄）。
 * 年度は公開済みレコードと同じ（表題の令和7年度を評価対象年度）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord } from './m21-util';

const SHEET = /\nⅡ．事業評価個表（令和7年度）\n[\s\S]*?(味な工房LED化改修事業)\n[\s\S]*?\n交付金事業の概要\n\n((?:[^\n]+\n)*?[^\n]+)\n\n□/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '02343' || !/\/group\/6\/hyouka\.pdf$/.test(input.sourceUrl)) return [];
  const m = SHEET.exec(input.text);
  if (!m) return [];
  const nameAt = m.index! + m[0].indexOf(m[1]), at = m.index! + m[0].lastIndexOf(m[2]);
  return [sheetRecord(input, 'nishimeya', { value: m[1], raw: m[1], at: nameAt }, { evaluationYear: null, evaluatedFiscalYear: 2025 }, null,
    [{ key: 'activities', raw: m[2], at }],
    '西目屋村 電源立地地域対策交付金 事業評価個表（令和7年度）の「交付金事業の概要」を事業内容として収録（PDFの改行を除いた）。目的の欄はない。')];
}

export const entry = {
  extract,
  scope: '西目屋村 電源立地地域対策交付金 事業評価個表（令和7年度）の「交付金事業の概要」。目的の欄はなく、期待される効果（見込み）は対象外。',
};
