/**
 * 47207 石垣市: 行政評価シート（令和６年度実施事業）。「めざす目的・成果」欄を目的として収録する。
 * 欄の見出し「めざす／目的・／成果」は縦書きで1行ずつ本文の行の間（または行頭）に入るため、見出しの語だけを除いて本文をつなぐ。
 * 欄の範囲は「（課題）」で始まる行（前の欄の終わり）の次の「めざす」の行から、「事業」で始まる行（事業内容欄）の手前まで。
 * 前の欄の本文が「めざす」の行より後に続く、または見出しが順に1回ずつ現れないシートは採らない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord } from './m21-util';

const SHEET = /\n行政評価シート（令和([０-９\d]+)年度実施事業）\n事業No\. [^\n]+ 所管課 (\S+) [^\n]*\n経費区分 \S+ 事業名 ([^\n]+)\n/g;
const FIELD = /\n（課題）([^\n]*)\n(めざす(?: [^\n]*)?\n(?:[^\n]*\n)*?)事業(?: [^\n]*)?\n/;
const LABELS = ['めざす', '目的・', '成果'];

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '47207' || !/\/R7gyouseihyouka\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    if ((input.truncated && i === heads.length - 1) || !/^[６6]$/.test(h[1])) continue;
    const f = FIELD.exec(seg);
    // 「（課題）」の行の右に箇条があると、前の欄とこの欄のどちらの箇条か確定しない。
    if (!f || /^ [・○]/.test(f[1])) continue;
    const raw = f[2].slice(0, -1), lines = raw.split('\n');
    // 見出しの語は行頭に順に1回ずつ。本文はそれ以外の行と、見出しの語の後（空白の後）。
    let next = 0, ok = true;
    const pieces: string[] = [];
    for (const l of lines) {
      const label = LABELS.find(x => l === x || l.startsWith(`${x} `));
      if (label) {
        if (label !== LABELS[next]) { ok = false; break; }
        next++;
        if (l.length > label.length) pieces.push(l.slice(label.length + 1));
      } else if (LABELS.some(x => l.startsWith(x))) { ok = false; break; } else pieces.push(l);
    }
    if (!ok || next !== LABELS.length || !pieces.length) continue;
    // 欄の幅（全角50字余り）いっぱいの行の後は折り返しとしてつなぎ、それより短い行・箇条の前では改行を残す。
    const value = pieces.reduce((acc, p, k) => acc + (k > 0 && (/^[・○【]/.test(p) || pieces[k - 1].length < 48) ? '\n' : '') + p, '');
    if (value.replace(/\s/g, '').length < 6) continue;
    const nameAt = start + h[0].lastIndexOf(h[3]);
    out.push(sheetRecord(input, `${start}`, { value: h[3].trim(), raw: h[3], at: nameAt }, { evaluationYear: null, evaluatedFiscalYear: 2024 }, h[2],
      [{ key: 'purpose', raw, at: start + f.index! + f[0].indexOf(f[2], 4), value }],
      '石垣市 行政評価シート（令和６年度実施事業）の「めざす目的・成果」欄を収録。縦書きの欄見出し（めざす／目的・／成果）を除き、PDFの折り返しの改行を除いた。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '石垣市 行政評価シート（令和６年度実施事業）の「めざす目的・成果」欄（欄の範囲が「（課題）」の行と事業内容欄の間で確定するもの）。',
};
