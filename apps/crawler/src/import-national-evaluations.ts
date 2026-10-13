/** Deterministic local import only. Does not call the acquisition pipeline or use the network. */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importNationalEvaluations, sha256, verifyIntegratedEvaluations } from './evaluations/national-integration';

const args = process.argv.slice(2);
let sourceDirectory: string | undefined; let verify = false;
for (let index = 0; index < args.length; index++) {
  switch (args[index]) {
    case '--source-dir': sourceDirectory = args[++index]; if (!sourceDirectory || sourceDirectory.startsWith('--')) throw new Error('--source-dir requires a validated local directory'); break;
    case '--verify': verify = true; break;
    case '--help': console.log('import:national-evaluations --source-dir <validated-v19-directory> | --verify (offline only)'); process.exit(0); break;
    default: throw new Error(`Unknown argument: ${args[index]}`);
  }
}
if (verify === !!sourceDirectory) throw new Error('Choose exactly one of --source-dir <validated-v19-directory> or --verify');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const assets = verify ? await verifyIntegratedEvaluations(root) : await importNationalEvaluations({ root, sourceDirectory: resolve(sourceDirectory!) });
console.log(JSON.stringify({ verified: true, scopeMunicipalities: assets.index.scopeMunicipalities,
  primaryMunicipalities: assets.index.primaryMunicipalities, primaryEvaluationRecords: assets.index.primaryEvaluationRecords,
  indexSha256: sha256(assets.indexBytes), cohorts: assets.index.cohorts, offlineOnly: true }));
