import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, dedupe, num } from './g7-util';

const REIWA = 2018;
const CYCLE = '令和７年度行政評価（令和６年度事業の評価）の実施状況';
const N = '[\\d,]+';
const V = '[-－ー―\\d,.]+';
const nullish = (s: string) => /^[-－ー―]$/.test(s) ? null : s;
const PCT = '(?:\\n\\([^\\n]*\\))?';

/** 中野区 主要施策の成果 掲載の「令和6年度事業の行政評価」内部評価票。外部評価報告書・ヒアリング記録・施策の成果本文は対象外。 */
export function extractNakano(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13114' || input.sourceId !== 'a86e6557aff5cf3b8a9a4c41') return [];
  const cycleAt = input.text.indexOf(`\n${CYCLE}\n`);
  if (cycleAt < 0) return [];
  const heads = [...input.text.matchAll(/令和6年度事業の行政評価\n事業名/g)];
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    // The stored text is truncated, so the final sheet may be incomplete.
    if (i === heads.length - 1 && input.truncated) continue;
    const start = heads[i].index!, seg = input.text.slice(start, heads[i + 1]?.index ?? input.text.length);
    const h = seg.match(/^令和6年度事業の行政評価\n事業名(?: |\n\n)((?:[^\n]+\n)*?[^\n]+)\n\n(?:所管\n\n)?([^\n]+)\n([^\n]+)\n\n(?:所管\n\n)?事業概要/);
    if (!h) continue;
    const name = h[1].replaceAll('\n', '');
    const p = project(input, name, name, 2025, h[0], start);
    p.projectCode = null;
    p.department = `${h[2]} ${h[3]}`;
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, CYCLE, cycleAt + 1));
    // 事業のコストと人員 (千円): accept only when 支出(C) = 事業費(A) + 人件費(B) for every year.
    const costs: { y: number; a: string; b: string; c: string; raw: string; at: number }[] = [];
    const rowA = seg.match(new RegExp(`\\n事業費 \\(A\\)\\n\\n(${N})\\n\\n(${N})\\n\\n(${N})\\n`)),
      rowB = seg.match(new RegExp(`\\n人件費 \\(B\\)\\n\\n(${N})\\n\\n(${N})\\n\\n(${N})\\n`)),
      rowC = seg.match(new RegExp(`\\n支出 \\(C＝A＋B\\)\\n\\n(${N})\\n\\n(${N})\\n\\n(${N})\\n`));
    const years = seg.match(/\n4年度\n\n5年度\n\n6年度\n/);
    if (rowA && rowB && rowC && years) {
      const ok = [0, 1, 2].every(k => num(rowA[k + 1]) + num(rowB[k + 1]) === num(rowC[k + 1]));
      if (ok) for (const [row, kind] of [[rowA, 'actual'], [rowB, 'personnel'], [rowC, 'fullCost']] as const)
        for (let k = 0; k < 3; k++) p.amounts.push(amount(input, kind, REIWA + 4 + k, row[k + 1], '千円', row[0].slice(1, -1), start + row.index! + 1));
    } else {
      // Column-wise layout: labels listed once, then each year's five values (C-D, C, A, B, D) with optional (増減率) lines.
      const labels = '事業のコストと人員\n事業のコスト (C-D)\n支出 (C＝A＋B)\n事業費 (A)\n人件費 (B)\n収入 (D)\n';
      if (seg.includes(labels)) for (const m of seg.matchAll(new RegExp(`\\n([456])年度\\n(${N})${PCT}\\n(${N})${PCT}\\n(${N})${PCT}\\n(${N})${PCT}\\n(${N})${PCT}\\n`, 'g'))) {
        const [, y, net, c, a, b, d] = m;
        if (num(a) + num(b) === num(c) && num(c) - num(d) === num(net)) costs.push({ y: Number(y), a, b, c, raw: m[0].slice(1, -1), at: start + m.index! + 1 });
      }
      if (costs.length === 3 && new Set(costs.map(c => c.y)).size === 3) for (const c of costs) {
        p.amounts.push(amount(input, 'actual', REIWA + c.y, c.a, '千円', c.raw, c.at));
        p.amounts.push(amount(input, 'personnel', REIWA + c.y, c.b, '千円', c.raw, c.at));
        p.amounts.push(amount(input, 'fullCost', REIWA + c.y, c.c, '千円', c.raw, c.at));
      }
    }
    // 事業の実績・効果: rows with category label, name, unit, 4年度実績, 5年度実績, 6年度計画, 6年度実績, (増減率).
    if (seg.includes('単位 4年度実績 5年度実績 6年度計画')) for (const r of seg.matchAll(new RegExp(`\\n(活動\\n実績|単位\\nコスト|事業の\\n効果|ユーザー\\n視点)\\n\\n([^\\n]+(?:\\n[^\\n]+)?)\\n\\n([^\\n\\d]{1,6})\\n\\n(${V})\\n\\n(${V})\\n\\n(${V})\\n\\n(${V})\\n\\n\\([^\\n]*\\)\\n`, 'g'))) {
      const [, cat, iname, unit, v4, v5, plan, v6] = r;
      if (/^[-－ー―]$/.test(iname) || new RegExp(`^${V}$`).test(iname)) continue;
      const ev = evidence(input, r[0].slice(1, -1), start + r.index! + 1), label = `${cat.replace('\n', '')}：${iname.replaceAll('\n', '')}`;
      for (const [fy, target, actual] of [[2022, null, nullish(v4)], [2023, null, nullish(v5)], [2024, nullish(plan), nullish(v6)]] as const)
        if (target !== null || actual !== null) p.indicators.push({ name: label, fiscalYear: fy, target, actual, unit, evidence: ev });
    }
    const dir = seg.match(/次年度（令和８年度）予算編成に向けた評価\n【事業の方向】\n\n([^\n【]+)\n/);
    if (dir) p.ratings.push({ kind: 'self', label: '次年度（令和８年度）予算編成に向けた評価【事業の方向】', value: dir[1].trim(), scale: null,
      evidence: evidence(input, dir[0].slice(0, -1), start + dir.index!) });
    p.warnings.push('令和7年度行政評価（令和6年度事業の評価）の内部評価票。年度列「4年度〜6年度」は令和。事業費(A)を決算相当のactual、人件費(B)をpersonnel、支出(C＝A＋B)をfullCostとし、C＝A＋Bが各年度で成り立つ場合のみ収録。');
    p.warnings.push('指標は区分・指標名・単位・4列の値・増減率が連続する行のみ収録（6年度計画を目標、6年度実績を実績）。保存テキストが途中で切れているため掲載事業の一部のみ。外部評価結果は別資料で未収録。');
    out.push(p);
  }
  return dedupe(out, p => p.projectName);
}
