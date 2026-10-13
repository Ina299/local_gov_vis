/** Offline-only expansion from already extracted municipality datasets. */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importCachedEvaluationExpansion, sha256, verifyIntegratedEvaluations } from './evaluations/national-integration';
const args = process.argv.slice(2);
let sourceDirectory: string | undefined; let generatedAt: string | undefined; let verify = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--source-dir') sourceDirectory = args[++i];
  else if (args[i] === '--generated-at') generatedAt = args[++i];
  else if (args[i] === '--verify') verify = true;
  else throw new Error(`Unknown argument: ${args[i]}`);
}
if (verify ? !!sourceDirectory || !!generatedAt : !sourceDirectory || !generatedAt) throw new Error('Use --verify or --source-dir <directory> --generated-at <ISO timestamp>');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const assets = verify ? await verifyIntegratedEvaluations(root) : await importCachedEvaluationExpansion({ root, sourceDirectory: resolve(sourceDirectory!), generatedAt: generatedAt! });
console.log(JSON.stringify({ verified: true, offlineOnly: true, primaryMunicipalities: assets.index.primaryMunicipalities,
  primaryEvaluationRecords: assets.index.primaryEvaluationRecords, indexSha256: sha256(assets.indexBytes), cohorts: assets.index.cohorts }));
