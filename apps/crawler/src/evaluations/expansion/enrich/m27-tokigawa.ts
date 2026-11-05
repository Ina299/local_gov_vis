import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- ときがわ町（平成29年度 教育委員会 点検・評価報告書）
// 公開済みレコードは「ときがわ町教育行政の重点施策評価調書」の「重点的に取り組む施策」の名称から作られ（evaluatedFiscalYear 2017）、
// 施策の評価が成果に入っている。調書の「目的 ・」欄（「主な取組み」の見出しの手前まで）を目的とする。
// 欄の2行目以降は欄の幅での折り返しのため、改行を除いてつなぐ。施策名が2行に折り返す調書は対象外。
const TITLE = /^平成２９年度\nときがわ町教育委員会\n点検・評価報告書\n/;
const HEAD = /^ときがわ町教育行政の重点施策評価調書 担当課 [^\n]+$/gm;
const NAME = /\n重点的に取り ・([^\n]+)\n組む施策(?: [^\n]*)?\n/;
const PURPOSE = /\n(目的 ・([^\n]+)((?:\n(?!主な取組み)[^\n]+)*))\n主な取組み/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11349' || !/\/kyouiku_iinkai\/H29kyouikuiinnkai_tenken_hyouka\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, title = TITLE.exec(t), out: ProjectEvaluation[] = [];
  if (!title) return [];
  const heads = [...t.matchAll(HEAD)];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const n = NAME.exec(seg), m = PURPOSE.exec(seg);
    if (!n || !m || m.index! < n.index!) return;
    const rest = m[3].split('\n').filter(Boolean);
    if (rest.some(l => /^(主な取組み|施策の評価|重点|[０-９\d]+ )/.test(l))) return;
    const purpose = [m[2], ...rest].join('');
    if (!/。$/.test(purpose)) return;
    const p = project(input, `H29:${n[1]}:narrative`, n[1].trim(), null, h[0], start);
    p.evaluatedFiscalYear = 2017;
    p.purpose = purpose;
    p.evidence.push(evidence(input, title[0].trimEnd(), 0), evidence(input, n[0].slice(1, -1), start + n.index! + 1), evidence(input, m[1], start + m.index! + 1));
    p.warnings.push('ときがわ町 重点施策評価調書の「目的」欄を目的として収録。欄の幅での折り返しをつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: 'ときがわ町 平成29年度 教育委員会 点検・評価報告書の重点施策評価調書: 目的。',
};
