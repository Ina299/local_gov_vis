import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence } from '../shared';

/** Full-width digits/comma to ASCII so era years and amounts parse uniformly. */
export const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/，/g, ',');
const ERA: Record<string, number> = { 平成: 1988, 令和: 2018, H: 1988, R: 2018 };
/** Western year of an era label such as 平成２９ / 令和元 / R6; null when unrecognized. */
export function eraYear(era: string, n: string): number | null {
  const base = ERA[era]; if (base === undefined) return null;
  const v = n === '元' ? 1 : Number(ascii(n)); return Number.isInteger(v) && v > 0 ? base + v : null;
}
export const num = (s: string) => Number(ascii(s).replaceAll(',', ''));
export const isNum = (s: string) => /^-?[\d,]+$/.test(ascii(s)) && /\d/.test(s);

export function amount(input: CachedInput, kind: EvaluationAmount['kind'], fiscalYear: number | null, rawValue: string, rawUnit: '円' | '千円',
  raw: string, start: number): EvaluationAmount {
  return { kind, fiscalYear, amountYen: num(rawValue) * (rawUnit === '千円' ? 1000 : 1), rawValue, rawUnit, evidence: evidence(input, raw, start) };
}

/** Merge same-key records (adding evidence) and drop keys whose values disagree. */
export function dedupe(records: ProjectEvaluation[], key: (p: ProjectEvaluation) => string): ProjectEvaluation[] {
  const sig = (p: ProjectEvaluation) => JSON.stringify([p.department, p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.ratings.map(r => [r.label, r.value]),
    p.indicators.map(i => [i.name, i.fiscalYear, i.target, i.actual])]);
  const out = new Map<string, ProjectEvaluation>(), bad = new Set<string>();
  for (const p of records) {
    const k = key(p), old = out.get(k);
    if (!old) { out.set(k, p); continue; }
    if (sig(old) !== sig(p)) { bad.add(k); continue; }
    old.evidence.push(...p.evidence.filter(e => !old.evidence.some(o => o.cell === e.cell && o.sourceUrl === e.sourceUrl)));
  }
  return [...out].filter(([k]) => !bad.has(k)).map(([, p]) => p);
}
