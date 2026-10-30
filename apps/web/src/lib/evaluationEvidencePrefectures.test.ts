import { readFileSync, readdirSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isPrefectureEvaluationCode, parseEvidenceIndex, validateDocumentText, validateMunicipalityEvidence, validateTextContinuation } from './evaluationEvidenceLoader';

const root = new URL('../../public/evaluation-evidence-prefectures/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const subtle = webcrypto.subtle as unknown as SubtleCrypto;

describe('published prefecture evidence', () => {
  it('lists all 47 prefectures and binds every readable document to hashes, identities, counts and exact local paths', async () => {
    const index = parseEvidenceIndex(JSON.parse(read('index.json').toString('utf8')), 'prefecture');
    expect(index.municipalities.map((e) => e.prefectureCode)).toEqual(Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, '0')));
    expect(index.municipalities.every((e) => isPrefectureEvaluationCode(e.municipalityCode) && e.municipalityName === e.prefectureName)).toBe(true);
    const files: string[] = []; let readable = 0; let substantive = 0; let truncated = 0;
    for (const entry of index.municipalities) {
      const shard = await validateMunicipalityEvidence(new Uint8Array(read(entry.shardPath)).buffer, entry, new AbortController().signal, subtle);
      expect(shard.integrity).toBe('sha256_verified');
      for (const source of shard.data.sources) {
        expect(source.years).toEqual([]); // years are never inferred for prefecture sources
        if (source.text.status !== 'available') continue;
        files.push(`${source.id}.json`);
        const text = await validateDocumentText(new Uint8Array(read(source.text.assetPath!)).buffer, entry.municipalityCode, source, new AbortController().signal, subtle);
        expect(text.integrity).toBe('sha256_verified');
        for (const part of source.text.continuations ?? []) {
          const continuation = await validateTextContinuation(new Uint8Array(read(part.assetPath)).buffer, entry.municipalityCode, source, part.part, new AbortController().signal, subtle);
          expect(continuation.integrity).toBe('sha256_verified');
          files.push(part.assetPath.slice('documents/'.length));
        }
        readable += 1; substantive += Number(source.role === 'evaluation_document'); truncated += Number(text.data.truncated);
      }
    }
    expect(readable).toBe(index.counts.textDocuments); expect(substantive).toBe(index.counts.substantiveEvaluationTextDocuments); expect(truncated).toBe(index.counts.truncatedTextDocuments);
    expect(readdirSync(new URL('documents/', root)).sort()).toEqual(files.sort());
    expect(readdirSync(new URL('prefectures/', root))).toHaveLength(47);
  }, 120_000);

  it('rejects the prefecture list as the municipal list and vice versa', () => {
    const value = JSON.parse(read('index.json').toString('utf8'));
    expect(() => parseEvidenceIndex(value)).toThrow();
    expect(() => parseEvidenceIndex({ ...value, scopeMunicipalities: 1741 }, 'prefecture')).toThrow();
  });
});
