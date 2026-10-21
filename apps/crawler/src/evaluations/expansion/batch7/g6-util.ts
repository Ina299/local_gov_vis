import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence } from '../shared';
import { BATCH7_IDS } from './g6-ids';

export type Extract = (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[];

/** Full-width digits/comma to ASCII so era years and amounts parse uniformly. */
export const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/，/g, ',');
/** Western year of 平成/令和 + number (元 = 1); null when unrecognized. */
export function eraYear(era: string, n: string): number | null {
  const base = ({ 平成: 1988, 令和: 2018, H: 1988, R: 2018 } as Record<string, number>)[era];
  if (base === undefined) return null;
  const v = n === '元' ? 1 : Number(ascii(n)); return Number.isInteger(v) && v > 0 ? base + v : null;
}
export const num = (s: string) => Number(ascii(s).replaceAll(',', ''));
export const normalize = (s: string) => s.normalize('NFKC').replace(/\s/g, '');

export function amount(input: CachedInput, kind: EvaluationAmount['kind'], fiscalYear: number | null, rawValue: string, rawUnit: '円' | '千円',
  raw: string, start: number): EvaluationAmount {
  return { kind, fiscalYear, amountYen: num(rawValue) * (rawUnit === '千円' ? 1000 : 1), rawValue, rawUnit, evidence: evidence(input, raw, start) };
}

const signature = (p: ProjectEvaluation) => JSON.stringify([p.department, p.evaluationYear, p.evaluatedFiscalYear,
  p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.ratings.map(r => [r.label, r.value]), p.indicators.map(i => [i.name, i.fiscalYear, i.target, i.actual, i.unit])]);

/**
 * Parses every batch-7 document of the municipality at once so reprints across documents are merged
 * (evidence appended) or, when their values disagree, dropped; each record is then returned only from
 * the document that holds its first evidence. Names in `excluded` collide with already-structured records.
 */
export function municipality(code: string, parse: (input: CachedInput) => ProjectEvaluation[], excluded: readonly string[] = []): Extract {
  const ids = new Set(BATCH7_IDS[code] ?? []), skip = new Set(excluded.map(normalize));
  const cache = new WeakMap<CachedInput[], Map<string, ProjectEvaluation[]>>();
  return (input, inputs) => {
    if (input.municipalityCode !== code || !ids.has(input.sourceId)) return [];
    let bySource = cache.get(inputs);
    if (!bySource) {
      const out = new Map<string, ProjectEvaluation>(), bad = new Set<string>();
      for (const doc of inputs) {
        if (doc.municipalityCode !== code || !ids.has(doc.sourceId)) continue;
        for (const p of parse(doc)) {
          if (skip.has(normalize(p.projectName))) continue;
          const key = JSON.stringify([normalize(p.projectName), p.evaluatedFiscalYear ?? p.evaluationYear]), old = out.get(key);
          if (!old) { out.set(key, p); continue; }
          if (signature(old) !== signature(p)) { bad.add(key); continue; }
          old.evidence.push(...p.evidence.filter(e => !old.evidence.some(o => o.cell === e.cell && o.sha256 === e.sha256)));
        }
      }
      bySource = new Map();
      for (const [key, p] of out) {
        if (bad.has(key)) continue;
        const url = p.evidence[0].sourceUrl, hash = p.evidence[0].sha256;
        const owner = inputs.find(d => d.sourceUrl === url && d.sourceSha256 === hash)!.sourceId;
        bySource.set(owner, [...(bySource.get(owner) ?? []), p]);
      }
      cache.set(inputs, bySource);
    }
    return bySource.get(input.sourceId) ?? [];
  };
}
