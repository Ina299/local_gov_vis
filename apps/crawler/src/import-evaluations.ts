/** Autonomous, bounded acquisition. No API key, OCR service, scheduling or budget imports. */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importEvaluations } from './evaluations/pipeline';

const args = process.argv.slice(2);
const options: { sourceIds?: string[]; limit?: number; offline?: boolean; force?: boolean } = {};
let strict = false;
for (let index = 0; index < args.length; index++) {
  switch (args[index]) {
    case '--source': options.sourceIds = args[++index]?.split(',').filter(Boolean); if (!options.sourceIds?.length) throw new Error('--source requires IDs'); break;
    case '--limit': options.limit = Number(args[++index]); break;
    case '--offline': options.offline = true; break;
    case '--force': options.force = true; break;
    case '--strict': strict = true; break;
    case '--help':
      console.log('import:evaluations [--source sapporo,odawara,misato] [--limit 1..500] [--offline] [--force] [--strict]');
      process.exit(0);
    default: throw new Error(`Unknown argument: ${args[index]}`);
  }
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dataset = await importEvaluations({ root, ...options });
if (strict && dataset.sources.some((source) => (!options.sourceIds?.length || options.sourceIds.includes(source.id)) && source.status !== 'ok')) {
  process.exitCode = 1;
}
