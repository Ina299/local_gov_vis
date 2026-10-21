import type { EvaluationAmount, EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence } from '../shared';

export type Extract = (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[];

/** batch8（第2回取得）で新規取得した担当分の sourceId（data/evaluations/collected-sources-batch8.json）。 */
export const H6_IDS: Record<string, readonly string[]> = {
  '32203': ['590db0e9bf5090cdd0071384', '601292ab924e3c5bbb6c04ef', 'd3dd687971527e2aaa53f84f', 'fe9056720cb4cd8e1762108b'],
  '30404': ['bc9aad15a27a9d02c6ea588f'],
  '01228': ['b62b6058cab8680e8bf54d82'],
  '01455': ['17f043ad64a422989a982ada'],
  '06323': ['9e166101cf251d97bb1e94b3'],
  '11361': ['b71de834d93b080f4f64d0b2'],
  '15222': ['2c691ae7907456479dcf01b4'],
  '20430': ['8ca7744069442082c01430c3'],
  '30427': ['8f482214a8c3dc0cbbaf4548'],
  '37341': ['d90e14b4cc6f4dd8866edd21'],
  '43215': ['d32485e691a01bab89168c4e'],
};

/** Full-width digits/comma to ASCII so era years and amounts parse uniformly. */
export const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/，/g, ',');
/** Western year of 平成/令和 + number (元 = 1); null when unrecognized. */
export function eraYear(era: string, n: string): number | null {
  const base = ({ 昭和: 1925, 平成: 1988, 令和: 2018, H: 1988, R: 2018, Ｈ: 1988, Ｒ: 2018 } as Record<string, number>)[era];
  if (base === undefined) return null;
  const v = n === '元' ? 1 : Number(ascii(n)); return Number.isInteger(v) && v > 0 ? base + v : null;
}
export const num = (s: string) => Number(ascii(s).replaceAll(',', ''));
export const normalize = (s: string) => s.normalize('NFKC').replace(/\s/g, '');

export function amount(input: CachedInput, kind: EvaluationAmount['kind'], fiscalYear: number | null, rawValue: string, rawUnit: '円' | '千円',
  raw: string, start: number): EvaluationAmount {
  return { kind, fiscalYear, amountYen: num(rawValue) * (rawUnit === '千円' ? 1000 : 1), rawValue, rawUnit, evidence: evidence(input, raw, start) };
}
export function rating(input: CachedInput, kind: EvaluationRating['kind'], label: string, value: string, scale: string | null, raw: string, start: number): EvaluationRating {
  return { kind, label, value, scale, evidence: evidence(input, raw, start) };
}

const signature = (p: ProjectEvaluation) => JSON.stringify([p.department, p.evaluationYear, p.evaluatedFiscalYear,
  p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.ratings.map(r => [r.label, r.value]), p.indicators.map(i => [i.name, i.fiscalYear, i.target, i.actual, i.unit])]);

/**
 * Parses every batch-8 document of the municipality at once so reprints (same name and year) are merged
 * (evidence appended) or, when their values disagree, all copies are dropped; each record is then returned
 * only from the document that holds its first evidence.
 */
export function municipality(code: string, parse: (input: CachedInput) => ProjectEvaluation[]): Extract {
  const ids = new Set(H6_IDS[code] ?? []);
  const cache = new WeakMap<CachedInput[], Map<string, ProjectEvaluation[]>>();
  return (input, inputs) => {
    if (input.municipalityCode !== code || !ids.has(input.sourceId)) return [];
    let bySource = cache.get(inputs);
    if (!bySource) {
      const out = new Map<string, ProjectEvaluation>(), bad = new Set<string>();
      for (const doc of inputs) {
        if (doc.municipalityCode !== code || !ids.has(doc.sourceId)) continue;
        for (const p of parse(doc)) {
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
