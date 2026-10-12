import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCoverage } from '../../src/source-collection/coverage';
import type { Entry } from '../../src/source-collection/collector';
const entry = (): Entry => ({ source: {
  url: 'https://city.example.jp/source.pdf', sourcePageUrl: 'https://city.example.jp/index.html',
  municipalityCode: '12345', municipalityName: 'Fixture', title: '令和7年度 概要', fiscalYear: null, amountKind: null,
  review: { checkedAt: '2026-10-12T00:00:00Z', evidence: 'Offline fixture' },
}, state: 'blocked', failureKind: 'proxy_denial', proxyHttpStatus: 403, extraction: 'not_started' });
test('all registry municipalities remain searchable without any extracted projects', () => {
  const result = buildCoverage([{ code: '12', name: '県' }, { code: '12345', name: '市' }, { code: '12346', name: '町' }], [entry()]);
  assert.deepEqual(result.summary, { searchableMunicipalities: 2, sourceLinkedMunicipalities: 1, linkedDocuments: 1, originalSavedMunicipalities: 0, originalsSaved: 0, structuredMunicipalities: 0 });
  assert.equal(result.municipalities[0].documents[0].sourceUrl, entry().source.url);
  assert.equal(result.municipalities[1].documents.length, 0);
});
test('full checked-in registry includes exactly 1741 municipalities even with no source entries', async () => {
  const registry = JSON.parse(await readFile(new URL('../../../web/public/search-index.json', import.meta.url), 'utf8'));
  assert.equal(buildCoverage(registry, []).summary.searchableMunicipalities, 1741);
});
test('proxy refusal does not become an origin refusal or an inferred fiscal year', () => {
  const doc = buildCoverage([{ code: '12345', name: '市' }], [entry()]).municipalities[0].documents[0];
  assert.equal(doc.proxyHttpStatus, 403); assert.equal(doc.originHttpStatus, null);
  assert.equal(doc.evaluationYear, null); assert.equal(doc.evaluatedFiscalYear, null);
});
test('saved bytes do not imply readable text or completed structured extraction', () => {
  const saved: Entry = { ...entry(), state: 'fetched', failureKind: undefined, proxyHttpStatus: undefined, sha256: 'a'.repeat(64), fetchedAt: '2026-10-12T00:00:00Z', bytes: 42 };
  const result = buildCoverage([{ code: '12345', name: '市' }], [saved]);
  assert.equal(result.summary.originalsSaved, 1); assert.equal(result.summary.structuredMunicipalities, 0);
  assert.equal(result.municipalities[0].documents[0].textReading, 'not_checked');
  assert.throws(() => buildCoverage([{ code: '12345', name: '市' }], [{ ...saved, sha256: undefined }]), /provenance/);
});
test('legacy ambiguous errors and unsafe or duplicate source inputs are not silently reclassified', () => {
  const registry = [{ code: '12345', name: '市' }];
  const legacy = { ...entry(), failureKind: undefined, proxyHttpStatus: undefined, message: 'Transport failure' };
  assert.equal(buildCoverage(registry, [legacy]).municipalities[0].documents[0].acquisitionState, 'paused');
  assert.throws(() => buildCoverage(registry, [entry(), entry()]), /Duplicate/);
  assert.throws(() => buildCoverage([], [entry()]), /missing/);
  assert.throws(() => buildCoverage(registry, [{ ...entry(), source: { ...entry().source, url: 'javascript:alert(1)' } }]), /Unsafe/);
});
