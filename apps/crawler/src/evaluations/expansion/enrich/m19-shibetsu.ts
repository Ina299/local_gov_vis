import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 士別市（教育に関する事務の点検・評価報告書【令和５(2023)年度対象】）
// 公開済みレコード（batch8/h5-d.ts）は同じ事務事業点検・評価調書の事務事業名・所管課・決算額・評価から作られ、文章は未収録だった。
// 「事務事業の概要」欄は【目 的】【内 容】【目 標】【達成状況】【成果と課題】の小見出しで区切られた文章で、この順にそろう調書だけを対象に、
// 【目 的】を目的、【内 容】を事業内容、【成果と課題】を成果とする。【内 容】の見出しは「【内」「容】」に分かれ、本文の1行目が
// 空行を挟んで置かれることがあるため、各欄の空行と折り返しの改行を除いてつなぐ（箇条の記号で始まる行の前の改行は残す）。
const TITLE = '令和６(2024)年度\n教育に関する事務の管理及び執行状況の点検・評価に関する報告書\n【令和５(2023)年度対象】';
const NAME = /事業費（千円）\n\n((?:[^\n]*\n)*?)([^\n]+(?:\n[^\n]+)*)\n\n決算額\n\n[\d０-９,]+\n\n事務事業の概要\n/;
const LABELS = /^【目 ?的】 ?([\s\S]+?)\n【内(?: |\n\n)容】(?:\n\n)? ?([\s\S]+?)\n【目 ?標】[\s\S]+?\n【達成状況】[\s\S]+?\n【成果と課題】 ?([\s\S]+?)\n評\n\n価\n/;
const MARK = /^(・|※|[①-⑳]|（[０-９\d]+）|\([0-9]+\))/;

const join = (s: string) => s.split('\n').map(l => l.trim()).filter(l => l)
  .reduce((acc, l, i) => acc + (i > 0 && MARK.test(l) ? '\n' : '') + l, '');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01220' || input.sourceId !== '4faba1cac3ced96071b56ffe' || !input.text.includes(TITLE)) return [];
  const t = input.text, starts = [...t.matchAll(/事務事業点検・評価調書\n\n/g)].map(m => m.index!), out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    const block = t.slice(s, starts[i + 1] ?? t.length), heading = '事務事業点検・評価調書';
    const dm = block.slice(heading.length + 2).match(/^([^\n]+(?:\n[^\n]+)*?)\n\n?(?:施 策|事務事業\n)/);
    const dept = dm ? dm[1].replaceAll('\n', '') : '';
    const m = NAME.exec(block);
    if (!m || !/(?:課|センター|館|高校)$/.test(dept.split(/[・･]/).pop()!)) return;
    const o = m.index! + m[0].length, f = LABELS.exec(block.slice(o));
    if (!f || /【/.test(f[1] + f[2] + f[3])) return;
    const name = m[2].replaceAll('\n', '');
    const p = project(input, `${dept}:${name}|narrative`, name, 2024, m[2], s + m.index! + m[0].indexOf(m[2]));
    p.projectCode = `${dept}:${name}`;
    p.department = dept;
    p.evaluatedFiscalYear = 2023;
    const at = (k: number) => s + o + f.index! + f[0].indexOf(f[k]);
    p.purpose = join(f[1]);
    p.activities = join(f[2]);
    p.outcomes = join(f[3]);
    p.evidence.push(evidence(input, f[1], at(1)), evidence(input, f[2], at(2)), evidence(input, f[3], at(3)));
    p.warnings.push('令和5年度事務事業点検・評価調書の「事務事業の概要」のうち【目 的】を目的、【内 容】を事業内容、【成果と課題】を成果に収録（空行と折り返しの改行は除去）。'
      + '【目 標】【達成状況】は未収録。小見出しの並びがそろわない調書は収録しない。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '士別市 令和6(2024)年度 教育に関する事務の点検・評価報告書（令和5年度対象）の事務事業点検・評価調書: 【目 的】【内 容】【成果と課題】の文章。',
};
