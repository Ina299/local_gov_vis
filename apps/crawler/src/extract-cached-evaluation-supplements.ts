/** Offline supplementary extraction; publication and semantic duplicate review are separate. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, verifyCoreIntegratedEvaluations } from './evaluations/national-integration';
import { composeSupplemental, loadBatches, loadManifest, verifySupplementalDecisionProofs } from './evaluations/supplemental-integration';
import type { EvaluationDataset, ProjectEvaluation } from '../../web/src/types/evaluation';
import type { EvidenceIndex, MunicipalityEvidence, DocumentText } from '../../web/src/types/evaluationEvidence';
import type { CachedInput } from './evaluations/expansion/shared';
import { supplementExtractors } from './evaluations/expansion/supplement-registry';
import { laterExtractors } from './evaluations/expansion/later-registries';
import { FULLTEXT_SINCE, PRIOR_STATE_RULE_SINCE, fullText } from './evaluations/expansion/fulltext';
import { setPriorRecords } from './evaluations/expansion/run-context';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
if (args.length !== 6 || args[0] !== '--output-dir' || args[2] !== '--generated-at' || args[4] !== '--codes'
  || !Number.isFinite(Date.parse(args[3])) || !/^\d{5}(,\d{5})*$/.test(args[5])) {
  throw new Error('Use --output-dir <directory> --generated-at <ISO timestamp> --codes <codes>');
}
const output = resolve(args[1]), generatedAt = args[3];
// This reviewed cohort uses a frozen, hash-checked composed baseline and its own bounded-sheet rules.
// Keep the common byte-for-byte reproduction entry point covering every immutable supplemental input.
if (generatedAt === '2026-10-25T23:37:00.000Z') {
  if (args[5].split(',').sort().join(',') !== '01202,13220,37206') throw new Error('Replay the offline source phase with all three reviewed municipality codes');
  const { reviewOfflinePhase } = await import('./review-offline-source-phase');
  await reviewOfflinePhase(output, true);
  process.exit(0);
}
if (generatedAt === '2026-10-26T01:55:00.000Z') {
  if (args[5].split(',').sort().join(',') !== '01204,01209,01230,01692,03203,03205,05348,07203,07214,08222,11211,11343,12213,13109,13223,14205,21216,27140,30391,42211,46223') throw new Error('Replay all reviewed cached-family municipalities');
  const { reviewCachedFamilies } = await import('./review-cached-families');
  await reviewCachedFamilies(output,true);
  process.exit(0);
}
if (generatedAt === '2026-10-26T01:12:00.000Z') {
  if (args[5].split(',').sort().join(',') !== '01230,04215,06362,08204,11208,11221,12232,13102,13109,13114,14100,34369,42212') throw new Error('Replay all thirteen systematic-inventory municipalities');
  const { reviewCachedInventory } = await import('./review-cached-inventory');
  await reviewCachedInventory(output,true);
  process.exit(0);
}
if (generatedAt === '2026-10-26T00:29:00.000Z') {
  if (args[5].split(',').sort().join(',') !== '01202,11243,12204,37206') throw new Error('Replay all four continuation/layout municipalities');
  const { reviewContinuationPhase } = await import('./review-continuation-phase');
  await reviewContinuationPhase(output, true);
  process.exit(0);
}
const priorStateRule = Date.parse(generatedAt) >= Date.parse(PRIOR_STATE_RULE_SINCE);
let priorShards: Map<string, Buffer> | undefined;
async function priorProjects(code: string): Promise<ProjectEvaluation[]> {
  if (!priorShards) {
    const manifest = await loadManifest(root);
    if (!manifest) { priorShards = (await verifyCoreIntegratedEvaluations(root)).shards; }
    else {
      const base = await verifyCoreIntegratedEvaluations(root, Buffer.from(`${JSON.stringify(manifest.originalIndex)}\n`));
      const batches = (await loadBatches(root, manifest)).filter(b => Date.parse(b.generatedAt) < Date.parse(generatedAt));
      const context = await verifySupplementalDecisionProofs(root, batches.flatMap(b => b.distinctDecisions ?? []));
      priorShards = batches.length ? composeSupplemental(base, batches, context).assets.shards : base.shards;
    }
  }
  const bytes = priorShards.get(code);
  return bytes ? (JSON.parse(bytes.toString()) as EvaluationDataset).projects : [];
}
const base = join(root, 'apps/web/public/evaluation-evidence');
const index: EvidenceIndex = JSON.parse(await readFile(join(base, 'index.json'), 'utf8'));
await mkdir(output, { recursive: true });
const audit = [];
for (const code of args[5].split(',')) {
  // Later extractors join only runs generated after they were introduced; earlier batches replay unchanged.
  const extractors = [supplementExtractors[code], ...laterExtractors.filter(r => Date.parse(generatedAt) >= Date.parse(r.since)).map(r => r.extractors[code])]
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (!extractors.length) throw new Error(`No supplement extractor for ${code}`);
  const scopes = new Map<string, string>();
  const row = index.municipalities.find(r => r.municipalityCode === code);
  if (!row) throw new Error(`Unknown municipality ${code}`);
  const metadata = await readFile(join(base, row.shardPath));
  if (sha256(metadata) !== row.shardSha256 || metadata.length !== row.shardBytes) throw new Error('Metadata integrity mismatch');
  const muni: MunicipalityEvidence = JSON.parse(metadata.toString());
  const inputs: CachedInput[] = [];
  // UTF-16 length of the published first part, for documents whose continuations were joined in.
  const firstPartLength = new Map<string, number>();
  for (const source of muni.sources) {
    if (source.text.status !== 'available' || !['pdf','html'].includes(source.format)) continue;
    // A run generated at T sees only documents acquired by T, so replaying an older batch is not changed by later collections.
    if (source.acquisition.fetchedAt && Date.parse(source.acquisition.fetchedAt) > Date.parse(generatedAt)) continue;
    if (!source.text.assetPath?.match(/^documents\/[a-f0-9]{24}\.json$/)) throw new Error('Unexpected document path');
    const bytes = await readFile(join(base, source.text.assetPath));
    if (sha256(bytes) !== source.text.assetSha256 || bytes.length !== source.text.assetBytes) throw new Error('Document integrity mismatch');
    const doc: DocumentText = JSON.parse(bytes.toString());
    if (doc.sourceId !== source.id || doc.sourceUrl !== source.url || doc.municipalityCode !== code
      || doc.sourceSha256 !== source.acquisition.sourceSha256 || sha256(Buffer.from(doc.text)) !== doc.textSha256
      || !source.acquisition.fetchedAt) throw new Error('Source identity mismatch');
    // Runs from FULLTEXT_SINCE on see the whole document; earlier batches replay with the first 120,000 characters.
    const whole = Date.parse(generatedAt) >= Date.parse(FULLTEXT_SINCE) ? await fullText(base, source, doc.text) : { text: doc.text, complete: !doc.truncated };
    inputs.push({ municipalityCode: code, municipalityName: row.municipalityName, sourceId: source.id,
      sourceUrl: source.url, sourcePageUrl: source.url, sourceSha256: doc.sourceSha256,
      fetchedAt: source.acquisition.fetchedAt, format: source.format as 'pdf'|'html', text: whole.text, truncated: !whole.complete });
    if (whole.text.length > doc.text.length) firstPartLength.set(source.id, doc.text.length);
  }
  inputs.sort((a,b) => a.sourceId.localeCompare(b.sourceId));
  if (priorStateRule) { const before = await priorProjects(code); setPriorRecords(c => { if (c !== code) throw new Error(`Prior records requested for ${c} while extracting ${code}`); return before; }); }
  const dataset: EvaluationDataset = { schemaVersion: 1, generatedAt, sources: [], projects: [] };
  const documents = [];
  const ids = new Set<string>();
  const evidenceOf = (p: ProjectEvaluation) => [...p.evidence, ...p.amounts.map(a=>a.evidence), ...p.indicators.map(i=>i.evidence), ...p.ratings.map(r=>r.evidence)];
  const skipped: { sourceId: string; error: string }[] = [];
  const extracted = inputs.map(input => ({ input, projects: extractors.flatMap(registered => {
    let found: ProjectEvaluation[];
    // In a whole-text run an extractor written for the 120,000-character text may fail; skip that pair, never guess.
    try { found = registered.extract(input, inputs); }
    catch (error) { if (!firstPartLength.size && !priorStateRule) throw error; skipped.push({ sourceId: input.sourceId, error: (error as Error).message.slice(0, 200) }); return []; }
    if (found.length && !scopes.has(input.sourceId)) scopes.set(input.sourceId, registered.scope);
    return found;
  }) }));
  // Continuation documents: records starting in the first part were already published from the
  // 120,000-character text, so only records starting in later parts are new. Earlier extractors were
  // not written for whole documents, so an identity that is ambiguous here is dropped, not resolved.
  const start = (p: ProjectEvaluation) => Number(p.evidence[0]?.cell?.match(/^extracted-text:chars:(\d+)-/)?.[1] ?? -1);
  const firstPartIds = new Set<string>(), seen = new Map<string, number>();
  for (const { input, projects } of extracted) {
    const limit = firstPartLength.get(input.sourceId);
    for (const p of projects) {
      seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
      if (limit !== undefined && start(p) < limit) firstPartIds.add(p.id);
    }
  }
  // Records of other documents were all published by earlier runs; with whole texts as context an
  // extractor may now emit them differently, which would be a correction, so they are not re-sent.
  const continuationOnly = (input: CachedInput, p: ProjectEvaluation) => {
    const limit = firstPartLength.get(input.sourceId);
    return limit !== undefined && seen.get(p.id) === 1 && start(p) >= limit && !firstPartIds.has(p.id);
  };
  // Same identity rule as the append import: a new record that shares a name (or code) and a compatible
  // period with any other record of this run may be a reprint or a different business; drop it unreviewed.
  const norm = (v: string | null) => v?.normalize('NFKC').replace(/\s/g, '') ?? null;
  const samePeriod = (a: ProjectEvaluation, b: ProjectEvaluation) => a.evaluatedFiscalYear !== null && b.evaluatedFiscalYear !== null ? a.evaluatedFiscalYear === b.evaluatedFiscalYear
    : a.evaluationYear !== null && b.evaluationYear !== null ? a.evaluationYear === b.evaluationYear : true;
  const collides = (a: ProjectEvaluation, b: ProjectEvaluation) => {
    const sameCode = a.projectCode !== null && b.projectCode !== null && norm(a.projectCode) === norm(b.projectCode);
    if (norm(a.projectName) !== norm(b.projectName) && !sameCode) return false;
    if (!samePeriod(a, b)) return false;
    return sameCode || !a.department || !b.department || norm(a.department) === norm(b.department);
  };
  // Compare with what was published before this run: recomposed from the batches generated earlier, so a replay gives the same answer.
  const prior = firstPartLength.size || priorStateRule ? await priorProjects(code) : [];
  const priorIds = new Set(prior.map(p => p.id));
  const everyRecord = [...prior, ...extracted.flatMap(x => x.projects)];
  const unambiguous = (p: ProjectEvaluation) => !everyRecord.some(q => q !== p && q.id !== p.id && collides(p, q));
  for (const { input, projects: all } of extracted) {
    // Batch 10 (before PRIOR_STATE_RULE_SINCE) replays with its original continuation-only rule.
    const projects = priorStateRule ? all.filter(p => !priorIds.has(p.id) && seen.get(p.id) === 1 && unambiguous(p))
      : firstPartLength.size ? all.filter(p => continuationOnly(input, p) && unambiguous(p)) : all;
    for (const p of projects) {
      if (ids.has(p.id)) throw new Error(`Duplicate candidate ID requires review: ${p.id}`);
      ids.add(p.id);
      if (p.municipalityCode !== code || !p.evidence.length) throw new Error('Invalid project identity or empty evidence');
      for (const e of evidenceOf(p)) {
        const src = inputs.find(d => d.sourceUrl === e.sourceUrl && d.sourceSha256 === e.sha256);
        const pos = e.cell?.match(/^extracted-text:chars:(\d+)-(\d+)$/);
        if (!src || !pos || src.text.slice(Number(pos[1]),Number(pos[2])) !== e.rawText || !e.rawText.length
          || e.fetchedAt !== src.fetchedAt) throw new Error(`Evidence mismatch: ${p.id}`);
      }
    }
    dataset.projects.push(...projects);
  }
  // ZIP members can share a download URL while containing different documents.
  const key = (url:string, hash:string) => JSON.stringify([url,hash]);
  const referenced = new Set(dataset.projects.flatMap(p=>evidenceOf(p).map(e=>key(e.sourceUrl,e.sha256))));
  for (const input of inputs.filter(i=>referenced.has(key(i.sourceUrl,i.sourceSha256)))) {
    const owns = (e: ProjectEvaluation['evidence'][number]) => e.sourceUrl===input.sourceUrl && e.sha256===input.sourceSha256;
    const count = dataset.projects.filter(p=>p.evidence[0] && owns(p.evidence[0])).length;
    const owned = dataset.projects.filter(p=>p.evidence.some(owns));
    dataset.sources.push({ id: `supplement-${code}-${input.sourceId}`, municipalityCode: code,
      municipalityName: row.municipalityName, sourcePageUrl: input.sourcePageUrl,
      evaluationYear: owned.length && owned.every(p=>p.evaluationYear===owned[0].evaluationYear) ? owned[0].evaluationYear : null,
      status: 'partial', discoveredDocuments: 1, fetchedDocuments: 1, extractedProjects: count,
      scope: scopes.get(input.sourceId) ?? extractors[0].scope, message: '追加取得なし。保存本文との完全一致を確認。PDF原本との再照合は未実施。',
      lastAttemptAt: input.fetchedAt, lastSuccessAt: input.fetchedAt,
      documents: [{ url: input.sourceUrl, format: input.format, status: 'partial', sha256: input.sourceSha256,
        fetchedAt: input.fetchedAt, projectCount: count, message: count ? '保存本文から追加候補を部分構造化' : '代表資料のレコードへ証拠を統合' }] });
    documents.push({ sourceId: input.sourceId, sourceUrl: input.sourceUrl, sourceSha256: input.sourceSha256,
      textSha256: sha256(Buffer.from(input.text)), records: count, truncated: input.truncated });
  }
  if (!dataset.projects.length) {
    // A whole-text run may find nothing beyond the published first parts; record it instead of failing.
    if (firstPartLength.size || priorStateRule) { audit.push({ code, candidateRecords: 0, sha256: null, bytes: 0, documents, skipped }); continue; }
    throw new Error(`No supplementary candidates for ${code}`);
  }
  const bytes = Buffer.from(JSON.stringify(dataset)+'\n');
  await writeFile(join(output,`${code}.json`),bytes);
  audit.push({code, candidateRecords:dataset.projects.length, sha256:sha256(bytes), bytes:bytes.length, documents, ...(skipped.length ? { skipped } : {})});
}
await writeFile(join(output,'../supplement-extraction-audit.json'),JSON.stringify({generatedAt,offlineOnly:true,municipalities:audit},null,2)+'\n');
console.log(JSON.stringify(audit.map(({documents,...r})=>({...r,documents:documents.length})),null,2));
