import { readFileSync, readdirSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseEvidenceIndex, validateDocumentText, validateMunicipalityEvidence } from './evaluationEvidenceLoader';
import { parseEvaluationIndex } from './evaluationLoader';
import { searchEvidenceMunicipalities } from './evaluationEvidence';

const root = new URL('../../public/evaluation-evidence/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const index = parseEvidenceIndex(JSON.parse(read('index.json').toString('utf8')));
const subtle = webcrypto.subtle as unknown as SubtleCrypto;

describe('all published evidence assets', () => {
  it('binds all 1,741 cities and every readable document to hashes, identities, counts and exact local paths', async () => {
    const documentIds = new Set<string>(); let readable = 0; let substantive = 0; let truncated = 0;
    const normalized = parseEvaluationIndex(JSON.parse(readFileSync(new URL('../../public/evaluations-index.json', import.meta.url), 'utf8')));
    expect(index.municipalities.map((e) => e.municipalityCode).sort()).toEqual(normalized.municipalities.map((e) => e.municipalityCode).sort());
    const normalizedCodes = new Set(normalized.municipalities.filter((e) => e.dataStatus === 'primary_available').map((e) => e.municipalityCode));
    let readableBeyondNormalized = 0;
    for (const entry of index.municipalities) {
      const city = await validateMunicipalityEvidence(new Uint8Array(read(entry.shardPath)).buffer, entry, new AbortController().signal, subtle);
      expect(city.integrity).toBe('sha256_verified');
      if (entry.textDocumentCount && !normalizedCodes.has(entry.municipalityCode)) readableBeyondNormalized += 1;
      for (const source of city.data.sources) {
        if (source.text.status !== 'available') continue;
        expect(documentIds.has(source.id)).toBe(false); documentIds.add(source.id);
        const text = await validateDocumentText(new Uint8Array(read(source.text.assetPath!)).buffer, entry.municipalityCode, source, new AbortController().signal, subtle);
        expect(text.integrity).toBe('sha256_verified');
        readable += 1; substantive += Number(source.role === 'evaluation_document'); truncated += Number(text.data.truncated);
      }
    }
    expect(readable).toBe(index.counts.textDocuments); expect(substantive).toBe(index.counts.substantiveEvaluationTextDocuments); expect(truncated).toBe(index.counts.truncatedTextDocuments);
    expect(readableBeyondNormalized).toBeGreaterThan(100);
    expect(readdirSync(new URL('documents/', root)).sort()).toEqual(Array.from(documentIds).map((id) => `${id}.json`).sort());
    expect(readdirSync(new URL('municipalities/', root))).toHaveLength(1741);
  }, 60_000);
  it('keeps same-name cities separate, retains readable-only cases and excludes known wrong-city sources', async () => {
    expect(searchEvidenceMunicipalities(index.municipalities, '府中市').map((e) => e.municipalityCode)).toEqual(['13206', '34208']);
    expect(searchEvidenceMunicipalities(index.municipalities, '伊達市').map((e) => e.municipalityCode)).toEqual(['01233', '07213']);
    expect(searchEvidenceMunicipalities(index.municipalities, '池田町').map((e) => e.municipalityCode)).toEqual(['01644', '18382', '20481', '21404']);
    for (const code of ['01233', '01460', '34208']) expect(index.municipalities.find((e) => e.municipalityCode === code)?.textDocumentCount).toBeGreaterThan(0);
    for (const code of ['20303', '17386']) {
      const entry = index.municipalities.find((e) => e.municipalityCode === code)!;
      const result = await validateMunicipalityEvidence(new Uint8Array(read(entry.shardPath)).buffer, entry, new AbortController().signal, subtle);
      expect(result.data.discovery.omittedRejectedSources).toBeGreaterThan(0); expect(result.data.sources.every((source) => source.navigationReview !== undefined)).toBe(true);
    }
    expect(index.municipalities.find((e) => e.municipalityCode === '01205')?.discoveryStatus).toBe('discovered');
    expect(index.municipalities.find((e) => e.municipalityCode === '01205')?.acquiredCount).toBe(0);
  });
});
