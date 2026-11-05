/**
 * 01231 恵庭市: 令和７年度事務事業評価調書（行政改革推進委員会 資料一式）。「【１．事業概要】」の「事業目的」の段落を目的、
 * 「事業内容」の段落を事業内容として収録する（「事業目的」「事業内容」「事業手法」の見出しが空行区切りで順に並ぶ調書だけ）。
 * 欄の見出しが欄の縦中央に出るため、目的の段落に事業内容の箇条（「・」で始まる行）が入り込む調書（№3 市内消費拡大事業費）は
 * 欄の境目が確定しないため採らない。事業目的達成度の説明は縦書きの見出しの字が本文の行に入るため採らない。
 * 事業名は調書の2ページ目の「事業名」の欄（公開済みレコードと同じ表記・位置）。年度は公開済みレコードと同じ（評価年度 令和7年度）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinLines, sheetRecord } from './m21-util';

const HEAD = /\n令和 ?７年度事務事業評価調書\n\n（様式１）\n/g;
const PARA = '((?:[^\\n]+\\n)*?[^\\n]+)';
const BODY = new RegExp(`\\n事業目的\\n\\n${PARA}\\n\\n事業内容\\n\\n${PARA}\\n\\n事業手法\\n`);
/** 調書ごとの事業名（2ページ目の「事業名」の欄の原文）。 */
const NAMES = [
  { raw: '恵庭市FMCサービス導入事業（公用スマホ）', after: '\n事業名 ' },
  { raw: '交通安全運動推進委員会補助金・交通安全\n協会補助金・交通安全指導員会補助金', after: '\n事業名\n\n' },
];

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01231' || !/\/siryouissiki0119\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const m = BODY.exec(seg);
    if (!m || m[1].split('\n').some(l => /^・/.test(l))) continue;
    const name = NAMES.find(n => seg.includes(n.after + n.raw + '\n'));
    if (!name) continue;
    const nameAt = start + seg.indexOf(name.after + name.raw + '\n') + name.after.length;
    const pAt = start + m.index! + m[0].indexOf(m[1]), aAt = pAt + m[1].length + '\n\n事業内容\n\n'.length;
    out.push(sheetRecord(input, `eniwa:${i}`, { value: joinLines(name.raw), raw: name.raw, at: nameAt },
      { evaluationYear: 2025, evaluatedFiscalYear: null }, null,
      [{ key: 'purpose', raw: m[1], at: pAt }, { key: 'activities', raw: m[2], at: aAt, value: m[2] }],
      '恵庭市 令和７年度事務事業評価調書の「事業目的」を目的（PDFの改行を除いた）、「事業内容」を事業内容（行の区切りはそのまま）として収録。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '恵庭市 令和７年度事務事業評価調書の「事業目的」「事業内容」の欄（欄の境目が確定する調書のみ）。事業目的達成度の説明（縦書きの見出しが混在）は対象外。',
};
