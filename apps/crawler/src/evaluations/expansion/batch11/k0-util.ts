import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { acrossDocuments } from '../batch9/i1-util';

const norm = (s: string | null) => s?.normalize('NFKC').replace(/\s/g, '') ?? null;
function samePeriod(a: ProjectEvaluation, b: ProjectEvaluation): boolean | null {
  if (a.evaluatedFiscalYear !== null && b.evaluatedFiscalYear !== null) return a.evaluatedFiscalYear === b.evaluatedFiscalYear;
  if (a.evaluationYear !== null && b.evaluationYear !== null) return a.evaluationYear === b.evaluationYear;
  return null;
}
/** Same identity rule as the supplemental import: records that would collide with each other are all excluded. */
function collides(a: ProjectEvaluation, b: ProjectEvaluation): boolean {
  const sameName = norm(a.projectName) === norm(b.projectName);
  const sameCode = a.projectCode !== null && b.projectCode !== null && norm(a.projectCode) === norm(b.projectCode);
  if (!sameName && !sameCode) return false;
  if (samePeriod(a, b) === false) return false;
  return sameCode || !a.department || !b.department || norm(a.department) === norm(b.department);
}

const caches = new WeakMap<object, WeakMap<CachedInput[], Map<string, ProjectEvaluation[]>>>();
/**
 * Extract every document of the municipality once, merge agreeing reprints (acrossDocuments), then drop every record
 * that collides with another one. Returns only the records owned by `input`.
 */
export function municipalityRecords(input: CachedInput, inputs: CachedInput[], one: (i: CachedInput) => ProjectEvaluation[], key: (p: ProjectEvaluation) => string): ProjectEvaluation[] {
  let cache = caches.get(one);
  if (!cache) caches.set(one, cache = new WeakMap());
  let byOwner = cache.get(inputs);
  if (!byOwner) {
    byOwner = new Map();
    const owned = inputs.map(i => ({ id: i.sourceId, records: acrossDocuments(i, inputs, one, key) }));
    const all = owned.flatMap(o => o.records);
    const bad = new Set(all.filter(p => all.some(q => q !== p && collides(p, q))));
    for (const o of owned) byOwner.set(o.id, o.records.filter(p => !bad.has(p)));
    cache.set(inputs, byOwner);
  }
  return byOwner.get(input.sourceId) ?? [];
}
