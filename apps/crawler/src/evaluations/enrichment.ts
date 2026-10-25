/**
 * Enrichment of already-published records from detailed evaluation sheets of the same business.
 * A published record keeps its ID, name and years; an enrichment may only add amounts, indicators,
 * ratings and evidence, and fill an empty department. Every enrichment pins the SHA-256 of the record
 * it extends, and anything that disagrees with a published value is refused rather than overwritten.
 */
import { createHash } from 'node:crypto';
import type { EvaluationAmount, EvaluationDataset, EvaluationEvidence, EvaluationIndicator, EvaluationRating, EvaluationSourceStatus, ProjectEvaluation } from '../../../web/src/types/evaluation';

export const ENRICHMENT_WARNING = '別資料（同じ事業の評価シート）の原文から、金額・指標・評価・所管を補強した。補強した値の根拠は各値の出典に記録。';
export interface EnrichmentAdd {
  department: string | null;
  amounts: EvaluationAmount[];
  indicators: EvaluationIndicator[];
  ratings: EvaluationRating[];
  evidence: EvaluationEvidence[];
}
export interface Enrichment { targetId: string; targetRecordSha256: string; sheetId: string; add: EnrichmentAdd }
export interface EnrichmentInput {
  schemaVersion: 1; kind: 'evaluation_enrichment'; generatedAt: string; municipalityCode: string;
  enrichments: Enrichment[];
  /** Source entries for the sheets used as evidence; they own no records (projectCount 0). */
  sources: EvaluationSourceStatus[];
}
export interface EnrichmentSkip { sheetId: string; reason: 'no_match' | 'ambiguous_match' | 'shared_target' | 'conflict' | 'nothing_to_add'; targetId?: string }

const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value) + '\n').digest('hex');
export const recordSha256 = (p: ProjectEvaluation) => sha256(p);
const norm = (v: string | null) => v?.normalize('NFKC').replace(/\s/g, '') ?? null;
const samePeriod = (a: ProjectEvaluation, b: ProjectEvaluation): boolean | null =>
  a.evaluatedFiscalYear !== null && b.evaluatedFiscalYear !== null ? a.evaluatedFiscalYear === b.evaluatedFiscalYear
    : a.evaluationYear !== null && b.evaluationYear !== null ? a.evaluationYear === b.evaluationYear : null;
const departmentsCompatible = (a: string | null, b: string | null) => {
  const x = norm(a), y = norm(b);
  return !x || !y || x.includes(y) || y.includes(x);
};
const amountKey = (a: EvaluationAmount) => `${a.kind}\u0000${a.fiscalYear}`;
const indicatorKey = (i: EvaluationIndicator) => `${norm(i.name)}\u0000${i.fiscalYear}`;
const ratingKey = (r: EvaluationRating) => `${r.kind}\u0000${norm(r.label)}`;

/** Additions of `sheet` to `target`, or 'conflict' when a shared key carries a different published value. */
export function additions(target: ProjectEvaluation, sheet: ProjectEvaluation): EnrichmentAdd | 'conflict' {
  const amounts = new Map(target.amounts.map(a => [amountKey(a), a]));
  const indicators = new Map(target.indicators.map(i => [indicatorKey(i), i]));
  const ratings = new Map(target.ratings.map(r => [ratingKey(r), r]));
  const add: EnrichmentAdd = { department: null, amounts: [], indicators: [], ratings: [], evidence: [] };
  for (const a of sheet.amounts) {
    const old = amounts.get(amountKey(a));
    if (old) { if (old.amountYen !== a.amountYen) return 'conflict'; continue; }
    if (a.fiscalYear === null) continue;
    add.amounts.push(a); amounts.set(amountKey(a), a);
  }
  for (const i of sheet.indicators) {
    const old = indicators.get(indicatorKey(i));
    if (old) { if (old.target !== i.target || old.actual !== i.actual) return 'conflict'; continue; }
    add.indicators.push(i); indicators.set(indicatorKey(i), i);
  }
  for (const r of sheet.ratings) {
    const old = ratings.get(ratingKey(r));
    if (old) { if (norm(old.value) !== norm(r.value)) return 'conflict'; continue; }
    add.ratings.push(r); ratings.set(ratingKey(r), r);
  }
  if (!target.department && sheet.department) add.department = sheet.department;
  if (add.amounts.length || add.indicators.length || add.ratings.length || add.department) add.evidence = sheet.evidence;
  return add;
}

/** One-to-one matching by name and a known, equal period; department only has to be compatible. */
export function buildEnrichments(published: ProjectEvaluation[], sheets: ProjectEvaluation[]): { enrichments: Enrichment[]; skipped: EnrichmentSkip[] } {
  const skipped: EnrichmentSkip[] = [];
  const pairs: { sheet: ProjectEvaluation; target: ProjectEvaluation }[] = [];
  for (const sheet of sheets) {
    const candidates = published.filter(p => norm(p.projectName) === norm(sheet.projectName) && samePeriod(p, sheet) === true && departmentsCompatible(p.department, sheet.department));
    if (!candidates.length) { skipped.push({ sheetId: sheet.id, reason: 'no_match' }); continue; }
    if (candidates.length > 1) { skipped.push({ sheetId: sheet.id, reason: 'ambiguous_match' }); continue; }
    pairs.push({ sheet, target: candidates[0] });
  }
  // Reprints of one sheet (e.g. a department volume and the combined volume) may describe the same target; they are
  // accepted only when they add exactly the same values, and the first sheet in ID order supplies the evidence.
  const strip = (a: EnrichmentAdd) => JSON.stringify({ ...a, evidence: [], amounts: a.amounts.map(({ evidence: _e, ...x }) => x),
    indicators: a.indicators.map(({ evidence: _e, ...x }) => x), ratings: a.ratings.map(({ evidence: _e, ...x }) => x) });
  const byTarget = new Map<string, { sheet: ProjectEvaluation; target: ProjectEvaluation }[]>();
  for (const pair of pairs) byTarget.set(pair.target.id, [...(byTarget.get(pair.target.id) ?? []), pair]);
  const enrichments: Enrichment[] = [];
  for (const group of byTarget.values()) {
    group.sort((a, b) => a.sheet.id.localeCompare(b.sheet.id));
    const { sheet, target } = group[0];
    if (group.length > 1) {
      const variants = group.map(g => additions(g.target, g.sheet));
      if (variants.some(v => v === 'conflict') || new Set(variants.map(v => strip(v as EnrichmentAdd))).size > 1) {
        for (const g of group) skipped.push({ sheetId: g.sheet.id, reason: 'shared_target', targetId: target.id });
        continue;
      }
    }
    const add = additions(target, sheet);
    if (add === 'conflict') { skipped.push({ sheetId: sheet.id, reason: 'conflict', targetId: target.id }); continue; }
    if (!add.evidence.length) { skipped.push({ sheetId: sheet.id, reason: 'nothing_to_add', targetId: target.id }); continue; }
    enrichments.push({ targetId: target.id, targetRecordSha256: recordSha256(target), sheetId: sheet.id, add });
  }
  enrichments.sort((a, b) => a.targetId.localeCompare(b.targetId));
  return { enrichments, skipped };
}

function check(x: unknown, message: string): asserts x { if (!x) throw new Error(message); }
/** Applies one municipality's enrichments to its composed dataset; refuses drift, conflicts and identity changes. */
export function applyEnrichments(dataset: EvaluationDataset, input: EnrichmentInput): EvaluationDataset {
  check(input.schemaVersion === 1 && input.kind === 'evaluation_enrichment', 'Invalid enrichment input');
  const projects = dataset.projects.map(p => p);
  const index = new Map(projects.map((p, i) => [p.id, i]));
  const seen = new Set<string>();
  for (const e of input.enrichments) {
    check(!seen.has(e.targetId), `Repeated enrichment target: ${e.targetId}`); seen.add(e.targetId);
    const at = index.get(e.targetId); check(at !== undefined, `Enrichment target not found: ${e.targetId}`);
    const target = projects[at]; check(recordSha256(target) === e.targetRecordSha256, `Enrichment target changed: ${e.targetId}`);
    check(target.municipalityCode === input.municipalityCode, 'Enrichment municipality mismatch');
    const sheet: ProjectEvaluation = { ...target, department: e.add.department ?? target.department, amounts: e.add.amounts, indicators: e.add.indicators, ratings: e.add.ratings, evidence: e.add.evidence };
    const recheck = additions(target, sheet);
    check(recheck !== 'conflict' && recheck.amounts.length === e.add.amounts.length && recheck.indicators.length === e.add.indicators.length
      && recheck.ratings.length === e.add.ratings.length && (e.add.department === null || !target.department), `Enrichment is not purely additive: ${e.targetId}`);
    check(e.add.evidence.length > 0, 'Enrichment without evidence');
    projects[at] = { ...target, department: target.department ?? e.add.department,
      amounts: [...target.amounts, ...e.add.amounts], indicators: [...target.indicators, ...e.add.indicators],
      ratings: [...target.ratings, ...e.add.ratings], evidence: [...target.evidence, ...e.add.evidence],
      warnings: target.warnings.includes(ENRICHMENT_WARNING) ? target.warnings : [...target.warnings, ENRICHMENT_WARNING] };
  }
  const known = new Set(dataset.sources.map(s => s.id));
  const sources = [...dataset.sources, ...input.sources.filter(s => !known.has(s.id))];
  for (const s of input.sources) check(s.extractedProjects === 0 && s.documents.every(d => d.projectCount === 0), 'Enrichment sources must not own records');
  return { ...dataset, projects, sources };
}
