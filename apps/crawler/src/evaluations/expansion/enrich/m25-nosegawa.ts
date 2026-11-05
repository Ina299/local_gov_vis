/**
 * 29447 野迫川村: 令和5年度物価高騰対応重点支援地方創生臨時交付金事業実施状況・効果検証。
 * 行は「番号・所管課・事業名・事業内容、目的・金額…」の順に空行区切りで並ぶ。「事業内容、目的」の段落（句点で終わり、次に金額の値か次の行の番号が続くもの）を
 * 目的として収録する。事業実施状況・効果の列は行ごとに金額の列と混在するため採らない。年度・所管課は公開済みレコードと同じ
 * （表題の令和5年度を評価対象年度）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinLines, sheetRecord } from './m21-util';

const TITLE = '令和5年度物価高騰対応重点支援地方創生臨時交付金事業実施状況・効果検証\n';
const ROW = /\n\n([1-9])\n\n(住民課|産業課)\n\n((?:[^\n]+\n)*?[^\n]+)\n\n((?:[^\n]+\n)*?[^\n]+。)(?=\n\n[\d,]+\n)/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '29447' || !/\/group\/2\/5\.pdf$/.test(input.sourceUrl) || !input.text.startsWith(TITLE)) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(ROW)) {
    const nameAt = m.index! + m[0].indexOf(`\n\n${m[3]}\n\n`) + 2, bodyAt = nameAt + m[3].length + 2;
    if (m[4].split('\n').some(l => /^[\d,]+( |$)/.test(l))) continue;
    out.push(sheetRecord(input, `nosegawa:${m[1]}`, { value: joinLines(m[3]), raw: m[3], at: nameAt },
      { evaluationYear: null, evaluatedFiscalYear: 2023 }, m[2], [{ key: 'purpose', raw: m[4], at: bodyAt }],
      '野迫川村 令和5年度物価高騰対応重点支援地方創生臨時交付金事業実施状況・効果検証の「事業内容、目的」の欄を目的として収録（PDFの改行を除いた）。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '野迫川村 令和5年度物価高騰対応重点支援地方創生臨時交付金事業実施状況・効果検証の「事業内容、目的」の欄。実施状況・効果の列（金額の列と混在）は対象外。',
};
