/** Reproducible, network-free batch-12 review against the completed phase's exact Git tree. */
import { gunzipSync } from 'node:zlib';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvaluationDataset, ProjectEvaluation } from '../../web/src/types/evaluation';
import type { MunicipalityEvidence, DocumentText } from '../../web/src/types/evaluationEvidence';
import { sha256, type EvaluationIndex } from './evaluations/national-integration';
import { mergeSupplementalDataset } from './evaluations/supplemental-integration';
import { reviewOfflineSource } from './evaluations/expansion/offline-source-phase';
import type { CachedInput } from './evaluations/expansion/shared';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const baseline = '14566beb78508e52595176c143b595b90db0f37e';
const generatedAt = '2026-10-25T23:37:00.000Z';
export async function reviewOfflinePhase(output: string, inputsOnly = false) {
const indexBytes = gunzipSync(await readFile(join(root, 'data/evaluations/offline-source-phase-baseline-index.json.gz')));
check(sha256(indexBytes) === 'd8c443b8db204123921c4c7031aa4fbc86cbf1e98275fef3cdee97122085ad57', 'Frozen baseline index mismatch');
const index: EvaluationIndex = JSON.parse(indexBytes.toString());
const cohortBytes = await readFile(join(root, 'data/evaluations/enrichment-document-review-batch1.json'));
check(sha256(cohortBytes) === 'e621f76291cf826b1b10b6d76b38b82e7a8ba3a848ac8675f5801c816b33949d', 'Completed cohort identity mismatch');
const completed = new Set<string>(JSON.parse(cohortBytes.toString()).rows.map((r: { documentId: string }) => r.documentId));
const inventoryBytes = await readFile(join(root, 'data/evaluations/collected-sources-batch12.json'));
check(sha256(inventoryBytes) === 'be13a81b490f1866ca67ac22f7e0ea69804f4be4ce7ff17a641382640df3e7ba', 'Bounded inventory identity mismatch');
const inventory: { sourceId: string; municipalityCode: string }[] = JSON.parse(inventoryBytes.toString()).sources;
const evidenceDir = join(root, 'apps/web/public/evaluation-evidence');
const evidenceIndex = JSON.parse((await readFile(join(evidenceDir, 'index.json'))).toString());
const reviews: Record<string, unknown>[] = [];
const datasets = new Map<string, EvaluationDataset>();
const oldDatasets = new Map<string, EvaluationDataset>();
let seenText = 0;
const counts = { recordsAdded: 0, existingRecordsEnriched: 0, existingFieldsAdded: 0, amountsAdded: 0, indicatorsAdded: 0 };
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const allEvidence = (p: ProjectEvaluation) => [...p.evidence, ...p.amounts.map(x => x.evidence), ...p.indicators.map(x => x.evidence), ...p.ratings.map(x => x.evidence)];
for (const code of [...new Set(inventory.map(x => x.municipalityCode))].sort()) {
  const row = index.municipalities.find(x => x.municipalityCode === code)!;
  const oldBytes = row.datasetPath ? await readFile(join(root, 'apps/web/public', row.datasetPath)) : null;
  if (oldBytes) check(sha256(oldBytes) === row.datasetSha256 && oldBytes.length === row.datasetBytes, 'Frozen baseline shard mismatch');
  const old = oldBytes ? JSON.parse(oldBytes.toString()) as EvaluationDataset : { schemaVersion: 1 as const, generatedAt, projects: [], sources: [] };
  oldDatasets.set(code, old);
  const metadataRow = evidenceIndex.municipalities.find((x: { municipalityCode: string }) => x.municipalityCode === code);
  check(metadataRow, 'Missing metadata row');
  const metadataBytes = await readFile(join(evidenceDir, metadataRow.shardPath));
  check(sha256(metadataBytes) === metadataRow.shardSha256 && metadataBytes.length === metadataRow.shardBytes, 'Metadata integrity mismatch');
  const municipality: MunicipalityEvidence = JSON.parse(metadataBytes.toString());
  const sources = inventory.filter(x => x.municipalityCode === code).map(x => {
    const matches = municipality.sources.filter(s => s.id === x.sourceId); check(matches.length === 1, 'Source identity not unique'); return matches[0];
  });
  const inputs: CachedInput[] = [];
  const docs = new Map<string, DocumentText>();
  for (const source of sources) {
    if (source.text.status !== 'available') continue;
    check(source.text.assetPath === `documents/${source.id}.json`, 'Unexpected asset path');
    const bytes = await readFile(join(evidenceDir, source.text.assetPath));
    check(bytes.length === source.text.assetBytes && sha256(bytes) === source.text.assetSha256, 'Text asset integrity mismatch');
    const doc: DocumentText = JSON.parse(bytes.toString());
    check(doc.sourceId === source.id && doc.sourceUrl === source.url && doc.sourceSha256 === source.acquisition.sourceSha256 && doc.municipalityCode === code, 'Source binding mismatch');
    check(sha256(Buffer.from(doc.text)) === doc.textSha256 && source.text.textSha256 === doc.textSha256, 'Text content hash mismatch');
    check(source.acquisition.fetchedAt && (source.format === 'pdf' || source.format === 'html'), 'Missing acquisition time or unsupported format');
    inputs.push({ municipalityCode: code, municipalityName: row.municipalityName, sourceId: source.id, sourceUrl: doc.sourceUrl,
      sourcePageUrl: source.url, sourceSha256: doc.sourceSha256, fetchedAt: source.acquisition.fetchedAt,
      format: source.format, text: doc.text, truncated: doc.truncated });
    docs.set(source.id, doc); seenText++;
  }
  const incoming: EvaluationDataset = { schemaVersion: 1, generatedAt, sources: [], projects: [] };
  for (const source of sources) {
    const input = inputs.find(x => x.sourceId === source.id), doc = docs.get(source.id);
    const record: Record<string, unknown> = { municipalityCode: code, municipalityName: row.municipalityName, sourceId: source.id, sourceUrl: source.url,
      sourceSha256: source.acquisition.sourceSha256, fetchedAt: source.acquisition.fetchedAt,
      textSha256: doc?.textSha256 ?? null, truncated: doc?.truncated ?? null, acceptedIds: [] };
    reviews.push(record);
    if (completed.has(source.id)) { record.status = 'excluded_completed_cohort'; record.reason = 'Previously completed 578-document cohort stays closed'; continue; }
    if (!input) { record.status = 'held'; record.reason = 'No readable cached text; this is an evidence-availability condition, not a new access test'; continue; }
    if (source.verification.status !== 'verified') { record.status = 'held'; record.reason = 'Official source verification is not established'; continue; }
    if (old.projects.some(p => allEvidence(p).some(e => e.sourceUrl === input.sourceUrl || e.sha256 === input.sourceSha256))) {
      record.status = 'excluded_referenced'; record.reason = 'Already referenced by the frozen current composed annual records'; continue;
    }
    const reviewed = reviewOfflineSource(input, source.title, inputs);
    record.holds = reviewed.holds;
    record.candidateRecords = reviewed.projects.length;
    const accepted: ProjectEvaluation[] = [];
    for (const p of reviewed.projects) {
      for (const e of allEvidence(p)) {
        const src = inputs.find(x => x.sourceUrl === e.sourceUrl && x.sourceSha256 === e.sha256);
        const pos = e.cell?.match(/^extracted-text:chars:(\d+)-(\d+)$/);
        check(src && pos && src.text.slice(Number(pos[1]), Number(pos[2])) === e.rawText && e.fetchedAt === src.fetchedAt, 'Exact evidence mismatch');
      }
      const norm = (s: string | null) => (s ?? '').normalize('NFKC').replace(/\s/g, '');
      const alias = oldDatasets.get(code)!.projects.find(q => q.evaluatedFiscalYear === p.evaluatedFiscalYear
        && p.evaluatedFiscalYear !== null && p.purpose && p.activities
        && norm(q.purpose) === norm(p.purpose) && norm(q.activities) === norm(p.activities)
        && (norm(q.projectName).includes(norm(p.projectName)) || norm(p.projectName).includes(norm(q.projectName))));
      if (alias) { reviewed.holds.push({ unit: p.id, reason: `Possible same-period alias/subproject: ${alias.id}; identical purpose and activity with nested names, requires distinct-business evidence` }); continue; }
      // Use the production collision policy against both the exact baseline and this phase's accepted records.
      // Supply owners first; the production importer independently repeats the check before publication.
      const owners = inputs.filter(x => allEvidence(p).some(e => e.sourceUrl === x.sourceUrl && e.sha256 === x.sourceSha256)).map(x => ({
        id: `offline-phase-${code}-${x.sourceId}`, municipalityCode: code, municipalityName: row.municipalityName, sourcePageUrl: x.sourcePageUrl,
        evaluationYear: null, status: 'partial' as const, discoveredDocuments: 1, fetchedDocuments: 1, extractedProjects: x.sourceId === input.sourceId ? 1 : 0,
        scope: '保存済み本文の完結した個票・明示された文章項目のみ。全国・冊子全体の網羅性は未確認。',
        message: '新規取得なし。金額・指標の列対応は推測せず未抽出。', lastAttemptAt: x.fetchedAt, lastSuccessAt: x.fetchedAt,
        documents: [{ url: x.sourceUrl, format: x.format, status: 'partial' as const, sha256: x.sourceSha256, fetchedAt: x.fetchedAt, projectCount: x.sourceId === input.sourceId ? 1 : 0, message: '原文文字位置・ハッシュ照合済み' }],
      }));
      const single: EvaluationDataset = { schemaVersion: 1, generatedAt, projects: [p], sources: owners };
      try {
        const trial = mergeSupplementalDataset(oldDatasets.get(code)!, single, generatedAt);
        if (trial.decisions[0].status !== 'added') { reviewed.holds.push({ unit: p.id, reason: 'Identical annual record/reprint already present' }); continue; }
        oldDatasets.set(code, trial.dataset);
        const merged = mergeSupplementalDataset(incoming, single, generatedAt); Object.assign(incoming, merged.dataset);
        accepted.push(p); counts.recordsAdded++;
      } catch (error) {
        const reason = (error as Error).message;
        if (!reason.startsWith('Identity collision')) throw error;
        reviewed.holds.push({ unit: p.id, reason });
      }
    }
    record.acceptedIds = accepted.map(p => p.id);
    record.status = accepted.length ? (reviewed.holds.length ? 'partially_accepted' : 'accepted') : 'held';
  }
  if (incoming.projects.length) datasets.set(code, incoming);
}
await mkdir(output, { recursive: inputsOnly });
const inputDirectory = inputsOnly ? output : join(output, 'inputs');
if (!inputsOnly) await mkdir(inputDirectory);
for (const [code, dataset] of datasets) await writeFile(join(inputDirectory, `${code}.json`), JSON.stringify(dataset) + '\n');
const audit = { schemaVersion: 1, phase: 'new-offline-sources-batch12', baseline, baselineIndexSha256: sha256(indexBytes),
  generatedAt, offlineOnly: true, sourceRequests: 0, inventorySha256: sha256(inventoryBytes), completedCohortSha256: sha256(cohortBytes),
  scope: 'All 111 batch-12 inventory entries; only unreferenced cached individual sheets outside the completed 578-document cohort. No nationwide completeness claim.',
  inventoryEntries: inventory.length, verifiedTextAssets: seenText, municipalitiesWithAdditions: datasets.size, ...counts, reviews };
await writeFile(join(output, inputsOnly ? '../offline-source-audit.json' : 'audit.json'), JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify({ ...counts, municipalities: [...datasets].map(([code, d]) => ({ code, added: d.projects.length })), inventoryEntries: inventory.length, verifiedTextAssets: seenText }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--output-dir') throw new Error('Use --output-dir <new directory>');
  await reviewOfflinePhase(resolve(args[1]));
}
