/**
 * Reviewed correction of published supplemental inputs (offline).
 * Re-extracts the named municipalities for every batch that contains them, using
 * each batch's own generatedAt, rebuilds the enrichments of those municipalities with
 * enrich-evaluations.ts at each enrichment batch's generatedAt, then recomposes the overlay. Inputs of every other
 * municipality must stay byte-identical; the change is logged with its reason.
 * enrich-evaluations.ts composes the published records from the manifest on disk, so each corrected input is written
 * and pinned in the manifest before the next enrichment batch is rebuilt (its targets are the corrected records). The
 * manifest is restored if the correction fails.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './evaluations/national-integration';
import { ENRICHMENT_INPUTS, SUPPLEMENTAL_MANIFEST, composeSupplemental, loadBatches, loadEnrichmentBatches, loadManifest, verifySupplementalDecisionProofs, verifySupplementalEvaluations } from './evaluations/supplemental-integration';
import { verifyCoreIntegratedEvaluations } from './evaluations/national-integration';

const CORRECTIONS = 'data/evaluations/record-corrections.json';
const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const codes = arg('--codes')?.split(','), reason = arg('--reason'), quote = arg('--quote');
if (!codes?.every(c => /^\d{5}$/.test(c)) || !reason || reason.length < 20 || !quote) throw new Error('Use --codes <code,...> --reason <why> --quote <exact source text supporting the correction>');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const json = (x: unknown) => Buffer.from(JSON.stringify(x) + '\n');

const manifestPath = join(root, SUPPLEMENTAL_MANIFEST), originalManifest = readFileSync(manifestPath);
const manifest = (await loadManifest(root))!;
/** 訂正した入力を書き出し、ディスク上のマニフェストの参照を差し替える（後の補強の作り直しが訂正後のレコードを読むように）。 */
function pin(entry: { municipalityCode: string; sha256: string; path: string; bytes: number }, dir: string, bytes: Buffer) {
  const hash = sha256(bytes);
  writeFileSync(join(root, `${dir}/${hash}.json`), bytes);
  Object.assign(entry, { sha256: hash, path: `${dir}/${hash}.json`, bytes: bytes.length });
  writeFileSync(manifestPath, json(manifest));
}
const batches = await loadBatches(root, manifest);
const enrichmentBatches = await loadEnrichmentBatches(root, manifest);
const changes: { batchGeneratedAt: string; municipalityCode: string; previousInputSha256: string; inputSha256: string; enrichment?: true }[] = [];
const scratch = mkdtempSync(join(tmpdir(), 'supplement-correction-'));
try {
  for (const [i, batch] of batches.entries()) {
    for (const code of codes) {
      const previous = batch.inputs.get(code);
      if (!previous) continue;
      const out = join(scratch, `batch-${i}`, 'shards');
      execFileSync(process.execPath, ['--import', 'tsx', join(root, 'apps/crawler/src/extract-cached-evaluation-supplements.ts'),
        '--output-dir', out, '--generated-at', batch.generatedAt, '--codes', code], { stdio: 'pipe' });
      const bytes = readFileSync(join(out, `${code}.json`));
      if (bytes.equals(previous)) continue;
      batch.inputs.set(code, bytes);
      pin(manifest.batches[i].inputs.find(x => x.municipalityCode === code)!, 'data/evaluations/supplemental-inputs', bytes);
      changes.push({ batchGeneratedAt: batch.generatedAt, municipalityCode: code, previousInputSha256: sha256(previous), inputSha256: sha256(bytes) });
    }
  }
  // Enrichments of the same municipalities are rebuilt from the corrected sheet extractors. Each pins its target record,
  // so composeSupplemental below refuses the result if a corrected append batch changed a target.
  for (const [i, batch] of enrichmentBatches.entries()) {
    for (const code of codes) {
      const previous = batch.inputs.get(code);
      if (!previous) continue;
      const out = join(scratch, `enrichment-${i}`, 'inputs');
      execFileSync(process.execPath, ['--import', 'tsx', join(root, 'apps/crawler/src/enrich-evaluations.ts'),
        '--output-dir', out, '--generated-at', batch.generatedAt, '--codes', code], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
      const bytes = readFileSync(join(out, `${code}.json`));
      if (bytes.equals(previous)) continue;
      batch.inputs.set(code, bytes);
      pin(manifest.enrichmentBatches![i].inputs.find(x => x.municipalityCode === code)!, ENRICHMENT_INPUTS, bytes);
      changes.push({ batchGeneratedAt: batch.generatedAt, municipalityCode: code, previousInputSha256: sha256(previous), inputSha256: sha256(bytes), enrichment: true });
    }
  }
} catch (e) { writeFileSync(manifestPath, originalManifest); throw e; } finally { rmSync(scratch, { recursive: true, force: true }); }
if (!changes.length) throw new Error('Extractors reproduce the published inputs; nothing to correct');
try {
const base = await verifyCoreIntegratedEvaluations(root, json(manifest.originalIndex));
const context = await verifySupplementalDecisionProofs(root, batches.flatMap(b => b.distinctDecisions ?? []));
const result = composeSupplemental(base, batches, context, enrichmentBatches);
for (const batch of batches) for (const [code, bytes] of batch.inputs) if (codes.includes(code)) await writeFile(join(root, `data/evaluations/supplemental-inputs/${sha256(bytes)}.json`), bytes);
for (const batch of enrichmentBatches) for (const [code, bytes] of batch.inputs) if (codes.includes(code)) await writeFile(join(root, `${ENRICHMENT_INPUTS}/${sha256(bytes)}.json`), bytes);
for (const [code, bytes] of result.composed) {
  const row = result.assets.index.municipalities.find(r => r.municipalityCode === code)!;
  await writeFile(join(root, 'apps/web/public', row.datasetPath!), bytes);
}
await writeFile(join(root, SUPPLEMENTAL_MANIFEST), json(result.manifest));
await writeFile(join(root, 'apps/web/public/evaluations-index.json'), result.assets.indexBytes);
const log = await readFile(join(root, CORRECTIONS), 'utf8').then(JSON.parse, () => ({ schemaVersion: 1, corrections: [] }));
log.corrections.push({ correctedAt: new Date().toISOString(), municipalityCodes: codes, reason, quote, changes });
await writeFile(join(root, CORRECTIONS), JSON.stringify(log, null, 2) + '\n');
await verifySupplementalEvaluations(root);
console.log(JSON.stringify({ corrected: changes, primaryEvaluationRecords: result.assets.index.primaryEvaluationRecords }, null, 2));
} catch (e) { writeFileSync(manifestPath, originalManifest); throw e; }
