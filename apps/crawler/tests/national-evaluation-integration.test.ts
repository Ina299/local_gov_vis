import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvaluationDataset, ProjectEvaluation } from '../../web/src/types/evaluation';
import { BASELINE_CODES, BASELINE_SHA256, LIMITS, NATIONAL_INDEX_SHA256, NATIONAL_PROJECTION_SHA256,
  buildEvaluationIntegration, composeValidatedIntegration, importNationalEvaluations, municipalityDatasetPath,
  readBoundedFile, restoreNationalIndex, sha256, validateEvaluationIndex, validateShardBytes, verifyIntegratedEvaluations,
  type EvaluationIndex, type MunicipalityIndexEntry } from '../src/evaluations/national-integration';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const bytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value)}\n`);
const generatedAt = '2026-10-12T00:00:00.000Z';
const evidence = { sourceUrl: 'https://example.jp/evaluation.html', sourcePageUrl: 'https://example.jp/index.html',
  format: 'html' as const, fetchedAt: generatedAt, sha256: 'a'.repeat(64), rawText: 'Original source text', page: null, sheet: null, cell: null };
function dataset(code: string, id = `${code}-project`): EvaluationDataset {
  const project: ProjectEvaluation = { id, municipalityCode: code, municipalityName: `City ${code}`, projectCode: null,
    projectName: 'Source project', department: null, evaluationYear: 2025, evaluatedFiscalYear: null,
    purpose: null, activities: null, outcomes: null, amounts: [], indicators: [], ratings: [],
    evidence: [evidence], extractionStatus: 'partial', warnings: ['Unknown values stay unknown'] };
  return { schemaVersion: 1, generatedAt, projects: [project], sources: [{ id: `${code}-source`, municipalityCode: code,
    municipalityName: `City ${code}`, sourcePageUrl: evidence.sourcePageUrl, evaluationYear: 2025,
    status: 'partial', discoveredDocuments: 4, fetchedDocuments: 1, extractedProjects: 1,
    scope: 'One bounded source, completeness unknown', message: 'Only 1/4 documents acquired',
    lastAttemptAt: generatedAt, lastSuccessAt: generatedAt, documents: [{ url: evidence.sourceUrl, format: 'html', status: 'ok',
      sha256: evidence.sha256, fetchedAt: generatedAt, projectCount: 1, message: 'Original source warning' }] }] };
}
function row(code: string, data?: EvaluationDataset): MunicipalityIndexEntry {
  const content = data && bytes(data);
  return { municipalityCode: code, municipalityName: `City ${code}`, prefectureCode: code.slice(0, 2),
    discoveryStatus: data ? 'structured' : 'searched_not_found', dataStatus: data ? 'primary_available' : 'no_structured_data_yet',
    primaryEvaluationRecords: data?.projects.length ?? 0, historicalEvaluationRecords: 0,
    recordsWithExplicitActualDirectCosts: 0, recordsWithSourceLabelledOutcomeIndicators: 0, scopeCompleteness: 'not_established',
    datasetPath: content ? municipalityDatasetPath(code) : null, datasetSha256: content ? sha256(content) : null,
    datasetBytes: content?.length ?? 0 };
}
function fixture(): { index: EvaluationIndex; national: EvaluationDataset; baseline: EvaluationDataset; shards: Map<string, Buffer> } {
  const national = dataset('01213'); const baseline = dataset('01100');
  return { national, baseline, shards: new Map([['01213', bytes(national)]]), index: { schemaVersion: 1,
    datasetKind: 'municipality_evaluation_index', generatedAt, sourceProjectionSha256: NATIONAL_PROJECTION_SHA256,
    scopeMunicipalities: 2, primaryEvaluationRecords: 1, primaryMunicipalities: 1,
    municipalities: [row('01100'), row('01213', national)], notes: ['Unavailable data never means absent evaluations'] } };
}

test('rejects tampered shard bytes even when the byte count is unchanged', () => {
  const { national } = fixture(); const original = bytes(national); const tampered = Buffer.from(original);
  tampered[tampered.indexOf('Source project')] = 'T'.charCodeAt(0);
  assert.equal(tampered.length, original.length);
  assert.throws(() => validateShardBytes(row('01213', national), tampered), /hash mismatch/);
});

test('rejects mismatched shard byte count, record count, generation and project/source municipality identities', () => {
  const { national } = fixture();
  assert.throws(() => validateShardBytes({ ...row('01213', national), datasetBytes: 1 }, bytes(national)), /byte count mismatch/);
  assert.throws(() => validateShardBytes({ ...row('01213', national), primaryEvaluationRecords: 2 }, bytes(national)), /record\/source count mismatch/);
  assert.throws(() => validateShardBytes(row('01213', national), bytes(national), '2025-01-01T00:00:00Z'), /generation identity mismatch/);
  const wrongProject = structuredClone(national); wrongProject.projects[0].municipalityCode = '02201';
  assert.throws(() => validateShardBytes(row('01213', wrongProject), bytes(wrongProject)), /project municipality identity mismatch/);
  const wrongSource = structuredClone(national); wrongSource.sources[0].municipalityCode = '02201';
  assert.throws(() => validateShardBytes(row('01213', wrongSource), bytes(wrongSource)), /source municipality identity mismatch/);
  const wrongCount = structuredClone(national); wrongCount.sources[0].extractedProjects = 0; wrongCount.sources[0].documents[0].projectCount = 0;
  assert.throws(() => validateShardBytes(row('01213', wrongCount), bytes(wrongCount)), /Source extracted project count mismatch/);
});

test('rejects duplicate project IDs within shards and across national shards', () => {
  const { national, baseline, index, shards } = fixture();
  const duplicate = structuredClone(national); duplicate.projects.push(structuredClone(duplicate.projects[0])); duplicate.sources[0].extractedProjects = 2; duplicate.sources[0].documents[0].projectCount = 2;
  assert.throws(() => validateShardBytes(row('01213', duplicate), bytes(duplicate)), /Duplicate project ID/);
  const second = dataset('02201', national.projects[0].id);
  index.municipalities.push(row('02201', second)); index.scopeMunicipalities++; index.primaryMunicipalities++; index.primaryEvaluationRecords++;
  shards.set('02201', bytes(second));
  assert.throws(() => composeValidatedIntegration(index, shards, baseline), /Duplicate project ID/);
});

test('rejects duplicate source IDs and negative source/document counts', () => {
  const { national } = fixture();
  const duplicate = structuredClone(national); duplicate.sources.push(structuredClone(duplicate.sources[0]));
  assert.throws(() => validateShardBytes(row('01213', duplicate), bytes(duplicate)), /Duplicate source ID/);
  const negative = structuredClone(national); negative.sources[0].documents[0].projectCount = -1;
  assert.throws(() => validateShardBytes(row('01213', negative), bytes(negative)), /Invalid source\/document count/);
});

test('rejects source document counts and malformed source/evidence hashes', () => {
  const { national } = fixture();
  const missingDocument = structuredClone(national); missingDocument.sources[0].fetchedDocuments = 0;
  assert.throws(() => validateShardBytes(row('01213', missingDocument), bytes(missingDocument)), /Source document count mismatch/);
  const wrongDocumentCount = structuredClone(national); wrongDocumentCount.sources[0].documents[0].projectCount = 0;
  assert.throws(() => validateShardBytes(row('01213', wrongDocumentCount), bytes(wrongDocumentCount)), /Source document project count mismatch/);
  const badDocumentHash = structuredClone(national); badDocumentHash.sources[0].documents[0].sha256 = 'not-a-hash';
  assert.throws(() => validateShardBytes(row('01213', badDocumentHash), bytes(badDocumentHash)), /Invalid source document SHA-256/);
  const badEvidenceHash = structuredClone(national); badEvidenceHash.projects[0].evidence[0].sha256 = 'not-a-hash';
  assert.throws(() => validateShardBytes(row('01213', badEvidenceHash), bytes(badEvidenceHash)), /Invalid project evidence SHA-256/);
});

test('rejects traversal, external URLs, encoded traversal and mismatched code-derived filenames', () => {
  for (const path of ['../evaluations.json', 'evaluations-municipal/../01213.json', '/evaluations-municipal/01213.json',
    'https://example.jp/01213.json', 'evaluations-municipal/%2e%2e%2f01213.json', 'evaluations-municipal/02201.json']) {
    const { index } = fixture(); index.municipalities[1].datasetPath = path;
    assert.throws(() => validateEvaluationIndex(index), /Unsafe or mismatched municipality dataset path/, path);
  }
  assert.throws(() => municipalityDatasetPath('../01'), /Invalid municipality code/);
});

test('rejects inconsistent aggregate counts, duplicate municipality rows and file-size bounds', () => {
  const badTotal = fixture().index; badTotal.primaryEvaluationRecords++;
  assert.throws(() => validateEvaluationIndex(badTotal), /Index primary count mismatch/);
  const duplicated = fixture().index; duplicated.municipalities.push(duplicated.municipalities[1]); duplicated.scopeMunicipalities++;
  assert.throws(() => validateEvaluationIndex(duplicated), /Duplicate or unsorted municipality code/);
  const excessive = fixture().index; excessive.municipalities[1].datasetBytes = LIMITS.shardBytes + 1;
  assert.throws(() => validateEvaluationIndex(excessive), /Invalid shard hash or byte bound/);
  const missing = fixture().index; missing.municipalities[1].datasetPath = null;
  assert.throws(() => validateEvaluationIndex(missing), /Missing primary shard/);
});

test('refuses baseline municipality or project-ID overlap before combining cohorts', () => {
  const { index, shards } = fixture();
  assert.throws(() => composeValidatedIntegration(index, shards, dataset('01213')), /Baseline municipality overlap/);
  assert.throws(() => composeValidatedIntegration(index, shards, dataset('01100', '01213-project')), /Baseline project ID overlap/);
});

test('composition preserves source-specific statuses, warnings, unknowns and national shard bytes', () => {
  const { index, shards, baseline } = fixture();
  const result = composeValidatedIntegration(index, shards, baseline);
  assert.deepEqual(result.shards.get('01213'), shards.get('01213'));
  assert.deepEqual(JSON.parse(result.shards.get('01100')!.toString()), baseline);
  assert.deepEqual(result.index.municipalities[0], { ...index.municipalities[0], discoveryStatus: 'structured',
    dataStatus: 'primary_available', primaryEvaluationRecords: 1, datasetPath: 'evaluations-municipal/01100.json',
    datasetSha256: sha256(result.shards.get('01100')!), datasetBytes: result.shards.get('01100')!.length,
    coverageMetricsStatus: 'not_assessed_for_baseline' });
  assert.equal(result.index.municipalities[0].scopeCompleteness, 'not_established');
  assert.equal(JSON.parse(result.shards.get('01100')!.toString()).projects[0].evaluatedFiscalYear, null);
});

test('bounded reader rejects oversized, non-regular and symbolic-link inputs', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'national-evaluation-read-'));
  try {
    await writeFile(join(temporary, 'source'), '123456');
    await symlink(join(temporary, 'source'), join(temporary, 'linked'));
    await assert.rejects(readBoundedFile(join(temporary, 'source'), 5), /oversized input file/);
    await assert.rejects(readBoundedFile(temporary, 100), /Invalid or oversized input file/);
    await assert.rejects(readBoundedFile(join(temporary, 'linked'), 100), /ELOOP/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('all 53 checked-in shards parse against pinned provenance and exact original baseline', async () => {
  const result = await verifyIntegratedEvaluations(root);
  assert.equal(result.index.scopeMunicipalities, 1741);
  assert.equal(result.index.primaryMunicipalities, 53);
  assert.equal(result.index.primaryEvaluationRecords, 12847);
  assert.equal(result.shards.size, 53);
  assert.deepEqual(result.index.cohorts, { national: { primaryMunicipalities: 50, primaryEvaluationRecords: 12259 },
    baseline: { primaryMunicipalities: 3, primaryEvaluationRecords: 588 } });
  assert.equal(result.index.sourceProjectionSha256, NATIONAL_PROJECTION_SHA256);
  assert.equal(result.index.baselineSourceSha256, BASELINE_SHA256);
  const originalBytes = await readFile(join(root, 'data/evaluations/evaluations.json'));
  assert.equal(sha256(originalBytes), BASELINE_SHA256);
  assert.deepEqual(originalBytes, await readFile(join(root, 'apps/web/public/evaluations.json')));
  const original = JSON.parse(originalBytes.toString()) as EvaluationDataset;
  for (const code of BASELINE_CODES) {
    const split = JSON.parse(result.shards.get(code)!.toString()) as EvaluationDataset;
    assert.deepEqual(split, { ...original, projects: original.projects.filter((project) => project.municipalityCode === code),
      sources: original.sources.filter((source) => source.municipalityCode === code) });
  }
  assert.equal(result.manifest.output.shards.filter((shard) => shard.cohort === 'national').length, 50);
  assert.equal(sha256(restoreNationalIndex(result.index, result.manifest)), NATIONAL_INDEX_SHA256);
  for (const shard of result.manifest.output.shards) {
    const content = await readFile(join(root, shard.path));
    assert.equal(content.length, shard.bytes); assert.equal(sha256(content), shard.sha256);
  }
});

test('pinned import is deterministic, validates before writes, and never changes monoliths', async () => {
  const current = await verifyIntegratedEvaluations(root);
  const temporary = await mkdtemp(join(tmpdir(), 'national-evaluation-import-'));
  const target = join(temporary, 'repo'); const source = join(temporary, 'source');
  try {
    await mkdir(join(target, 'apps/web/public'), { recursive: true });
    await mkdir(join(target, 'data/evaluations'), { recursive: true });
    await mkdir(join(source, 'evaluations-municipal'), { recursive: true });
    await writeFile(join(source, 'evaluations-index.json'), restoreNationalIndex(current.index, current.manifest));
    for (const shard of current.manifest.output.shards.filter((entry) => entry.cohort === 'national')) {
      await copyFile(join(root, shard.path), join(source, municipalityDatasetPath(shard.municipalityCode)));
    }
    for (const path of ['apps/web/public/evaluations.json', 'data/evaluations/evaluations.json']) {
      await copyFile(join(root, path), join(target, path));
    }
    const first = await importNationalEvaluations({ root: target, sourceDirectory: source });
    const second = await importNationalEvaluations({ root: target, sourceDirectory: source });
    assert.deepEqual(second.indexBytes, first.indexBytes);
    assert.deepEqual(second.manifestBytes, first.manifestBytes);
    assert.deepEqual(second.indexBytes, current.indexBytes);
    for (const [code, content] of first.shards) assert.deepEqual(second.shards.get(code), content);
    const baseline = await readFile(join(target, 'apps/web/public/evaluations.json'));
    assert.equal(sha256(baseline), BASELINE_SHA256);
    assert.deepEqual(baseline, await readFile(join(target, 'data/evaluations/evaluations.json')));
    assert.deepEqual((await readdir(join(target, 'data/evaluations'))).sort(), ['evaluations.json', 'integration-provenance.json']);
    assert(!(await readdir(join(target, 'apps/web/public'))).some((name) => name.startsWith('.evaluations-import-')));
    const initialIndex = await readFile(join(target, 'apps/web/public/evaluations-index.json'));
    const code = first.manifest.output.shards.find((shard) => shard.cohort === 'national')!.municipalityCode;
    const path = join(source, municipalityDatasetPath(code)); const original = await readFile(path);
    const tampered = Buffer.from(original); tampered[tampered.length - 2] ^= 1; await writeFile(path, tampered);
    await assert.rejects(importNationalEvaluations({ root: target, sourceDirectory: source }), /Shard hash mismatch/);
    assert.deepEqual(await readFile(join(target, 'apps/web/public/evaluations-index.json')), initialIndex);
    await writeFile(path, original);
    await writeFile(join(target, 'data/evaluations/evaluations.json'), Buffer.concat([baseline, Buffer.from(' ')]));
    await assert.rejects(importNationalEvaluations({ root: target, sourceDirectory: source }), /baseline copies differ or source hash mismatch/);
    assert.deepEqual(await readFile(join(target, 'apps/web/public/evaluations-index.json')), initialIndex);
    await assert.rejects(importNationalEvaluations({ root: target, sourceDirectory: join(target, 'apps/web/public') }), /Source must be separate/);
    const nationalIndex = restoreNationalIndex(current.index, current.manifest);
    assert.throws(() => buildEvaluationIntegration({ indexBytes: Buffer.concat([nationalIndex, Buffer.from(' ')]), shards: new Map(), baselineBytes: baseline }), /National index source hash mismatch/);
    assert.throws(() => buildEvaluationIntegration({ indexBytes: nationalIndex, shards: new Map(), baselineBytes: Buffer.concat([baseline, Buffer.from(' ')]) }), /baseline source hash mismatch/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
