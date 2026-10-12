import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from './collector';

const args = process.argv.slice(2);
const value = (name: string) => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${name}`);
  return args[index + 1];
};
async function main() {
  const accepted = new Set(['--queue', '--output', '--workers', '--delay-ms', '--execute']);
  for (let i = 0; i < args.length; i++) {
    if (!accepted.has(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
    if (args[i] !== '--execute') i++;
  }
  const queue = value('--queue');
  if (!queue) throw new Error('Usage: tsx src/source-collection/cli.ts --queue reviewed.json [--output directory] [--execute] [--workers 2] [--delay-ms 1500]');
  const result = await collect(JSON.parse(await readFile(resolve(queue), 'utf8')), {
    outputDir: resolve(value('--output') ?? fileURLToPath(new URL('../../output/source-collection', import.meta.url))),
    execute: args.includes('--execute'),
    workers: value('--workers') === undefined ? undefined : Number(value('--workers')),
    delayMs: value('--delay-ms') === undefined ? undefined : Number(value('--delay-ms')),
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.manifest && Object.values(result.manifest.entries).some(entry => ['failed', 'blocked', 'paused'].includes(entry.state))) process.exitCode = 2;
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
