import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, project } from '../shared';
import { amount, municipality, normalize, num, rating } from './g4-util';

const HEAD = '事務事業評価シート（対象：R6年度実施事業）\n';
const LIST = '2320a3516b6eabf6fb0d8bd3';
const N = '[\\d,]+';
const LABEL = /^(所属コード|位置付け|主要事業|部|課|施策の柱|実施主体|■)/;

/** Yashio 事務事業評価シート (R6年度実施事業の事後評価). */
function sheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.format !== 'pdf' || !t.startsWith(HEAD)) return [];
  const starts: number[] = [];
  for (let i = t.indexOf(HEAD); i >= 0; i = t.indexOf(HEAD, i + 1)) starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const seg = t.slice(s, starts[k + 1] ?? t.length);
    if (!seg.includes('■事業の評価 （R6年度の事後評価）')) return; // last sheet cut off by truncation
    const h = seg.match(/\n事務事業名 ([^\n]+)\n/) ?? seg.match(/\n事務事業名\n\n(?:所属コード \d+\n\n)?([^\n]+)\n/);
    if (!h || LABEL.test(h[1])) return;
    const name = h[1].trim(), dept = seg.match(/\n課\n\n([^\n]+(?:課|室|局|委員会))\n/);
    const p = project(input, `${name}|${dept?.[1] ?? ''}`, name, null, h[0].slice(1), s + h.index! + 1);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    p.department = dept?.[1] ?? null;
    p.warnings.push('シートに評価実施年度の記載がないため評価年度は未設定（対象はR6年度実施事業）。活動・成果指標と財源内訳の表は列の対応が確定できないため未構造化。');
    // Personnel (B) and total (A+B) rows sit on one line each; the four printed 人件費率 values must match B/(A+B) as a set.
    const c = seg.match(new RegExp(`\\n(${N} ${N} ${N} ${N})\\n(${N} ${N} ${N} ${N})\\n人件費率（B/（A\\+B））\\n([\\d.]+)%\\n([\\d.]+)%\\n([\\d.]+)%\\n([\\d.]+)%\\n`));
    if (c) {
      const B = c[1].split(' '), C = c[2].split(' ');
      const rates = [3, 4, 5, 6].map(i => Number(c[i])).sort((a, b) => a - b);
      const calc = B.map((b, i) => Math.round(num(b) / num(C[i]) * 1000) / 10).sort((a, b) => a - b);
      if (C.every(x => num(x) > 0) && rates.every((r, i) => Math.abs(r - calc[i]) < 0.051)) {
        const raw = c[0].slice(1), at = s + c.index! + 1;
        p.amounts.push(amount(input, 'personnel', 2023, B[0], '円', raw, at), amount(input, 'personnel', 2024, B[2], '円', raw, at),
          amount(input, 'fullCost', 2023, C[0], '円', raw, at), amount(input, 'fullCost', 2024, C[2], '円', raw, at));
        const A = C.map((x, i) => (num(x) - num(B[i])).toLocaleString('en-US'));
        const line = seg.indexOf(`\n${A.join(' ')}\n`);
        const hdr = seg.match(new RegExp(`R5決算\\n(${N})\\n[\\s\\S]{0,120}?R6予算\\n(${N})\\n[\\s\\S]{0,120}?R6決算\\n(${N})\\n[\\s\\S]{0,120}?R7予算\\n(${N})\\n`));
        const a = line >= 0 ? { raw: A.join(' '), at: s + line + 1, v: A } : hdr && [1, 2, 3, 4].every(i => hdr[i] === A[i - 1]) ? { raw: hdr[0], at: s + hdr.index!, v: A } : null;
        if (a) a.v.forEach((v, i) => p.amounts.push(amount(input, i % 2 ? 'budget' : 'actual', [2023, 2024, 2024, 2025][i], v, '円', a.raw, a.at)));
        p.warnings.push('職員人件費（B）・総事業費（A+B）は人件費率の4値と一致する場合のみ、決算列（R5・R6）を収録。事業費（A）は総事業費−人件費と一致する行が本文にある場合のみ R5決算・R6予算・R6決算・R7予算の順で収録。');
      }
    }
    const once = (re: RegExp) => { const m = [...seg.matchAll(re)]; return m.length === 1 ? m[0] : null; };
    const need = once(/● ([ABC]：(?:非常に高い|高い|ある程度認められる))/g);
    if (need) p.ratings.push(rating(input, 'self', '必要性', need[1], 'A：非常に高い／B：高い／C：ある程度認められる', need[0], s + need.index!));
    const goal = once(/● ([ABC]：(?:達成した|概ね達成できた|達成できなかった)[^\n]*)/g);
    if (goal) p.ratings.push(rating(input, 'self', 'R6年度の目標達成度', goal[1], null, goal[0], s + goal.index!));
    const star = once(/\n(☆{1,3})\n/g);
    if (star) p.ratings.push(rating(input, 'self', '総合評価', star[1], '☆☆☆：順調／☆☆：概ね順調／☆：遅れ', star[1], s + star.index! + 1));
    const dir = once(/● ：([^\n]+)/g);
    if (dir) p.ratings.push(rating(input, 'self', '今後の方向性', dir[1].trim(), null, dir[0], s + dir.index!));
    out.push(p);
  });
  return out;
}

/** 令和7年度行政評価一覧表: number/department/division/name rows only, for businesses whose sheet is not in the collected sheets. */
function list(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const t = input.text;
  if (input.sourceId !== LIST || !t.startsWith('令和7年度行政評価一覧表\n')) return [];
  const covered = new Set(inputs.flatMap(sheets).map(p => normalize(p.projectName)));
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(/\n(\d{1,3})\n\n([^\s\d○]+(?:部|農業委員会))\n\n([^\s\d○]+)\n\n([^\n\d○]+)\n\n\d\n\n\d\n\n/g)) {
    if (covered.has(normalize(m[4]))) continue;
    const p = project(input, m[1], m[4], 2025, m[0].slice(1), m.index! + 1);
    p.projectCode = null; p.department = m[3];
    p.warnings.push('令和7年度行政評価一覧表の行から事業名・担当部・担当課のみ収録。一覧表のコスト・評価欄は段組みが崩れ行との対応が確定できないため未構造化。対象事業年度は一覧表に明記がないため未設定。');
    out.push(p);
  }
  return out;
}

export const yashio = municipality('11234', (input, inputs) => input.sourceId === LIST ? list(input, inputs) : sheets(input));
