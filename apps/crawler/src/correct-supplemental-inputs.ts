/**
 * Reviewed correction of published supplemental inputs (offline).
 * Re-extracts the named municipalities for every batch that contains them, using
 * each batch's own generatedAt, then recomposes the overlay. Inputs of every other
 * municipality must stay byte-identical; the change is logged with its reason.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './evaluations/national-integration';
import { SUPPLEMENTAL_MANIFEST, composeSupplemental, loadBatches, loadEnrichmentBatches, loadManifest, verifySupplementalDecisionProofs, verifySupplementalEvaluations } from './evaluations/supplemental-integration';
import { verifyCoreIntegratedEvaluations } from './evaluations/national-integration';

const CORRECTIONS = 'data/evaluations/record-corrections.json';
const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const codes = arg('--codes')?.split(','), reason = arg('--reason'), quote = arg('--quote');
if (!codes?.every(c => /^\d{5}$/.test(c)) || !reason || reason.length < 20 || !quote) throw new Error('Use --codes <code,...> --reason <why> --quote <exact source text supporting the correction>');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const json = (x: unknown) => Buffer.from(JSON.stringify(x) + '\n');

const manifest = (await loadManifest(root))!;
const batches = await loadBatches(root, manifest);
const changes: { batchGeneratedAt: string; municipalityCode: string; previousInputSha256: string; inputSha256: string }[] = [];
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
      changes.push({ batchGeneratedAt: batch.generatedAt, municipalityCode: code, previousInputSha256: sha256(previous), inputSha256: sha256(bytes) });
    }
  }
} finally { rmSync(scratch, { recursive: true, force: true }); }
if (!changes.length) throw new Error('Extractors reproduce the published inputs; nothing to correct');

const base = await verifyCoreIntegratedEvaluations(root, json(manifest.originalIndex));
const context = await verifySupplementalDecisionProofs(root, batches.flatMap(b => b.distinctDecisions ?? []));
const result = composeSupplemental(base, batches, context, await loadEnrichmentBatches(root, manifest));
for (const batch of batches) for (const [code, bytes] of batch.inputs) if (codes.includes(code)) await writeFile(join(root, `data/evaluations/supplemental-inputs/${sha256(bytes)}.json`), bytes);
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
