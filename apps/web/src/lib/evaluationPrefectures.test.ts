import { readFileSync, readdirSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseEvaluationIndex, validateEvaluationShard } from './evaluationLoader';

const pub = new URL('../../public/', import.meta.url);
const subtle = webcrypto.subtle as unknown as SubtleCrypto;

describe('published prefecture evaluation records', () => {
  it('lists all 47 prefectures and binds every dataset to its hash, code, name and count', async () => {
    const index = parseEvaluationIndex(JSON.parse(readFileSync(new URL('evaluations-prefectures-index.json', pub), 'utf8')));
    expect(index.municipalities.map((e) => e.municipalityCode)).toEqual(Array.from({ length: 47 }, (_, i) => `${String(i + 1).padStart(2, '0')}000`));
    const files: string[] = [];
    for (const entry of index.municipalities.filter((e) => e.dataStatus === 'primary_available')) {
      const shard = await validateEvaluationShard(new Uint8Array(readFileSync(new URL(entry.datasetPath!, pub))).buffer, entry, new AbortController().signal, subtle);
      expect(shard.integrity).toBe('sha256_verified');
      for (const p of shard.dataset.projects) for (const a of p.amounts) expect(a.evidence.cell).toMatch(/^extracted-text:chars:\d+-\d+$/);
      files.push(entry.datasetPath!.slice('evaluations-prefectures/'.length));
    }
    expect(readdirSync(new URL('evaluations-prefectures/', pub)).sort()).toEqual(files.sort());
    expect(index.primaryMunicipalities).toBeGreaterThan(20);
  }, 60_000);
});
