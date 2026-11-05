/**
 * 43432 西原村: 令和5年度 物価高騰対応重点支援地方創生臨時交付金活用事業一覧。目的の欄はない。
 * 抽出テキストで事業名・所管・事業概要・事業始期・終期が事業ごとに続けて並ぶ部分から、「事業概要」の段落を事業内容として収録する。
 * 事業費・実施状況（実績）・効果（成果）の列も同じ順に続く事業（「＜事業費＞」で始まる実績の段落の次の段落の後が次の事業の番号）に限り、
 * 「効果（成果）」の段落を成果として収録する。令和6年度の一覧は事業名・概要の列が行ごとに混在するため採らない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinWrapped, sheetRecord, type Field } from './m26-util';

const ROW = /\n\n(?:\d+\n\n)?((?:[^\n]+\n)*?[^\n]+)\n\n([^\n]{1,8}(?:課|委員会))\n\n((?:[^\n]+\n)*?[^\n]+)\n\nR\d+\.\d+\n\nR\d+\.\d+\n/g;
const RESULT = /^\n[\d,]+\n\n[\d,]+\n\n＜事業費＞\n(?:[^\n]+\n)*?[^\n]+\n\n((?:[^\n]+\n)*?[^\n]+)\n\n\d+\n\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '43432' || !/\/kiji0031622\/3_1622_2126_up_bgxgemnr\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const t = input.text;
  if (!t.startsWith('令和5年度 物価高騰対応重点支援地方創生臨時交付金活用事業一覧\n')) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(ROW)) {
    const nameAt = m.index! + m[0].indexOf(m[1]), sumAt = m.index! + m[0].indexOf(`\n\n${m[3]}\n\nR`) + 2;
    const fields: Field[] = [{ key: 'activities', pieces: [{ raw: m[3], at: sumAt }], value: joinWrapped(m[3].split('\n')) }];
    const after = m.index! + m[0].length, r = RESULT.exec(t.slice(after));
    if (r) fields.push({ key: 'outcomes', pieces: [{ raw: r[1], at: after + r[0].lastIndexOf(r[1]) }], value: joinWrapped(r[1].split('\n')) });
    out.push(sheetRecord(input, `${nameAt}`, { value: m[1].replaceAll('\n', ''), raw: m[1], at: nameAt }, { evaluationYear: null, evaluatedFiscalYear: 2023 }, m[2],
      fields, '西原村 令和5年度 臨時交付金活用事業一覧の「事業概要」（事業内容）と、列が事業ごとに続けて並ぶ場合の「効果（成果）」を収録（PDFの折り返しの改行を除いた）。目的の欄はない。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '西原村 令和5年度 物価高騰対応重点支援地方創生臨時交付金活用事業一覧の「事業概要」と「効果（成果）」（列の対応が確定する事業だけ）。目的の欄はない。',
};
