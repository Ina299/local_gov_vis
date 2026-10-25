/**
 * Builds (and optionally imports) additive enrichments of published records from detailed sheets of the same businesses.
 *   node --import tsx apps/crawler/src/enrich-evaluations.ts --output-dir <dir> --generated-at <ISO> --codes <c,...>
 *   node --import tsx apps/crawler/src/enrich-evaluations.ts --import <dir> --generated-at <ISO>
 * Sheets come from the later-batch extractors of each municipality, run without excluding published businesses; the
 * published state is recomposed from everything generated before --generated-at, so a replay yields the same bytes.
 */
import { mkdir, readFile, readdir, writeFile, rename, rm, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvaluationDataset, EvaluationSourceStatus, ProjectEvaluation } from '../../web/src/types/evaluation';
import type { DocumentText, MunicipalityEvidence } from '../../web/src/types/evaluationEvidence';
import { sha256, verifyCoreIntegratedEvaluations } from './evaluations/national-integration';
import { ENRICHMENT_INPUTS, SUPPLEMENTAL_MANIFEST, composeSupplemental, loadBatches, loadEnrichmentBatches, loadManifest, verifySupplementalDecisionProofs, verifySupplementalEvaluations } from './evaluations/supplemental-integration';
import { buildEnrichments, type EnrichmentInput } from './evaluations/enrichment';
import { laterExtractors } from './evaluations/expansion/later-registries';
import { FULLTEXT_SINCE, fullText } from './evaluations/expansion/fulltext';
import { setPriorRecords } from './evaluations/expansion/run-context';
import type { CachedInput } from './evaluations/expansion/shared';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const generatedAt = arg('--generated-at');
if (!generatedAt || !Number.isFinite(Date.parse(generatedAt))) throw new Error('--generated-at <ISO timestamp> is required');
const json = (x: unknown) => Buffer.from(JSON.stringify(x) + '\n');

async function publishedBefore(): Promise<Map<string, Buffer>> {
  const manifest = await loadManifest(root);
  if (!manifest) return (await verifyCoreIntegratedEvaluations(root)).shards;
  const base = await verifyCoreIntegratedEvaluations(root, json(manifest.originalIndex));
  const earlier = (b: { generatedAt: string }) => Date.parse(b.generatedAt) < Date.parse(generatedAt!);
  const batches = (await loadBatches(root, manifest)).filter(earlier);
  const context = await verifySupplementalDecisionProofs(root, batches.flatMap(b => b.distinctDecisions ?? []));
  return composeSupplemental(base, batches, context, (await loadEnrichmentBatches(root, manifest)).filter(earlier)).assets.shards;
}

async function build(output: string, codes: string[]) {
  const shards = await publishedBefore();
  const evidenceDir = join(root, 'apps/web/public/evaluation-evidence');
  const index = JSON.parse(await readFile(join(evidenceDir, 'index.json'), 'utf8'));
  await mkdir(output, { recursive: true });
  const report = [];
  for (const code of codes) {
    const extractors = laterExtractors.filter(r => Date.parse(generatedAt!) >= Date.parse(r.since)).map(r => r.extractors[code]).filter(Boolean);
    if (!extractors.length) throw new Error(`No later-batch extractor for ${code}`);
    const row = index.municipalities.find((r: { municipalityCode: string }) => r.municipalityCode === code);
    const muni: MunicipalityEvidence = JSON.parse(await readFile(join(evidenceDir, row.shardPath), 'utf8'));
    const inputs: CachedInput[] = [];
    for (const source of muni.sources) {
      if (source.text.status !== 'available' || !['pdf', 'html'].includes(source.format)) continue;
      if (source.acquisition.fetchedAt && Date.parse(source.acquisition.fetchedAt) > Date.parse(generatedAt!)) continue;
      const doc: DocumentText = JSON.parse(await readFile(join(evidenceDir, source.text.assetPath!), 'utf8'));
      const whole = Date.parse(generatedAt!) >= Date.parse(FULLTEXT_SINCE) ? await fullText(evidenceDir, source, doc.text) : { text: doc.text, complete: !doc.truncated };
      inputs.push({ municipalityCode: code, municipalityName: row.municipalityName, sourceId: source.id, sourceUrl: source.url, sourcePageUrl: source.url,
        sourceSha256: doc.sourceSha256, fetchedAt: source.acquisition.fetchedAt!, format: source.format as 'pdf' | 'html', text: whole.text, truncated: !whole.complete });
    }
    inputs.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
    // Sheets are wanted precisely because they describe published businesses, so nothing is excluded as already published.
    setPriorRecords(() => []);
    const sheets: ProjectEvaluation[] = inputs.flatMap(input => extractors.flatMap(e => e.extract(input, inputs)));
    const all = (p: ProjectEvaluation) => [...p.evidence, ...p.amounts.map(a => a.evidence), ...p.indicators.map(i => i.evidence), ...p.ratings.map(r => r.evidence)];
    for (const p of sheets) for (const e of all(p)) {
      const src = inputs.find(d => d.sourceUrl === e.sourceUrl && d.sourceSha256 === e.sha256);
      const pos = e.cell?.match(/^extracted-text:chars:(\d+)-(\d+)$/);
      if (!src || !pos || src.text.slice(Number(pos[1]), Number(pos[2])) !== e.rawText || !e.rawText.length) throw new Error(`Evidence mismatch: ${p.id}`);
    }
    const bytes = shards.get(code);
    const published: ProjectEvaluation[] = bytes ? (JSON.parse(bytes.toString()) as EvaluationDataset).projects : [];
    const publishedIds = new Set(published.map(p => p.id));
    const { enrichments, skipped } = buildEnrichments(published, sheets.filter(p => !publishedIds.has(p.id)));
    const referenced = [...new Set(enrichments.flatMap(e => [...e.add.evidence, ...e.add.amounts.map(a => a.evidence), ...e.add.indicators.map(i => i.evidence), ...e.add.ratings.map(r => r.evidence)])
      .map(e => JSON.stringify([e.sourceUrl, e.sha256])))].sort();
    const sources: EvaluationSourceStatus[] = referenced.map(k => {
      const [url, hash] = JSON.parse(k); const input = inputs.find(i => i.sourceUrl === url && i.sourceSha256 === hash)!;
      return { id: `enrichment-${code}-${input.sourceId}`, municipalityCode: code, municipalityName: row.municipalityName, sourcePageUrl: url, evaluationYear: null, status: 'partial',
        discoveredDocuments: 1, fetchedDocuments: 1, extractedProjects: 0, scope: '既存レコードの補強に使った評価シート。この資料からの新規レコードはない。',
        message: '公開済みレコードと同じ事業の評価シートから、金額・指標・評価・所管を追加。', lastAttemptAt: input.fetchedAt, lastSuccessAt: input.fetchedAt,
        documents: [{ url, format: input.format, status: 'partial', sha256: hash, fetchedAt: input.fetchedAt, projectCount: 0, message: '既存レコードの補強の根拠' }] };
    });
    const counts = skipped.reduce<Record<string, number>>((m, s) => (m[s.reason] = (m[s.reason] ?? 0) + 1, m), {});
    report.push({ code, sheets: sheets.length, enriched: enrichments.length, skipped: counts,
      added: { amounts: enrichments.reduce((n, e) => n + e.add.amounts.length, 0), indicators: enrichments.reduce((n, e) => n + e.add.indicators.length, 0),
        ratings: enrichments.reduce((n, e) => n + e.add.ratings.length, 0), departments: enrichments.filter(e => e.add.department).length } });
    if (!enrichments.length) continue;
    const input: EnrichmentInput = { schemaVersion: 1, kind: 'evaluation_enrichment', generatedAt: generatedAt!, municipalityCode: code, enrichments, sources };
    await writeFile(join(output, `${code}.json`), json(input));
  }
  await writeFile(join(output, '../enrichment-report.json'), JSON.stringify({ generatedAt, municipalities: report }, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 1));
}

async function importDir(dir: string) {
  const current = await verifySupplementalEvaluations(root);
  const manifest = (await loadManifest(root))!;
  const base = await verifyCoreIntegratedEvaluations(root, json(manifest.originalIndex));
  const batches = await loadBatches(root, manifest);
  const context = await verifySupplementalDecisionProofs(root, batches.flatMap(b => b.distinctDecisions ?? []));
  const enrichment = await loadEnrichmentBatches(root, manifest);
  if (enrichment.some(b => Date.parse(b.generatedAt) >= Date.parse(generatedAt!))) throw new Error('Enrichment batches must be imported in time order');
  const inputs = new Map<string, Buffer>();
  for (const file of (await readdir(dir)).sort()) { if (!/^\d{5}\.json$/.test(file)) throw new Error(`Unexpected file ${file}`); inputs.set(file.slice(0, 5), await readFile(join(dir, file))); }
  if (!inputs.size) throw new Error('No enrichment inputs');
  const result = composeSupplemental(base, batches, context, [...enrichment, { generatedAt: generatedAt!, inputs }]);
  if (!result.assets.index.municipalities.every((r, i) => r.primaryEvaluationRecords === current.index.municipalities[i].primaryEvaluationRecords)) throw new Error('Enrichment changed record counts');
  await mkdir(join(root, ENRICHMENT_INPUTS), { recursive: true });
  for (const bytes of inputs.values()) await writeFile(join(root, ENRICHMENT_INPUTS, `${sha256(bytes)}.json`), bytes);
  for (const [code, bytes] of result.composed) {
    const row = result.assets.index.municipalities.find(r => r.municipalityCode === code)!;
    await writeFile(join(root, 'apps/web/public', row.datasetPath!), bytes);
  }
  const stage = await mkdtemp(join(root, 'data/evaluations/.enrichment-'));
  try {
    await writeFile(join(stage, 'manifest.json'), json(result.manifest)); await writeFile(join(stage, 'index.json'), result.assets.indexBytes);
    await rename(join(stage, 'manifest.json'), join(root, SUPPLEMENTAL_MANIFEST)); await rename(join(stage, 'index.json'), join(root, 'apps/web/public/evaluations-index.json'));
  } finally { await rm(stage, { recursive: true, force: true }); }
  const verified = await verifySupplementalEvaluations(root);
  console.log(JSON.stringify({ verified: true, enrichedMunicipalities: inputs.size, primaryEvaluationRecords: verified.index.primaryEvaluationRecords }));
}

if (arg('--import')) await importDir(resolve(arg('--import')!));
else {
  const output = arg('--output-dir'), codes = arg('--codes')?.split(',');
  if (!output || !codes?.every(c => /^\d{5}$/.test(c))) throw new Error('Use --output-dir <dir> --generated-at <ISO> --codes <c,...> or --import <dir> --generated-at <ISO>');
  await build(resolve(output), codes);
}
