/** 下妻市 (08210): 令和７年度 事務事業評価シート（令和６年度実績、部局別PDF）の「目的」「内容」欄。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードは同じ評価シートから事務事業名・担当課・評価年度（令和7年度）・実績年度（令和6年度）を取ったもの。
// 「１．事業の概要（Plan）」の見出しの後に「目的 …」「内容 …」の行が続き、「種別 …」の行で欄が終わる。
// 複数行の欄では見出しの文字が欄の中ほどの行に付くため、目的と内容の境がはっきりする並びだけを採る:
//   「目的 …」の直後が「内容 …」の行（目的は1行。ただし見出しの直前に目的の1行目がある並びは、その行と連結）。
//   内容は「内容 …」の行から「種別」の行の手前まで（内容の欄より後に他の欄はない）。
// 目的の行と内容の行の間に別の行がある並び（目的の続きか内容の1行目か決まらない）は採らない。
const HEAD = /令和([０-９\d]+)年度 事務事業評価シート（令和([０-９\d]+)年度実績） [^\n]+\n事務事業名 ([^\n]+) (\S+)\n/g;
const PLAN = /\n１．事業の概要（Plan）\n((?:[^\n]+\n)*?)種別 /;
const ascii = (s: string) => Number(s.replace(/[０-９]/g, d => String(d.charCodeAt(0) - 0xff10)));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08210' || input.format !== 'pdf' || input.truncated) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const year = 2018 + ascii(h[1]), done = 2018 + ascii(h[2]);
    if (done !== year - 1) return;
    const start = h.index, seg = t.slice(start, heads[k + 1]?.index ?? t.length);
    const plan = PLAN.exec(seg);
    if (!plan) return;
    const lines = plan[1].replace(/\n$/, '').split('\n');
    const p0 = lines.findIndex(l => l.startsWith('目的 ')), c0 = lines.findIndex(l => l.startsWith('内容 '));
    if (p0 < 0 || p0 > 1 || c0 !== p0 + 1 || lines.filter(l => /^(?:目的|内容)(?: |$)/.test(l)).length !== 2) return;
    const purpose = [...lines.slice(0, p0), lines[p0].slice(3)].join('\n'), content = [lines[c0].slice(3), ...lines.slice(c0 + 1)].join('\n');
    if (!purpose.trim() || !content.trim()) return;
    const name = h[3].trim();
    const p = project(input, `${name}:purpose`, name, year, h[0].trimEnd(), start);
    p.projectCode = null; p.department = h[4]; p.evaluatedFiscalYear = done;
    p.purpose = purpose; p.activities = content;
    p.evidence.push(evidence(input, plan[1].replace(/\n$/, ''), start + plan.index + plan[0].indexOf(plan[1])));
    p.warnings.push('事務事業評価シートの「１．事業の概要（Plan）」の目的・内容の欄の原文（改行も原文のまま。行頭の見出し「目的」「内容」だけを除いた）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '下妻市 令和７年度 事務事業評価シート（令和６年度実績）の事業の概要の目的・内容の欄（目的と内容の境が並びで確定するもののみ）。',
};
