/** Offline-only, pinned national-v19 + original-PR1 integration. Never acquires sources. */
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import * as originalEvaluationModule from '../../../web/src/lib/evaluations';
// The web package is CommonJS under Node/tsx; consume the same untouched parser in either module mode.
const parseEvaluationDataset: typeof originalEvaluationModule.parseEvaluationDataset = originalEvaluationModule.parseEvaluationDataset
  ?? (originalEvaluationModule as unknown as { default: typeof originalEvaluationModule }).default.parseEvaluationDataset;
import type { EvaluationDataset } from '../../../web/src/types/evaluation';

export const NATIONAL_PROJECTION_SHA256 = 'c2f4d20a6a1c1309c11e67bdb9676e5c50dd48dbdbd69026c920db04011543a4';
export const NATIONAL_INDEX_SHA256 = 'f5f15661d58e5bc9effe48b3dd2b6bb8a890cc1a06a31c4a42bc1676d1dd6c07';
export const BASELINE_SHA256 = 'a6e003dde6382383050f431ae44be65e3097580df63ef66091ea3177150a05d1';
export const BASELINE_CODES = ['01100', '11237', '14206'] as const;
// Multi-year evidence remains bounded per municipality, matching the browser's 32 MiB limit.
export const LIMITS = { indexBytes: 2 * 1024 * 1024, shardBytes: 32 * 1024 * 1024,
  baselineBytes: 8 * 1024 * 1024, totalBytes: 256 * 1024 * 1024, municipalities: 1741, records: 100_000 } as const;
const INDEX_PATH = 'evaluations-index.json';
const MANIFEST_PATH = 'data/evaluations/integration-provenance.json';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
export const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value)}\n`);

export interface MunicipalityIndexEntry {
  municipalityCode: string; municipalityName: string; prefectureCode: string;
  discoveryStatus: string; dataStatus: string; primaryEvaluationRecords: number;
  historicalEvaluationRecords: number; recordsWithExplicitActualDirectCosts: number;
  recordsWithSourceLabelledOutcomeIndicators: number; scopeCompleteness: 'not_established';
  datasetPath: string | null; datasetSha256: string | null; datasetBytes: number;
  coverageMetricsStatus?: 'not_assessed_for_baseline';
}
export interface EvaluationIndex {
  schemaVersion: 1; datasetKind: 'municipality_evaluation_index'; generatedAt: string;
  sourceProjectionSha256: string; scopeMunicipalities: number; primaryEvaluationRecords: number;
  primaryMunicipalities: number; municipalities: MunicipalityIndexEntry[]; notes: string[];
  baselineSourceSha256?: string;
  cohorts?: { national: { primaryMunicipalities: number; primaryEvaluationRecords: number };
    baseline: { primaryMunicipalities: number; primaryEvaluationRecords: number };
    cachedExpansion?: { primaryMunicipalities: number; primaryEvaluationRecords: number };
    supplemental?: { primaryMunicipalities: number; primaryEvaluationRecords: number; existingMunicipalities: number } };
}
export interface IntegrationInput { indexBytes: Buffer; shards: Map<string, Buffer>; baselineBytes: Buffer }
export interface IntegrationManifest {
  schemaVersion: 1; integrationVersion: 'national-v19-original-pr1'; generatedAt: string;
  inputs: {
    national: { indexSha256: string; sourceProjectionSha256: string; indexBytes: number;
      primaryMunicipalities: number; primaryEvaluationRecords: number; notes: string[];
      baselineRowsBeforeIntegration: MunicipalityIndexEntry[] };
    baseline: { sha256: string; bytes: number; dataPath: string; publicPath: string;
      generatedAt: string; primaryMunicipalities: number; primaryEvaluationRecords: number };
  };
  output: { indexPath: string; indexSha256: string; indexBytes: number; scopeMunicipalities: number;
    primaryMunicipalities: number; primaryEvaluationRecords: number; shardBytes: number;
    shards: { municipalityCode: string; cohort: 'national' | 'baseline'; path: string; sha256: string;
      bytes: number; records: number; sources: number }[] };
  validation: { municipalityOverlap: number; projectIdOverlap: number; originalParser: string;
    nationalShardBytesPreserved: boolean; baselineRecordsAndSourcesPreserved: boolean;
    baselineMonolithsUnchanged: boolean };
  notes: string[];
}
export interface IntegrationAssets { index: EvaluationIndex; indexBytes: Buffer; shards: Map<string, Buffer>;
  manifest: IntegrationManifest; manifestBytes: Buffer }

/** Paths come from validated codes, never from arbitrary index path strings. */
export function municipalityDatasetPath(code: string): string {
  check(/^[0-9]{5}$/.test(code), 'Invalid municipality code');
  return `evaluations-municipal/${code}.json`;
}

export function validateEvaluationIndex(value: unknown): EvaluationIndex {
  check(record(value) && value.schemaVersion === 1 && value.datasetKind === 'municipality_evaluation_index', 'Invalid evaluation index schema');
  check(typeof value.generatedAt === 'string' && Number.isFinite(Date.parse(value.generatedAt)), 'Invalid index generatedAt');
  check(sha(value.sourceProjectionSha256), 'Invalid source projection identity');
  check(integer(value.scopeMunicipalities) && value.scopeMunicipalities > 0 && value.scopeMunicipalities <= LIMITS.municipalities, 'Invalid municipality scope count');
  check(integer(value.primaryMunicipalities) && integer(value.primaryEvaluationRecords) && value.primaryEvaluationRecords <= LIMITS.records, 'Invalid index primary counts');
  check(Array.isArray(value.notes) && value.notes.every((note) => typeof note === 'string'), 'Invalid index notes');
  check(Array.isArray(value.municipalities) && value.municipalities.length === value.scopeMunicipalities, 'Municipality index count mismatch');
  let previousCode = ''; let total = 0; let primary = 0; let totalBytes = 0;
  for (const row of value.municipalities) {
    check(record(row) && typeof row.municipalityCode === 'string', 'Invalid municipality row');
    const path = municipalityDatasetPath(row.municipalityCode);
    check(row.municipalityCode > previousCode, 'Duplicate or unsorted municipality code'); previousCode = row.municipalityCode;
    check(typeof row.municipalityName === 'string' && row.municipalityName.length > 0, 'Invalid municipality name');
    check(typeof row.prefectureCode === 'string' && /^(0[1-9]|[1-3][0-9]|4[0-7])$/.test(row.prefectureCode)
      && row.municipalityCode.startsWith(row.prefectureCode), 'Prefecture identity mismatch');
    check(['fetched', 'searched_not_found', 'discovered', 'blocked', 'structured'].includes(String(row.discoveryStatus)), 'Invalid discovery status');
    check(['no_structured_data_yet', 'historical_only', 'primary_available'].includes(String(row.dataStatus)), 'Invalid data status');
    check(row.scopeCompleteness === 'not_established', 'Unsupported completeness claim');
    for (const key of ['primaryEvaluationRecords', 'historicalEvaluationRecords', 'recordsWithExplicitActualDirectCosts', 'recordsWithSourceLabelledOutcomeIndicators', 'datasetBytes']) {
      check(integer(row[key]), `Invalid municipality ${key}`);
    }
    check(Number(row.recordsWithExplicitActualDirectCosts) <= Number(row.primaryEvaluationRecords)
      && Number(row.recordsWithSourceLabelledOutcomeIndicators) <= Number(row.primaryEvaluationRecords), 'Coverage count exceeds primary records');
    if (row.datasetPath !== null) {
      check(row.datasetPath === path || row.datasetPath === `evaluations-composed/${row.municipalityCode}-${row.datasetSha256}.json`, 'Unsafe or mismatched municipality dataset path');
      check(sha(row.datasetSha256) && Number(row.datasetBytes) > 0 && Number(row.datasetBytes) <= LIMITS.shardBytes, 'Invalid shard hash or byte bound');
      check(row.dataStatus === 'primary_available' && row.discoveryStatus === 'structured' && Number(row.primaryEvaluationRecords) > 0, 'Inconsistent primary municipality status');
      primary++; total += Number(row.primaryEvaluationRecords); totalBytes += Number(row.datasetBytes);
    } else {
      check(row.datasetSha256 === null && row.datasetBytes === 0 && row.primaryEvaluationRecords === 0 && row.dataStatus !== 'primary_available', 'Missing primary shard or invalid empty row');
    }
  }
  check(total === value.primaryEvaluationRecords && primary === value.primaryMunicipalities, 'Index primary count mismatch');
  check(totalBytes <= LIMITS.totalBytes, 'Total shard byte bound exceeded');
  if (value.cohorts !== undefined) {
    check(record(value.cohorts), 'Invalid cohorts');
    let cohortRecords = 0; let cohortMunicipalities = 0;
    for (const name of ['national', 'baseline', 'cachedExpansion', 'supplemental']) {
      const cohort = value.cohorts[name];
      if (cohort === undefined && (name === 'cachedExpansion' || name === 'supplemental')) continue;
      check(record(cohort) && integer(cohort.primaryMunicipalities) && integer(cohort.primaryEvaluationRecords), 'Invalid cohort counts');
      if (name === 'supplemental') check(integer(cohort.existingMunicipalities) && Number(cohort.existingMunicipalities) + Number(cohort.primaryMunicipalities) <= primary, 'Invalid supplemental existing municipality count');
      cohortRecords += Number(cohort.primaryEvaluationRecords); cohortMunicipalities += Number(cohort.primaryMunicipalities);
    }
    check(cohortRecords === total && cohortMunicipalities === primary, 'Cohort totals mismatch');
  }
  return value as unknown as EvaluationIndex;
}

export function validateShardBytes(row: MunicipalityIndexEntry, bytes: Buffer, generatedAt?: string,
  projectIds = new Set<string>(), sourceIds = new Set<string>()): EvaluationDataset {
  check(row.datasetPath === municipalityDatasetPath(row.municipalityCode) || row.datasetPath === `evaluations-composed/${row.municipalityCode}-${row.datasetSha256}.json`, 'Unsafe or mismatched municipality dataset path');
  check(bytes.length <= LIMITS.shardBytes && bytes.length === row.datasetBytes, `Shard byte count mismatch: ${row.municipalityCode}`);
  check(sha256(bytes) === row.datasetSha256, `Shard hash mismatch: ${row.municipalityCode}`);
  const dataset = parseEvaluationDataset(JSON.parse(bytes.toString('utf8')));
  check(!generatedAt || dataset.generatedAt === generatedAt, 'Shard generation identity mismatch');
  check(dataset.projects.length === row.primaryEvaluationRecords && dataset.sources.length > 0, 'Shard record/source count mismatch');
  let extracted = 0;
  for (const source of dataset.sources) {
    check(source.municipalityCode === row.municipalityCode && source.municipalityName === row.municipalityName, 'Shard source municipality identity mismatch');
    check(source.id.length > 0 && !sourceIds.has(source.id), 'Duplicate source ID'); sourceIds.add(source.id);
    for (const count of [source.discoveredDocuments, source.fetchedDocuments, source.extractedProjects, ...source.documents.map((doc) => doc.projectCount)]) {
      check(integer(count) && count <= LIMITS.records, 'Invalid source/document count');
    }
    check(source.fetchedDocuments <= source.discoveredDocuments, 'Source fetched count exceeds discovery count');
    check(source.documents.length === source.fetchedDocuments, 'Source document count mismatch');
    check(source.documents.reduce((sum, document) => sum + document.projectCount, 0) === source.extractedProjects, 'Source document project count mismatch');
    check(source.documents.every((document) => document.sha256 === null || sha(document.sha256)), 'Invalid source document SHA-256');
    extracted += source.extractedProjects;
  }
  check(extracted === dataset.projects.length, 'Source extracted project count mismatch');
  for (const project of dataset.projects) {
    check(project.municipalityCode === row.municipalityCode && project.municipalityName === row.municipalityName, 'Shard project municipality identity mismatch');
    check(project.id.length > 0 && !projectIds.has(project.id), 'Duplicate project ID'); projectIds.add(project.id);
    const evidence = [...project.evidence, ...project.amounts.map((amount) => amount.evidence),
      ...project.indicators.map((indicator) => indicator.evidence), ...project.ratings.map((rating) => rating.evidence)];
    check(evidence.every((entry) => sha(entry.sha256)), 'Invalid project evidence SHA-256');
  }
  return dataset;
}

/** Regular, non-symlink files only, with a hard bound checked before allocation/read. */
export async function readBoundedFile(path: string, maximumBytes: number): Promise<Buffer> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    check(stat.isFile() && stat.size > 0 && stat.size <= maximumBytes, `Invalid or oversized input file: ${path}`);
    const bytes = Buffer.alloc(stat.size + 1); let length = 0;
    while (length < bytes.length) {
      const read = await handle.read(bytes, length, bytes.length - length, length);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    check(length === stat.size, `Input changed while reading: ${path}`);
    return bytes.subarray(0, length);
  } finally { await handle.close(); }
}

export function buildEvaluationIntegration(input: IntegrationInput): IntegrationAssets {
  check(input.indexBytes.length <= LIMITS.indexBytes && sha256(input.indexBytes) === NATIONAL_INDEX_SHA256, 'National index source hash mismatch');
  const national = validateEvaluationIndex(JSON.parse(input.indexBytes.toString('utf8')));
  check(national.sourceProjectionSha256 === NATIONAL_PROJECTION_SHA256 && national.scopeMunicipalities === 1741
    && national.primaryMunicipalities === 50 && national.primaryEvaluationRecords === 12259, 'Unexpected national source identity or counts');
  check(input.baselineBytes.length <= LIMITS.baselineBytes && sha256(input.baselineBytes) === BASELINE_SHA256, 'Original PR1 baseline source hash mismatch');
  const baseline = parseEvaluationDataset(JSON.parse(input.baselineBytes.toString('utf8')));
  check(baseline.projects.length === 588 && baseline.sources.length === 3, 'Original PR1 baseline count mismatch');
  check([...new Set(baseline.projects.map((project) => project.municipalityCode))].sort().join(',') === BASELINE_CODES.join(','), 'Original PR1 baseline municipality identity mismatch');
  return composeValidatedIntegration(national, input.shards, baseline, input.indexBytes.length, input.baselineBytes.length);
}

/** Pure composition helper: validates all identities/counts and rejects cross-cohort overlap. */
export function composeValidatedIntegration(national: EvaluationIndex, nationalShards: Map<string, Buffer>, baseline: EvaluationDataset,
  nationalIndexBytes = jsonBytes(national).length, baselineBytes = jsonBytes(baseline).length): IntegrationAssets {
  validateEvaluationIndex(national); parseEvaluationDataset(baseline);
  const primaryRows = national.municipalities.filter((row) => row.datasetPath !== null);
  check(nationalShards.size === primaryRows.length, 'National shard file count mismatch');
  const projectIds = new Set<string>(); const sourceIds = new Set<string>();
  const baselineCodes = [...new Set(baseline.projects.map((project) => project.municipalityCode))].sort();
  const nationalCodes = new Set(primaryRows.map((row) => row.municipalityCode));
  check(!baselineCodes.some((code) => nationalCodes.has(code)), 'Baseline municipality overlap with national cohort');
  const shards = new Map<string, Buffer>(); const parsed = new Map<string, EvaluationDataset>();
  for (const row of primaryRows) {
    const bytes = nationalShards.get(row.municipalityCode); check(bytes, `Missing national shard: ${row.municipalityCode}`);
    parsed.set(row.municipalityCode, validateShardBytes(row, bytes, national.generatedAt, projectIds, sourceIds));
    shards.set(row.municipalityCode, bytes); // Exact original bytes, including whitespace.
  }
  check(!baseline.projects.some((project) => projectIds.has(project.id)), 'Baseline project ID overlap with national cohort');
  check(baseline.sources.every((source) => baselineCodes.includes(source.municipalityCode)), 'Baseline source has no corresponding projects');
  const previousBaselineRows: MunicipalityIndexEntry[] = [];
  const municipalities = national.municipalities.map((row) => {
    if (!baselineCodes.includes(row.municipalityCode)) return row;
    previousBaselineRows.push(row);
    const dataset: EvaluationDataset = { ...baseline,
      sources: baseline.sources.filter((source) => source.municipalityCode === row.municipalityCode),
      projects: baseline.projects.filter((project) => project.municipalityCode === row.municipalityCode) };
    const bytes = jsonBytes(dataset);
    const updated: MunicipalityIndexEntry = { ...row, discoveryStatus: 'structured', dataStatus: 'primary_available',
      primaryEvaluationRecords: dataset.projects.length, scopeCompleteness: 'not_established',
      datasetPath: municipalityDatasetPath(row.municipalityCode), datasetSha256: sha256(bytes), datasetBytes: bytes.length,
      coverageMetricsStatus: 'not_assessed_for_baseline' };
    parsed.set(row.municipalityCode, validateShardBytes(updated, bytes, baseline.generatedAt, projectIds, sourceIds));
    shards.set(row.municipalityCode, bytes); return updated;
  });
  check(previousBaselineRows.length === baselineCodes.length, 'Baseline municipality missing from national scope');
  const index: EvaluationIndex = { ...national,
    primaryMunicipalities: national.primaryMunicipalities + baselineCodes.length,
    primaryEvaluationRecords: national.primaryEvaluationRecords + baseline.projects.length,
    municipalities, notes: [...national.notes,
      'Composition: validated national v19 primary cohort plus the original PR1 baseline. No unavailable pending 21-city release is included.',
      'Original PR1 source statuses, warnings, evidence, assessment years and unknowns are preserved; this does not establish whole-city or latest-year completeness.',
      'For baseline rows marked coverageMetricsStatus=not_assessed_for_baseline, the two national coverage metrics are unassessed; their preserved zero values do not establish absence of costs or outcome indicators.'],
    baselineSourceSha256: BASELINE_SHA256,
    cohorts: { national: { primaryMunicipalities: national.primaryMunicipalities, primaryEvaluationRecords: national.primaryEvaluationRecords },
      baseline: { primaryMunicipalities: baselineCodes.length, primaryEvaluationRecords: baseline.projects.length } } };
  validateEvaluationIndex(index);
  const indexBytes = jsonBytes(index);
  const manifest: IntegrationManifest = { schemaVersion: 1, integrationVersion: 'national-v19-original-pr1', generatedAt: national.generatedAt,
    inputs: { national: { indexSha256: NATIONAL_INDEX_SHA256, sourceProjectionSha256: national.sourceProjectionSha256,
      indexBytes: nationalIndexBytes, primaryMunicipalities: national.primaryMunicipalities, primaryEvaluationRecords: national.primaryEvaluationRecords,
      notes: national.notes, baselineRowsBeforeIntegration: previousBaselineRows },
    baseline: { sha256: BASELINE_SHA256, bytes: baselineBytes, dataPath: 'data/evaluations/evaluations.json',
      publicPath: 'apps/web/public/evaluations.json', generatedAt: baseline.generatedAt,
      primaryMunicipalities: baselineCodes.length, primaryEvaluationRecords: baseline.projects.length } },
    output: { indexPath: 'apps/web/public/evaluations-index.json', indexSha256: sha256(indexBytes), indexBytes: indexBytes.length,
      scopeMunicipalities: index.scopeMunicipalities, primaryMunicipalities: index.primaryMunicipalities,
      primaryEvaluationRecords: index.primaryEvaluationRecords, shardBytes: [...shards.values()].reduce((sum, bytes) => sum + bytes.length, 0),
      shards: municipalities.filter((row) => row.datasetPath !== null).map((row) => ({ municipalityCode: row.municipalityCode,
        cohort: nationalCodes.has(row.municipalityCode) ? 'national' : 'baseline', path: `apps/web/public/${row.datasetPath}`,
        sha256: row.datasetSha256!, bytes: row.datasetBytes, records: row.primaryEvaluationRecords, sources: parsed.get(row.municipalityCode)!.sources.length })) },
    validation: { municipalityOverlap: 0, projectIdOverlap: 0, originalParser: 'apps/web/src/lib/evaluations.ts#parseEvaluationDataset',
      nationalShardBytesPreserved: true, baselineRecordsAndSourcesPreserved: true, baselineMonolithsUnchanged: true },
    notes: ['Only index/shards are public integration outputs; the existing 588-record baseline monoliths remain unchanged.',
      'No national data is duplicated under data/evaluations. This manifest and original baseline are sufficient for independent verification.',
      'Generated timestamps are inherited from source cohorts; reruns do not refresh source acquisition dates.',
      'Source-specific statuses and evidence are authoritative. Counts represent evaluation records, not universally deduplicated municipal projects.',
      'No whole-city completeness, latest-year completeness, pending release inclusion, or external publication is claimed.'] };
  return { index, indexBytes, shards, manifest, manifestBytes: jsonBytes(manifest) };
}

async function realDirectory(path: string): Promise<void> {
  const stat = await lstat(path); check(stat.isDirectory() && !stat.isSymbolicLink(), `Expected non-symlink directory: ${path}`);
}
async function readBaseline(root: string): Promise<Buffer> {
  const data = await readBoundedFile(join(root, 'data/evaluations/evaluations.json'), LIMITS.baselineBytes);
  const web = await readBoundedFile(join(root, 'apps/web/public/evaluations.json'), LIMITS.baselineBytes);
  check(data.equals(web) && sha256(data) === BASELINE_SHA256, 'Original baseline copies differ or source hash mismatch'); return data;
}
async function readShards(directory: string, index: EvaluationIndex, allowedCodes?: string[]): Promise<Map<string, Buffer>> {
  const shardDirectory = join(directory, 'evaluations-municipal'); await realDirectory(shardDirectory);
  const rows = index.municipalities.filter((row) => row.datasetPath !== null);
  const expected = (allowedCodes ?? rows.map((row) => row.municipalityCode)).map((code) => `${code}.json`).sort();
  const entries = await readdir(shardDirectory); check(entries.sort().join(',') === expected.join(','), 'Unexpected or missing shard files');
  const shards = new Map<string, Buffer>();
  for (const row of rows) shards.set(row.municipalityCode, await readBoundedFile(join(directory, municipalityDatasetPath(row.municipalityCode)), LIMITS.shardBytes));
  return shards;
}

/** Restores and verifies the exact pinned input index using only integrated artifacts. */
export function restoreNationalIndex(index: EvaluationIndex, manifest: IntegrationManifest): Buffer {
  check(record(manifest) && manifest.schemaVersion === 1 && manifest.integrationVersion === 'national-v19-original-pr1', 'Invalid integration manifest');
  check(record(manifest.inputs) && record(manifest.inputs.national), 'Invalid national manifest input');
  const input = manifest.inputs.national;
  check(Array.isArray(input.baselineRowsBeforeIntegration) && input.baselineRowsBeforeIntegration.length === 3 && Array.isArray(input.notes), 'Invalid original national index metadata');
  const previous = new Map(input.baselineRowsBeforeIntegration.map((row) => [row.municipalityCode, row]));
  const { baselineSourceSha256: _baseline, cohorts: _cohorts, ...national } = index;
  const restored = jsonBytes({ ...national, primaryEvaluationRecords: 12259, primaryMunicipalities: 50,
    municipalities: index.municipalities.map((row) => previous.get(row.municipalityCode) ?? row), notes: input.notes });
  check(sha256(restored) === NATIONAL_INDEX_SHA256, 'Restored national index source hash mismatch'); return restored;
}

export async function verifyBaseIntegratedEvaluations(root: string, originalIndexBytes?: Buffer, allowedCodes?: string[]): Promise<IntegrationAssets> {
  const directory = join(root, 'apps/web/public');
  const indexBytes = originalIndexBytes ?? await readBoundedFile(join(directory, INDEX_PATH), LIMITS.indexBytes);
  const index = validateEvaluationIndex(JSON.parse(indexBytes.toString('utf8')));
  const manifestBytes = await readBoundedFile(join(root, MANIFEST_PATH), LIMITS.indexBytes);
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as IntegrationManifest;
  const nationalIndexBytes = restoreNationalIndex(index, manifest);
  const national = validateEvaluationIndex(JSON.parse(nationalIndexBytes.toString('utf8')));
  const shards = await readShards(directory, national, allowedCodes ?? index.municipalities.filter((row) => row.datasetPath).map((row) => row.municipalityCode));
  const assets = buildEvaluationIntegration({ indexBytes: nationalIndexBytes, shards, baselineBytes: await readBaseline(root) });
  check(assets.indexBytes.equals(indexBytes), 'Integrated index differs from validated composition');
  check(assets.manifestBytes.equals(manifestBytes), 'Integration provenance manifest mismatch');
  for (const code of BASELINE_CODES) {
    const bytes = await readBoundedFile(join(directory, municipalityDatasetPath(code)), LIMITS.shardBytes);
    check(bytes.equals(assets.shards.get(code)!), `Baseline shard differs from original records/sources: ${code}`);
  }
  return assets;
}

/** Validate everything before mutation. Stage all files, then atomically rename each; index is published last. */
export async function importNationalEvaluations(options: { root: string; sourceDirectory: string }): Promise<IntegrationAssets> {
  const root = await realpath(options.root); const source = await realpath(options.sourceDirectory);
  try { await lstat(join(root, 'data/evaluations/supplemental-provenance.json')); throw new Error('Supplemental overlay exists; immutable base cannot be reimported'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const publicDirectory = join(root, 'apps/web/public'); const dataDirectory = join(root, 'data/evaluations');
  const rel = relative(publicDirectory, source);
  check(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel), 'Source must be separate from public output');
  await realDirectory(publicDirectory); await realDirectory(dataDirectory);
  const indexBytes = await readBoundedFile(join(source, INDEX_PATH), LIMITS.indexBytes);
  check(sha256(indexBytes) === NATIONAL_INDEX_SHA256, 'National index source hash mismatch');
  const national = validateEvaluationIndex(JSON.parse(indexBytes.toString('utf8')));
  const assets = buildEvaluationIntegration({ indexBytes, shards: await readShards(source, national), baselineBytes: await readBaseline(root) });
  const outputDirectory = join(publicDirectory, 'evaluations-municipal');
  try { await realDirectory(outputDirectory); const expected = new Set([...assets.shards.keys()].map((code) => `${code}.json`));
    check((await readdir(outputDirectory)).every((name) => expected.has(name)), 'Unexpected output shard files; review before importing');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const stage = await mkdtemp(join(publicDirectory, '.evaluations-import-'));
  const manifestStage = await mkdtemp(join(dataDirectory, '.evaluations-import-'));
  try {
    for (const [code, bytes] of assets.shards) await writeFile(join(stage, `${code}.json`), bytes, { flag: 'wx' });
    await writeFile(join(stage, INDEX_PATH), assets.indexBytes, { flag: 'wx' });
    await writeFile(join(manifestStage, 'manifest.json'), assets.manifestBytes, { flag: 'wx' });
    await mkdir(outputDirectory, { recursive: true }); await realDirectory(outputDirectory);
    for (const code of assets.shards.keys()) await rename(join(stage, `${code}.json`), join(outputDirectory, `${code}.json`));
    await rename(join(manifestStage, 'manifest.json'), join(root, MANIFEST_PATH));
    await rename(join(stage, INDEX_PATH), join(publicDirectory, INDEX_PATH));
  } finally { await rm(stage, { recursive: true, force: true }); await rm(manifestStage, { recursive: true, force: true }); }
  return verifyBaseIntegratedEvaluations(root);
}

const EXPANSION_PATH = 'data/evaluations/cached-expansion-provenance.json';
export interface CachedExpansionManifest {
  schemaVersion: 1;
  kind: 'cached_evaluation_expansion';
  generatedAt: string;
  originalIndex: EvaluationIndex;
  originalIndexSha256: string;
  outputIndexSha256: string;
  shards: MunicipalityIndexEntry[];
  notes: string[];
}

/** Append only new municipalities; the pinned national and original PR1 bytes remain untouched. */
export function composeCachedExpansion(base: IntegrationAssets, additions: Map<string, Buffer>, generatedAt: string): {
  index: EvaluationIndex; indexBytes: Buffer; manifest: CachedExpansionManifest;
} {
  check(Number.isFinite(Date.parse(generatedAt)), 'Invalid expansion generatedAt');
  const ids = new Set<string>(); const sources = new Set<string>();
  for (const row of base.index.municipalities.filter((entry) => entry.datasetPath)) {
    validateShardBytes(row, base.shards.get(row.municipalityCode)!, undefined, ids, sources);
  }
  const rows = new Map<string, MunicipalityIndexEntry>();
  for (const [code, bytes] of additions) {
    const prior = base.index.municipalities.find((entry) => entry.municipalityCode === code);
    check(prior && !prior.datasetPath, `Expansion would overwrite an existing municipality or unknown code: ${code}`);
    const dataset = parseEvaluationDataset(JSON.parse(bytes.toString('utf8')));
    check(dataset.projects.length > 0, 'Expansion must contain projects');
    const row: MunicipalityIndexEntry = { ...prior, discoveryStatus: 'structured', dataStatus: 'primary_available',
      primaryEvaluationRecords: dataset.projects.length, datasetPath: municipalityDatasetPath(code),
      datasetSha256: sha256(bytes), datasetBytes: bytes.length,
      // 'actual' establishes accounting status, not exclusion of personnel costs.
      // Cached extraction has no independently verified direct-cost classification yet.
      recordsWithExplicitActualDirectCosts: 0,
      recordsWithSourceLabelledOutcomeIndicators: dataset.projects.filter((project) => project.indicators.some((indicator) => indicator.name.includes('【成果指標】'))).length };
    validateShardBytes(row, bytes, undefined, ids, sources);
    rows.set(code, row);
  }
  check(additions.size > 0, 'Expansion has no municipality shards');
  const addedRecords = [...rows.values()].reduce((sum, row) => sum + row.primaryEvaluationRecords, 0);
  check(base.index.cohorts && !base.index.cohorts.cachedExpansion, 'Expansion requires pinned original integration');
  const index: EvaluationIndex = { ...base.index, generatedAt,
    primaryMunicipalities: base.index.primaryMunicipalities + additions.size,
    primaryEvaluationRecords: base.index.primaryEvaluationRecords + addedRecords,
    municipalities: base.index.municipalities.map((row) => rows.get(row.municipalityCode) ?? row),
    cohorts: { ...base.index.cohorts, cachedExpansion: { primaryMunicipalities: additions.size, primaryEvaluationRecords: addedRecords } },
    notes: [...base.index.notes, 'Cached-text expansion: independently identified project records only; no new source acquisition and no municipality-wide completeness claim.'] };
  validateEvaluationIndex(index);
  const indexBytes = jsonBytes(index);
  const manifest: CachedExpansionManifest = { schemaVersion: 1, kind: 'cached_evaluation_expansion', generatedAt,
    originalIndex: base.index, originalIndexSha256: sha256(base.indexBytes), outputIndexSha256: sha256(indexBytes),
    shards: [...rows.values()].sort((a, b) => a.municipalityCode.localeCompare(b.municipalityCode)),
    notes: ['Original 53 municipality shards and pinned integration provenance remain byte-identical.',
      'Evidence acquisition dates and source hashes are inherited; generatedAt denotes extraction, not acquisition.',
      'Actual amounts are not classified as direct costs without explicit evidence excluding personnel costs; cached-expansion direct-cost coverage remains unassessed. Outcome indicators require an explicit source label.'] };
  return { index, indexBytes, manifest };
}

export async function verifyIntegratedEvaluations(root: string): Promise<IntegrationAssets> {
  const { verifySupplementalEvaluations } = await import('./supplemental-integration');
  return verifySupplementalEvaluations(root);
}

/** Immutable original integration, optionally checked against a saved pre-overlay index. */
export async function verifyCoreIntegratedEvaluations(root: string, expectedIndexBytes?: Buffer): Promise<IntegrationAssets> {
  let bytes: Buffer;
  try { bytes = await readBoundedFile(join(root, EXPANSION_PATH), LIMITS.indexBytes); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return verifyBaseIntegratedEvaluations(root, expectedIndexBytes); throw error; }
  const manifest = JSON.parse(bytes.toString('utf8')) as CachedExpansionManifest;
  check(manifest.schemaVersion === 1 && manifest.kind === 'cached_evaluation_expansion' && Array.isArray(manifest.shards), 'Invalid expansion provenance');
  const originalBytes = jsonBytes(validateEvaluationIndex(manifest.originalIndex));
  check(sha256(originalBytes) === manifest.originalIndexSha256, 'Original integrated index hash mismatch');
  const currentBytes = expectedIndexBytes ?? await readBoundedFile(join(root, 'apps/web/public', INDEX_PATH), LIMITS.indexBytes);
  const current = validateEvaluationIndex(JSON.parse(currentBytes.toString('utf8')));
  const base = await verifyBaseIntegratedEvaluations(root, originalBytes, current.municipalities.filter((row) => row.datasetPath).map((row) => row.municipalityCode));
  const additions = new Map<string, Buffer>();
  for (const row of manifest.shards) {
    check(!additions.has(row.municipalityCode), 'Duplicate expansion municipality');
    const content = await readBoundedFile(join(root, 'apps/web/public', municipalityDatasetPath(row.municipalityCode)), LIMITS.shardBytes);
    validateShardBytes(row, content); additions.set(row.municipalityCode, content);
  }
  const rebuilt = composeCachedExpansion(base, additions, manifest.generatedAt);
  check(rebuilt.indexBytes.equals(currentBytes), 'Expanded index differs from validated composition');
  check(jsonBytes(rebuilt.manifest).equals(bytes), 'Expansion provenance differs from validated composition');
  return { ...base, index: rebuilt.index, indexBytes: rebuilt.indexBytes, shards: new Map([...base.shards, ...additions]) };
}

/** Offline input: <sourceDirectory>/<five-digit municipality code>.json. Idempotent exact-byte reruns. */
export async function importCachedEvaluationExpansion(options: { root: string; sourceDirectory: string; generatedAt: string }): Promise<IntegrationAssets> {
  const root = await realpath(options.root); const source = await realpath(options.sourceDirectory);
  const publicDirectory = join(root, 'apps/web/public');
  const rel = relative(publicDirectory, source);
  check(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel), 'Source must be separate from public output');
  const current = await verifyIntegratedEvaluations(root);
  check(!current.index.cohorts?.supplemental, 'Supplemental overlay exists; use import-supplemental-evaluations instead');
  let base = current; const additions = new Map<string, Buffer>();
  if (current.index.cohorts?.cachedExpansion) {
    const manifest = JSON.parse((await readBoundedFile(join(root, EXPANSION_PATH), LIMITS.indexBytes)).toString('utf8')) as CachedExpansionManifest;
    base = await verifyBaseIntegratedEvaluations(root, jsonBytes(manifest.originalIndex), [...current.shards.keys()]);
    for (const row of manifest.shards) additions.set(row.municipalityCode, current.shards.get(row.municipalityCode)!);
  }
  const entries = (await readdir(source)).sort();
  check(entries.length > 0 && entries.every((name) => /^[0-9]{5}\.json$/.test(name)), 'Expansion directory must contain only municipality JSON shards');
  for (const name of entries) {
    const code = name.slice(0, 5); const bytes = await readBoundedFile(join(source, name), LIMITS.shardBytes);
    const existing = additions.get(code);
    check(!existing || existing.equals(bytes), `Expansion would overwrite previous addition: ${code}`);
    additions.set(code, bytes);
  }
  const result = composeCachedExpansion(base, additions, options.generatedAt);
  const stage = await mkdtemp(join(publicDirectory, '.cached-expansion-'));
  try {
    for (const [code, bytes] of additions) await writeFile(join(stage, `${code}.json`), bytes, { flag: 'wx' });
    await writeFile(join(stage, 'manifest.json'), jsonBytes(result.manifest), { flag: 'wx' });
    await writeFile(join(stage, INDEX_PATH), result.indexBytes, { flag: 'wx' });
    for (const code of additions.keys()) await rename(join(stage, `${code}.json`), join(publicDirectory, municipalityDatasetPath(code)));
    await rename(join(stage, 'manifest.json'), join(root, EXPANSION_PATH));
    await rename(join(stage, INDEX_PATH), join(publicDirectory, INDEX_PATH));
  } finally { await rm(stage, { recursive: true, force: true }); }
  return verifyIntegratedEvaluations(root);
}
