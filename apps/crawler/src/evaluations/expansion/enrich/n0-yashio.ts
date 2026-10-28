import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project, stableId } from '../shared';
import { amount, nfkc, num } from '../batch9/i1-util';

// ------------------------------------------------------------------ 八潮市（令和7年度 事務事業評価シート、対象：R6年度実施事業）
// 職員人件費（B）・総事業費（A+B）が1行4列で並ぶ様式は既存レコードで収録済み。ここでは列ごとに縦に割れた様式だけを、
// 列ごとの「職員数・職員人件費（B）・総事業費（A+B）・人件費率」の検算と、R6決算列の予算執行率（事業費のR6決算/R6予算）で列を確定して読む。
const HEAD = '事務事業評価シート（対象：R6年度実施事業）\n';
const COLUMN = /\n(\d+\.\d\d)\n(\d{1,3}(?:,\d{3})*)\n(\d{1,3}(?:,\d{3})*)\n(\d+\.\d)%\n/g;

export function extractYashioSheets(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11234' || input.format !== 'pdf' || !input.text.startsWith(HEAD)) return [];
  const t = input.text, starts: number[] = [];
  for (let i = t.indexOf(HEAD); i >= 0; i = t.indexOf(HEAD, i + 1)) starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const seg = t.slice(s, starts[k + 1] ?? t.length);
    if (!seg.includes('■事業の評価 （R6年度の事後評価）')) return;
    const h = seg.match(/\n事務事業名 ([^\n]+)\n/);
    if (!h || /^(所属コード|位置付け|主要事業|部|課)/.test(h[1])) return;
    const cols = [...seg.matchAll(COLUMN)].filter(m => num(m[3]) > 0 && Math.abs(Math.round(num(m[2]) / num(m[3]) * 1000) / 10 - Number(m[4])) < 0.051);
    if (cols.length !== 4) return;
    const label = (x: string) => seg.indexOf(`\n${x}\n`);
    const r5 = label('R5決算'), r6b = label('R6予算'), r6a = label('R6決算');
    if (r5 < 0 || r6b < r5 || r6a < r6b) return;
    const c1 = cols.filter(m => m.index! > r5 && m.index! < r6b), c2 = cols.filter(m => m.index! > r6b && m.index! < r6a), c3 = cols.filter(m => m.index! > r6a);
    if (c1.length !== 1 || c2.length !== 1 || !c3.length) return;
    const [a, b, c] = [c1[0], c2[0], c3[0]];
    // R6決算列の直後に印字される予算執行率（職員人件費除く）＝事業費（A）のR6決算÷R6予算。A＝総事業費−職員人件費。
    const exec = seg.slice(c.index! + c[0].length).match(/^(\d+\.\d)%\n/);
    const A = (m: RegExpMatchArray) => num(m[3]) - num(m[2]);
    if (!exec || !(A(b) > 0) || Math.abs(Math.round(A(c) / A(b) * 1000) / 10 - Number(exec[1])) >= 0.051) return;
    const name = h[1].trim();
    const p = project(input, `enrich|${name}`, name, null, h[0].slice(1), s + h.index! + 1);
    p.projectCode = null; p.id = stableId(input, `enrich|${nfkc(name)}|${s}`, null); p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, HEAD.trim(), s));
    const dept = seg.match(/\n課\n\n([^\n]+(?:課|室|局|委員会))\n/);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].trim(), s + dept.index! + 1)); }
    for (const [m, fy] of [[a, 2023], [c, 2024]] as const) {
      const raw = seg.slice(m.index! + 1, m.index! + m[0].length - 1), at = s + m.index! + 1;
      p.amounts.push(amount(input, 'personnel', fy, m[2], '円', raw, at), amount(input, 'fullCost', fy, m[3], '円', raw, at));
    }
    for (const x of ['R5決算', 'R6予算', 'R6決算']) p.evidence.push(evidence(input, x, s + label(x) + 1));
    p.evidence.push(evidence(input, `${c[0].slice(1)}${exec[0].trimEnd()}`, s + c.index! + 1));
    p.warnings.push('八潮市 事務事業評価シート（対象：R6年度実施事業）。費用表が列ごとに縦に割れた様式で、4列それぞれの職員人件費（B）÷総事業費（A+B）が人件費率と一致し、' +
      'R5決算・R6予算・R6決算の見出しの間に1列ずつ並び、R6決算列の直後の予算執行率が事業費（総事業費−職員人件費）のR6決算÷R6予算と一致する場合のみ、R5・R6決算列の職員人件費・総事業費を収録。');
    out.push(p);
  });
  return out;
}
