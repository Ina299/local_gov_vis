/**
 * 33207 井原市: デジタル田園都市国家構想交付金事業 効果検証（令和６年度）。目的の欄はなく、「（３）事業概要」を事業内容、
 * 「（４）事業実績」を成果として収録する。事業実績は1つの段落の文章（箇条・ページ番号を含まない）で、
 * 空行または【】の見出しで終わる場合だけ採る。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinWrapped, sheetRecord, type Field } from './m26-util';

const ITEM = /\n（１）事業の名称\n([^\n]+)\n（２）事 業 費[\s\S]*?\n（３）事業概要\n((?:[^\n]+\n)+?)（４）事業実績\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '33207' || !/\/uploaded\/attachment\/9847\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const t = input.text;
  if (!t.startsWith('デジタル田園都市国家構想交付金事業\n効果検証\n＜令和６年度＞\n')) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(ITEM)) {
    if (m[0].indexOf('\n（１）事業の名称\n', 1) > 0) continue;
    const sumAt = m.index! + m[0].lastIndexOf(m[2]), sum = m[2].slice(0, -1);
    const fields: Field[] = [{ key: 'activities', pieces: [{ raw: sum, at: sumAt }], value: joinWrapped(sum.split('\n')) }];
    const after = m.index! + m[0].length, r = /^((?:[^\n]+\n)*?[^\n]+)\n(?:\n|【)/.exec(t.slice(after));
    if (r && !/- \d+ -|^[〇○①-⑳・◇柱]/m.test(r[1])) fields.push({ key: 'outcomes', pieces: [{ raw: r[1], at: after }], value: joinWrapped(r[1].split('\n')) });
    out.push(sheetRecord(input, `${m.index}`, { value: m[1], raw: m[1], at: m.index! + '\n（１）事業の名称\n'.length },
      { evaluationYear: null, evaluatedFiscalYear: 2024 }, null, fields,
      '井原市 デジタル田園都市国家構想交付金事業 効果検証（令和６年度）の「事業概要」を事業内容、文章だけの「事業実績」を成果として収録（PDFの折り返しの改行を除いた）。目的の欄はない。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '井原市 デジタル田園都市国家構想交付金事業 効果検証（令和６年度）の「事業概要」と、文章だけの「事業実績」。目的の欄はない。',
};
