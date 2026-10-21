import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseEvaluationIndex, validateEvaluationShard } from './evaluationLoader';

/** Exercise the same reader against every checked-in release asset, not only synthetic fixtures. */
describe('local evaluation asset contract', () => {
  it('accepts the index and verifies each referenced municipality shard without changing the PR1 parser', async () => {
    const root = new URL('../../public/', import.meta.url);
    const index = parseEvaluationIndex(JSON.parse(readFileSync(new URL('evaluations-index.json', root), 'utf8')));
    let records = 0;
    let municipalities = 0;
    for (const entry of index.municipalities) {
      if (!entry.datasetPath) continue;
      const raw = readFileSync(new URL(entry.datasetPath, root));
      const bytes = new Uint8Array(raw).buffer;
      const result = await validateEvaluationShard(bytes, entry, new AbortController().signal, webcrypto.subtle as unknown as SubtleCrypto);
      expect(result.integrity).toBe('sha256_verified');
      records += result.dataset.projects.length;
      municipalities += 1;
    }
    expect(records).toBe(index.primaryEvaluationRecords);
    expect(municipalities).toBe(index.primaryMunicipalities);
  }, 60_000);
});
