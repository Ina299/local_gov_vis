/**
 * 03441 住田町: 令和６年度地方創生臨時交付金 充当事業一覧（No・事業名・事業概要・総事業費・交付金充当経費・実施成果・効果・担当課）。
 * 行は「N 事業名」の後に空行区切りで事業概要・総事業費・交付金充当経費・実施成果・効果・担当課の順に並ぶ。
 * 「事業概要」を事業内容、「実施成果・効果」を成果として収録する（目的の欄はないため目的は補強しない）。
 * 実施成果・効果は、交付金充当経費の値の後に段落として続き担当課で終わる行だけ採る（金額が本文の行に入り込む行は採らない）。
 * 年度・担当課は公開済みレコードと同じ（表題の令和６年度を評価対象年度、担当課の列）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord, type Field } from './m21-util';

const TITLE = '令和６年度地方創生臨時交付金 充当事業一覧\n';
const ROW = /(?<=\n)(\d) ([^\n]+)\n\n((?:[^\n]+\n)*?[^\n]+)\n\n([\d,]+)\n/g;
const OUTCOME = /^([\d,]+)\n\n((?:[^\n]+\n)*?[^\n]+)\n\n([^\n]+課|教育委員会)\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03441' || !/\/r06seika\.pdf$/.test(input.sourceUrl) || !input.text.startsWith(TITLE)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(ROW)) {
    const fields: Field[] = [];
    const actAt = m.index! + m[0].indexOf(`\n\n${m[3]}\n\n`) + 2;
    fields.push({ key: 'activities', raw: m[3], at: actAt });
    // 総事業費の次に交付金充当経費の値、実施成果・効果の段落、担当課が続くこと。
    const rest = t.slice(m.index! + m[0].length + 1);
    const o = OUTCOME.exec(rest);
    let dept: string | null = null;
    if (o && !o[2].split('\n').some(l => /^[\d,]+( |$)/.test(l))) {
      fields.push({ key: 'outcomes', raw: o[2], at: m.index! + m[0].length + 1 + o[1].length + 2 });
      dept = o[3];
    }
    if (m[3].split('\n').some(l => /^[\d,]+( |$)/.test(l))) continue;
    out.push(sheetRecord(input, `sumita:${m[1]}`, { value: m[2].trim(), raw: m[2], at: m.index! + m[1].length + 1 },
      { evaluationYear: null, evaluatedFiscalYear: 2024 }, dept, fields,
      '住田町 令和６年度地方創生臨時交付金 充当事業一覧の「事業概要」を事業内容、「実施成果・効果」を成果として収録（PDFの改行を除いた）。目的の欄はない。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '住田町 令和６年度地方創生臨時交付金 充当事業一覧の「事業概要」「実施成果・効果」の列。目的の欄はないため目的は補強しない。',
};
