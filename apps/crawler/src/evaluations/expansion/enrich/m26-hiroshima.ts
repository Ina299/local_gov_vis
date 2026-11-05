/**
 * 34100 広島市: 行財政改革の取組項目の実施状況（取組項目ごとのシート）。目的の欄はなく、「内容」欄（背景と取組の内容）を事業内容として収録する。
 * 「所管部局」（令和６年度は「所管課」）の行の後から「＜令和…年度の実施状況＞」の前までを内容欄とし、行頭（または単独の行）に入った縦の見出し「内 容」を除く。
 * 見出しがちょうど1つで、ほかの行に列の区切り（空白）がない場合だけ採る。年度は実施状況の見出しの年度（公開済みレコードと同じ）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinWrapped, sheetRecord, type Piece } from './m26-util';

const ITEM = /\n取組項目 [①-⑳] ([^\n]+)\n所管(?:部局|課) ([^\n]+)\n((?:[^\n]+\n)+?)＜令和([０-９]+)年度の実施状況＞\n/g;
const ascii = (s: string) => Number(s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '34100' || !/\/001\/018\/851\/(?:260925\/260925|250925)\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(ITEM)) {
    const pieces: Piece[] = [];
    let p = m.index! + m[0].indexOf(m[3]), labels = 0, ok = true;
    for (const l of m[3].slice(0, -1).split('\n')) {
      const label = /^内 容(?: |$)/.exec(l)?.[0] ?? '', rest = l.slice(label.length);
      if (label) labels++;
      if (rest.replace(/^・ /, '').includes(' ')) ok = false;
      if (rest) pieces.push({ raw: rest, at: p + label.length });
      p += l.length + 1;
    }
    if (!ok || labels !== 1 || !pieces.length) continue;
    out.push(sheetRecord(input, `${m.index}`, { value: m[1], raw: m[1], at: m.index! + m[0].indexOf(m[1]) },
      { evaluationYear: null, evaluatedFiscalYear: 2018 + ascii(m[4]) }, m[2],
      [{ key: 'activities', pieces, value: joinWrapped(pieces.map(x => x.raw)) }],
      '広島市 行財政改革の取組項目シートの「内容」欄を事業内容として収録（縦の見出しを除き、PDFの折り返しの改行を除いた）。目的の欄はない。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '広島市 行財政改革の取組項目シート（令和６・７年度の実施状況）の「内容」欄。目的の欄はないため目的は補強しない。',
};
