/**
 * 01396 真狩村: 教育委員会の活動状況に関する点検・評価（令和元年度）の事務事業点検・評価調書。
 * 「１．事業名等」の欄は事業目的・所管・予算科目の欄が空行で区切られた段落として並ぶ。所管・予算科目の段落
 * （「所 管」「予 算 科 目」の見出し、「教育委員会」で始まる所管、「款 …」で始まる科目）を除いて残る段落がちょうど1つの
 * ときだけ、それを事業目的の本文とする。本文の行に入り込んだ欄の見出し「事業目的」は値から除く（根拠は段落の原文）。
 * 事業概要・成果と課題の欄は「事業概要」の見出しが本文の行に入り、成果と課題が1つの欄のため収録しない。
 * 年度は公開済みレコードと同じ（対象年度 令和元年度、評価年度は未設定）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { unwrap } from './m1-util';
import { sheetRecord } from './m21-util';

const SHEET = /\n１．事業名等\n事業名 ([^\n]+)\n([\s\S]*?)\n２．事業概要及び実施状況\n/g;
/** 所管・予算科目の段落（見出しだけ、または所管・科目の値）。 */
const OTHER = /^(所 管|予\n算\n科\n目|所 管\n予\n算\n科\n目|事業目的|教育委員会\n[\s\S]*|款 [\s\S]*|①学校管理[\s\S]*|＊千円、未満四捨五入)$/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01396' || !/\/R1tenkenhyouka\.pdf$/.test(input.sourceUrl)) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(SHEET)) {
    const base = m.index! + m[0].indexOf(m[2]);
    const paras: { raw: string; at: number }[] = [];
    for (const p of m[2].matchAll(/[^\n]+(?:\n[^\n]+)*/g)) {
      if (!OTHER.test(p[0])) paras.push({ raw: p[0], at: base + p.index! });
    }
    if (paras.length !== 1) continue;
    const { raw, at } = paras[0];
    const lines = raw.split('\n').map(l => l.replace(/^事業目的 ?/, '')).filter(l => l.trim());
    if (lines.join('').length < 8) continue;
    const nameAt = m.index! + m[0].indexOf(m[1]);
    out.push(sheetRecord(input, `makkari:${nameAt}`, { value: m[1].trim(), raw: m[1], at: nameAt },
      { evaluationYear: null, evaluatedFiscalYear: 2019 }, null,
      [{ key: 'purpose', raw, at, value: unwrap(lines.join('\n')) }],
      '真狩村 事務事業点検・評価調書（令和元年度）の「事業目的」欄の本文を目的として収録（PDFの欄幅での折り返しの改行と、本文の行に入り込んだ見出し「事業目的」を除いた）。'));
  }
  return out;
}

export const entry = {
  extract,
  scope: '真狩村 事務事業点検・評価調書（令和元年度）の「事業目的」欄。事業概要（見出しが本文に混在）・成果と課題（1つの欄）は対象外。',
};
