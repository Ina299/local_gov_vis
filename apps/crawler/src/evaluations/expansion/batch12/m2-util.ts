import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvaluationDataset, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { municipalityRecords } from '../batch11/k0-util';
import { priorRecords } from '../run-context';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..');
const norm = (s: string | null) => s?.normalize('NFKC').replace(/\s/g, '') ?? null;

let round5: Set<string> | null = null;
/** Only documents first acquired in collection round 5 (collected-sources-batch11.json) are structured here. */
export function isRound5(input: CachedInput): boolean {
  round5 ??= new Set(JSON.parse(readFileSync(join(root, 'data/evaluations/collected-sources-batch11.json'), 'utf8')).sources.map((s: { sourceId: string }) => s.sourceId));
  return round5.has(input.sourceId);
}

// Published before this run (supplied by the runner), so a replay sees the same set.
const existing = (code: string): ProjectEvaluation[] => priorRecords(code);
function samePeriod(a: ProjectEvaluation, b: ProjectEvaluation): boolean | null {
  if (a.evaluatedFiscalYear !== null && b.evaluatedFiscalYear !== null) return a.evaluatedFiscalYear === b.evaluatedFiscalYear;
  if (a.evaluationYear !== null && b.evaluationYear !== null) return a.evaluationYear === b.evaluationYear;
  return null;
}
/** Same identity rule as the supplemental import; a new record that would collide with a published one is excluded. */
function collidesWithPublished(p: ProjectEvaluation): boolean {
  return existing(p.municipalityCode).some(old => {
    const sameName = norm(old.projectName) === norm(p.projectName);
    const sameCode = old.projectCode !== null && p.projectCode !== null && norm(old.projectCode) === norm(p.projectCode);
    if (!sameName && !sameCode) return false;
    if (samePeriod(old, p) === false) return false;
    return sameCode || !old.department || !p.department || norm(old.department) === norm(p.department);
  });
}

/**
 * Extractor for one municipality: `one` structures a single round-5 document; agreeing reprints are merged, records colliding
 * with each other or with already published records are dropped.
 */
export function municipality(one: (i: CachedInput) => ProjectEvaluation[], key: (p: ProjectEvaluation) => string) {
  const guarded = (i: CachedInput) => (isRound5(i) ? one(i) : []);
  return (input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] =>
    isRound5(input) ? municipalityRecords(input, inputs, guarded, key).filter(p => !collidesWithPublished(p)) : [];
}
