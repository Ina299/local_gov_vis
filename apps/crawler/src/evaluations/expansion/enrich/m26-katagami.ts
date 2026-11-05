/**
 * 05211 潟上市: 事務事業評価表（令和５年度・令和７年度）。「２．事業目的・事業内容」の「意図（対象をどのような状態にしたいのか、目指す効果）」を目的、
 * 「事業の内容」を事業内容として収録する。抽出テキストでは見出しと本文の順がシートごとに前後する（本文が見出しの前に出る）ため、
 * 意図は「意 図」の縦書き見出しと「（対象をどのような状態にしたいのか、目指す効果）」の後ろ側から「※令和…年度に実施したこと」の前まで、
 * 事業の内容は見出しの直後（または区分見出しと見出しの間）の段落とする。事業名は「４．事務事業の評価」の前の事業名（公開済みレコードと同じ）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { unwrap } from './m1-util';
import { sheetRecord, type Field } from './m26-util';

const HEAD = /令和([０-９]+)年度（令和([０-９]+)年度事業実施分）潟上市事務事業評価表\n/g;
const ascii = (s: string) => Number(s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
const INTENT = /(?:意\n\n図|（対象をどのような状態にしたいのか、目指す効果）)\n\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05211' || !/\/group\/3\/R[57]_zimuzigyouhyouka\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const name = /\n事業名\n\n([^\n]+)\n\n４．事務事業の評価\n/.exec(seg), dept = /\n課名\n\n([^\n]+)\n\n(?:\d+\n\n)?班名\n/.exec(seg);
    const a = seg.indexOf('\n２．事業目的・事業内容\n'), b = seg.indexOf('\n※令和', a);
    if (!name || !dept || a < 0 || b < 0) continue;
    const base = start + a + '\n２．事業目的・事業内容\n'.length, block = seg.slice(a + '\n２．事業目的・事業内容\n'.length, b);
    const fields: Field[] = [];
    const marks = [...block.matchAll(INTENT)], last = marks.at(-1);
    if (marks.length === 2 && last) {
      const raw = block.slice(last.index! + last[0].length);
      if (raw && !raw.includes('\n\n') && !/（誰、何を対象/.test(raw)) fields.push({ key: 'purpose', pieces: [{ raw, at: base + last.index! + last[0].length }], value: unwrap(raw) });
    }
    const act = /^事業の内容\n\n((?:[^\n]+\n)*?[^\n]+)\n（誰、何を対象にしているのか）\n/.exec(block) ?? /^((?:[^\n]+\n)*?[^\n]+)\n\n事業の内容\n\n（誰、何を対象にしているのか）\n/.exec(block);
    if (act) fields.push({ key: 'activities', pieces: [{ raw: act[1], at: base + act[0].indexOf(act[1]) }], value: unwrap(act[1]) });
    if (!fields.length) continue;
    out.push(sheetRecord(input, `${start}`, { value: name[1], raw: name[1], at: start + name.index! + '\n事業名\n\n'.length },
      { evaluationYear: 2018 + ascii(heads[i][1]), evaluatedFiscalYear: 2018 + ascii(heads[i][2]) }, dept[1], fields,
      '潟上市 事務事業評価表の「２．事業目的・事業内容」のうち「意図」を目的、「事業の内容」を事業内容として収録（PDFの折り返しの改行を除いた）。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '潟上市 事務事業評価表（令和５・７年度）の「意図」（目的）と「事業の内容」。',
};
