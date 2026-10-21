import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence } from '../shared';

export const yen = (raw: string, unit: '円' | '千円') => Number(raw.replaceAll(',', '')) * (unit === '千円' ? 1000 : 1);
export const nfkc = (s: string) => s.normalize('NFKC').replace(/\s/g, '');

export function amount(input: CachedInput, kind: EvaluationAmount['kind'], fiscalYear: number, rawValue: string, rawUnit: '円' | '千円', raw: string, start: number): EvaluationAmount {
  return { kind, fiscalYear, amountYen: yen(rawValue, rawUnit), rawValue, rawUnit, evidence: evidence(input, raw, start) };
}

/** Values only (no evidence), so reprints can be compared for agreement. */
function content(p: ProjectEvaluation): string {
  return JSON.stringify({ d: p.department, y: [p.evaluationYear, p.evaluatedFiscalYear], a: p.amounts.map(({ evidence: _e, ...a }) => a),
    i: p.indicators.map(({ evidence: _e, ...i }) => i), r: p.ratings.map(({ evidence: _e, ...r }) => r) });
}

/** Same business in the same cycle printed twice: merge evidence when values agree, drop all copies when they disagree. */
export function mergeReprints(records: ProjectEvaluation[], key: (p: ProjectEvaluation) => string): ProjectEvaluation[] {
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  for (const p of records) {
    const k = key(p), old = out.get(k);
    if (!old) { out.set(k, p); continue; }
    if (content(old) !== content(p)) { conflicts.add(k); continue; }
    old.evidence.push(...p.evidence);
    if (!old.warnings.includes('同一資料内の再掲を値の一致を確認して1件に統合。')) old.warnings.push('同一資料内の再掲を値の一致を確認して1件に統合。');
  }
  return [...out].filter(([k]) => !conflicts.has(k)).map(([, p]) => p);
}

/** Split a document into sheets starting at each occurrence of a heading. */
export function sheets(text: string, heading: string | RegExp): { start: number; text: string }[] {
  const re = typeof heading === 'string' ? new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : new RegExp(heading.source, heading.flags.includes('g') ? heading.flags : heading.flags + 'g');
  const starts = [...text.matchAll(re)].map(m => m.index!);
  return starts.map((s, i) => ({ start: s, text: text.slice(s, starts[i + 1] ?? text.length) }));
}
