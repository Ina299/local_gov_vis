import type { EvaluationAmount, EvaluationIndicator, EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence } from '../shared';

export type Extract = (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[];

/** Full-width digits/comma to ASCII so amounts parse uniformly. */
export const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/，/g, ',');
export const num = (s: string) => Number(ascii(s).replace(/[,\s]/g, ''));
export const normalize = (s: string | null) => s?.normalize('NFKC').replace(/\s/g, '') ?? null;
/** Joins cell text that pdftotext wrapped onto several lines. */
export const joinLines = (s: string) => s.split('\n').map(l => l.trim()).join('');

export function amount(input: CachedInput, kind: EvaluationAmount['kind'], fiscalYear: number | null, rawValue: string, rawUnit: '円' | '千円',
  raw: string, start: number): EvaluationAmount {
  return { kind, fiscalYear, amountYen: Math.round(num(rawValue) * (rawUnit === '千円' ? 1000 : 1)), rawValue, rawUnit, evidence: evidence(input, raw, start) };
}
export function rating(input: CachedInput, kind: EvaluationRating['kind'], label: string, value: string, scale: string | null, raw: string, start: number): EvaluationRating {
  return { kind, label, value, scale, evidence: evidence(input, raw, start) };
}
export function indicator(input: CachedInput, name: string, fiscalYear: number | null, target: string | null, actual: string | null, unit: string | null,
  raw: string, start: number): EvaluationIndicator {
  return { name, fiscalYear, target, actual, unit, evidence: evidence(input, raw, start) };
}
/** Japanese era year (令和/平成, full-width or ASCII digits, 元 = 1) to the Western year. */
export function eraYear(era: string, year: string): number {
  const n = year === '元' ? 1 : Number(ascii(year));
  return era === '令和' || era === 'R' ? 2018 + n : 1988 + n;
}

const signature = (p: ProjectEvaluation) => JSON.stringify([p.projectCode, p.department, p.evaluationYear, p.evaluatedFiscalYear,
  p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.ratings.map(r => [r.label, r.value]), p.indicators.map(i => [i.name, i.fiscalYear, i.target, i.actual, i.unit])]);
const period = (p: ProjectEvaluation) => p.evaluatedFiscalYear ?? p.evaluationYear;
function samePeriod(a: ProjectEvaluation, b: ProjectEvaluation): boolean | null {
  if (a.evaluatedFiscalYear !== null && b.evaluatedFiscalYear !== null) return a.evaluatedFiscalYear === b.evaluatedFiscalYear;
  if (a.evaluationYear !== null && b.evaluationYear !== null) return a.evaluationYear === b.evaluationYear;
  return null;
}

/**
 * Parses every batch-8 document of the municipality listed in `ids` at once. Reprints (same name, department and period)
 * are merged with their evidence appended, or dropped when values disagree. Records the supplemental merge would still
 * treat as one identity (same name or code in the same/unknown period without distinct departments) are all dropped,
 * as are names in `excluded` (collisions with already-structured records). Each record is returned only from the
 * document holding its first evidence.
 */
export function municipality(code: string, ids: readonly string[], parse: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[],
  excluded: readonly string[] = []): Extract {
  const idSet = new Set(ids), skip = new Set(excluded.map(normalize));
  const cache = new WeakMap<CachedInput[], Map<string, ProjectEvaluation[]>>();
  return (input, inputs) => {
    if (input.municipalityCode !== code || !idSet.has(input.sourceId)) return [];
    let bySource = cache.get(inputs);
    if (!bySource) {
      const out = new Map<string, ProjectEvaluation>(), bad = new Set<string>();
      for (const doc of inputs) {
        if (doc.municipalityCode !== code || !idSet.has(doc.sourceId)) continue;
        for (const p of parse(doc, inputs)) {
          if (skip.has(normalize(p.projectName))) continue;
          const key = JSON.stringify([normalize(p.projectName), normalize(p.department), period(p)]), old = out.get(key);
          if (!old) { out.set(key, p); continue; }
          if (signature(old) !== signature(p)) { bad.add(key); continue; }
          old.evidence.push(...p.evidence.filter(e => !old.evidence.some(o => o.cell === e.cell && o.sha256 === e.sha256)));
        }
      }
      const kept = [...out].filter(([k]) => !bad.has(k)).map(([, p]) => p);
      const clash = (a: ProjectEvaluation, b: ProjectEvaluation) => {
        const sameName = normalize(a.projectName) === normalize(b.projectName);
        const sameCode = a.projectCode !== null && b.projectCode !== null && normalize(a.projectCode) === normalize(b.projectCode);
        if (!sameName && !sameCode) return false;
        if (samePeriod(a, b) === false) return false;
        return sameCode || !a.department || !b.department || normalize(a.department) === normalize(b.department);
      };
      const dropped = new Set<ProjectEvaluation>();
      for (let i = 0; i < kept.length; i++) for (let j = i + 1; j < kept.length; j++) if (clash(kept[i], kept[j])) { dropped.add(kept[i]); dropped.add(kept[j]); }
      bySource = new Map();
      for (const p of kept) {
        if (dropped.has(p)) continue;
        const url = p.evidence[0].sourceUrl, hash = p.evidence[0].sha256;
        const owner = inputs.find(d => d.sourceUrl === url && d.sourceSha256 === hash)!.sourceId;
        bySource.set(owner, [...(bySource.get(owner) ?? []), p]);
      }
      cache.set(inputs, bySource);
    }
    return bySource.get(input.sourceId) ?? [];
  };
}
