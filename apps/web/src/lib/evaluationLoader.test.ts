import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEvaluationRequest, createEvaluationShardLoader, evaluationMunicipalityHref, loadEvaluationIndex,
  parseEvaluationIndex, searchEvaluationMunicipalities, validateEvaluationShard,
  type EvaluationIndex, type EvaluationIndexEntry, type EvaluationLoadState,
} from './evaluationLoader';
import type { EvaluationDataset } from '@/types/evaluation';

const assetPrefix = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const subtle = webcrypto.subtle as unknown as SubtleCrypto;
const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).buffer;
const signal = () => new AbortController().signal;
function dataset(code = '01100', name = '札幌市'): EvaluationDataset {
  return { schemaVersion: 1, generatedAt: '2026-10-12T03:00:00Z', sources: [{
    id: `source-${code}`, municipalityCode: code, municipalityName: name,
    sourcePageUrl: 'https://example.lg.jp/evaluation/', evaluationYear: null, status: 'partial',
    discoveredDocuments: 2, fetchedDocuments: 1, extractedProjects: 1, scope: '一部の資料のみ',
    message: '最新資料の取得に失敗。以前の記録を保持。', lastAttemptAt: null, lastSuccessAt: null, documents: [],
  }], projects: [{
    id: `project-${code}`, municipalityCode: code, municipalityName: name, projectCode: null,
    projectName: '公園整備', department: null, evaluationYear: 2024, evaluatedFiscalYear: null,
    purpose: null, activities: null, outcomes: null, amounts: [], indicators: [], ratings: [], evidence: [],
    extractionStatus: 'partial', warnings: ['原資料で対象年度の確認が必要'],
  }] };
}
async function descriptor(value = dataset()): Promise<EvaluationIndexEntry> {
  const bytes = bytesOf(value);
  const hash = Array.from(new Uint8Array(await subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const { municipalityCode: code, municipalityName: name } = value.projects[0];
  return { municipalityCode: code, municipalityName: name, prefectureCode: code.slice(0, 2), discoveryStatus: 'structured', dataStatus: 'primary_available', primaryEvaluationRecords: value.projects.length,
    historicalEvaluationRecords: 0, recordsWithExplicitActualDirectCosts: 0, recordsWithSourceLabelledOutcomeIndicators: 0,
    scopeCompleteness: 'not_established', datasetPath: `evaluations-municipal/${code}.json`, datasetSha256: hash, datasetBytes: bytes.byteLength };
}
function index(entries: EvaluationIndexEntry[]): EvaluationIndex {
  return { schemaVersion: 1, datasetKind: 'municipality_evaluation_index', generatedAt: '2026-10-12T03:00:00Z', sourceProjectionSha256: 'a'.repeat(64),
    scopeMunicipalities: entries.length, primaryMunicipalities: entries.filter((entry) => entry.dataStatus === 'primary_available').length,
    primaryEvaluationRecords: entries.reduce((sum, entry) => sum + entry.primaryEvaluationRecords, 0), municipalities: entries, notes: [] };
}
const unavailable = (entry: EvaluationIndexEntry): EvaluationIndexEntry => ({ ...entry, dataStatus: 'no_structured_data_yet', discoveryStatus: 'searched_not_found', primaryEvaluationRecords: 0, datasetPath: null, datasetSha256: null, datasetBytes: 0 });
const responseFetch = (value = dataset()) => vi.fn<typeof fetch>().mockImplementation(async () => new Response(bytesOf(value)));
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('strict municipality index', () => {
  it('preserves all fields and accepts separate unavailable and historical-only states', async () => {
    const entry = await descriptor();
    const value = index([entry, unavailable({ ...entry, municipalityCode: '01202' }), { ...unavailable(entry), municipalityCode: '01203', dataStatus: 'historical_only', historicalEvaluationRecords: 47 }]);
    expect(parseEvaluationIndex(value)).toBe(value);
    expect(parseEvaluationIndex(value).municipalities[2].historicalEvaluationRecords).toBe(47);
  });
  it.each([
    ['foreign origin', { datasetPath: 'https://evil.example/01100.json' }],
    ['protocol-relative path', { datasetPath: '//evil.example/01100.json' }],
    ['traversal', { datasetPath: 'evaluations-municipal/../01100.json' }],
    ['wrong code path', { datasetPath: 'evaluations-municipal/01202.json' }],
    ['query suffix', { datasetPath: 'evaluations-municipal/01100.json?anything=1' }],
    ['leading slash', { datasetPath: '/evaluations-municipal/01100.json' }],
    ['number code', { municipalityCode: 1100 }], ['wrong prefecture', { prefectureCode: '02' }],
    ['negative count', { primaryEvaluationRecords: -1 }], ['fraction count', { historicalEvaluationRecords: 0.5 }],
    ['missing hash', { datasetSha256: null }], ['malformed hash', { datasetSha256: 'foo' }],
    ['unknown status', { discoveryStatus: 'unpublished' }], ['overclaimed scope', { scopeCompleteness: 'complete' }],
    ['unbounded size', { datasetBytes: 100 * 1024 * 1024 }], ['blank name', { municipalityName: ' ' }],
  ])('rejects %s before fetching', async (_name, changes) => {
    const value = index([await descriptor()]);
    Object.assign(value.municipalities[0], changes);
    expect(() => parseEvaluationIndex(value)).toThrow();
  });
  it('rejects duplicate codes, missing fields, mismatched totals and historical mislabelling', async () => {
    const entry = await descriptor();
    expect(() => parseEvaluationIndex(index([entry, entry]))).toThrow();
    expect(() => parseEvaluationIndex({ ...index([entry]), primaryEvaluationRecords: 2 })).toThrow();
    expect(() => parseEvaluationIndex({ ...index([entry]), primaryMunicipalities: 2 })).toThrow();
    expect(() => parseEvaluationIndex({ ...index([entry]), scopeMunicipalities: 2 })).toThrow();
    expect(() => parseEvaluationIndex({ ...index([entry]), municipalities: null })).toThrow();
    expect(() => parseEvaluationIndex(index([{ ...unavailable(entry), historicalEvaluationRecords: 1 }]))).toThrow();
    expect(() => parseEvaluationIndex(index([{ ...unavailable(entry), dataStatus: 'historical_only' }]))).toThrow();
  });
  it('validates additive baseline provenance and cohort totals', async () => {
    const value = { ...index([await descriptor()]), baselineSourceSha256: 'b'.repeat(64), cohorts: { national: { primaryMunicipalities: 0, primaryEvaluationRecords: 0 }, baseline: { primaryMunicipalities: 1, primaryEvaluationRecords: 1 } } };
    expect(parseEvaluationIndex(value)).toBe(value);
    value.cohorts.baseline.primaryEvaluationRecords = 2;
    expect(() => parseEvaluationIndex(value)).toThrow();
  });
  it('validates cached expansion cohort counts without changing the original cohorts', async () => {
    const value = { ...index([await descriptor()]), baselineSourceSha256: 'b'.repeat(64), cohorts: {
      national: { primaryMunicipalities: 0, primaryEvaluationRecords: 0 },
      baseline: { primaryMunicipalities: 0, primaryEvaluationRecords: 0 },
      cachedExpansion: { primaryMunicipalities: 1, primaryEvaluationRecords: 1 } } };
    expect(parseEvaluationIndex(value)).toBe(value);
    value.cohorts.cachedExpansion.primaryEvaluationRecords = -1;
    expect(() => parseEvaluationIndex(value)).toThrow();
    value.cohorts.cachedExpansion.primaryEvaluationRecords = 2;
    expect(() => parseEvaluationIndex(value)).toThrow();
    expect(() => parseEvaluationIndex({ ...value, cohorts: { ...value.cohorts, cachedExpansion: null } })).toThrow();
  });
  it('searches names/codes with normalization without treating project text as an index field', async () => {
    const entry = await descriptor();
    expect(searchEvaluationMunicipalities([entry], '０１１００ 札幌')).toEqual([entry]);
    expect(searchEvaluationMunicipalities([entry], '公園整備')).toEqual([]);
  });
});

describe('verified shards and bounded lazy loading', () => {
  it('loads only the index before a municipality request', async () => {
    const value = index([await descriptor()]);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(bytesOf(value)));
    expect(await loadEvaluationIndex(signal(), fetcher)).toEqual(value);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(`${assetPrefix}/evaluations-index.json`);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-cache' });
  });
  it('verifies SHA-256 and retains warnings, unknown fiscal years and original source messages', async () => {
    const value = dataset();
    const entry = await descriptor(value);
    const result = await validateEvaluationShard(bytesOf(value), entry, signal(), subtle);
    expect(result).toEqual({ dataset: value, integrity: 'sha256_verified' });
    expect(result.dataset.projects[0].evaluatedFiscalYear).toBeNull();
  });
  it('distinguishes unavailable browser crypto from verified integrity', async () => {
    const value = dataset();
    expect((await validateEvaluationShard(bytesOf(value), await descriptor(value), signal(), null)).integrity).toBe('sha256_unavailable');
  });
  it('rejects byte mismatches, same-length tampering and malformed JSON', async () => {
    const value = dataset();
    const entry = await descriptor(value);
    await expect(validateEvaluationShard(bytesOf(value), { ...entry, datasetBytes: entry.datasetBytes + 1 }, signal(), subtle)).rejects.toThrow('バイト数');
    const altered = bytesOf({ ...value, generatedAt: '2026-10-11T03:00:00Z' });
    expect(altered.byteLength).toBe(entry.datasetBytes);
    await expect(validateEvaluationShard(altered, entry, signal(), subtle)).rejects.toThrow('SHA-256');
    await expect(validateEvaluationShard(new TextEncoder().encode('{').buffer, { ...entry, datasetBytes: 1 }, signal(), null)).rejects.toThrow('JSON');
  });
  it('rejects same-path foreign municipality source/project codes, names, count mismatch and duplicate IDs', async () => {
    for (const change of [
      (value: EvaluationDataset) => { value.sources[0].municipalityCode = '01202'; },
      (value: EvaluationDataset) => { value.projects[0].municipalityCode = '01202'; },
      (value: EvaluationDataset) => { value.projects[0].municipalityName = '別の市'; },
      (value: EvaluationDataset) => { value.projects.push(value.projects[0]); },
    ]) {
      const value = dataset(); change(value);
      const entry = { ...await descriptor(value), municipalityCode: '01100', municipalityName: '札幌市', primaryEvaluationRecords: value.projects.length };
      await expect(validateEvaluationShard(bytesOf(value), entry, signal(), subtle)).rejects.toThrow('コード・名称・件数');
    }
    const value = dataset();
    await expect(validateEvaluationShard(bytesOf(value), { ...await descriptor(value), primaryEvaluationRecords: 2 }, signal(), subtle)).rejects.toThrow('コード・名称・件数');
  });
  it('refuses non-local descriptors without making a network request', async () => {
    const fetcher = responseFetch(); const loader = createEvaluationShardLoader({ fetcher, subtle });
    await expect(loader.load({ ...await descriptor(), datasetPath: 'https://example.com/x' }, signal())).rejects.toThrow('配信先');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('caches only requested cities and forces a fresh request on retry or clear', async () => {
    const fetcher = responseFetch(); const loader = createEvaluationShardLoader({ fetcher, subtle }); const entry = await descriptor();
    const first = await loader.load(entry, signal());
    expect(await loader.load(entry, signal())).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(`${assetPrefix}/evaluations-municipal/01100.json`);
    await loader.load(entry, signal(), true); expect(fetcher).toHaveBeenCalledTimes(2);
    loader.clear(); await loader.load(entry, signal()); expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('evicts least recently used shards by entry count and source byte budget', async () => {
    const values = [dataset('01100'), dataset('01202'), dataset('01203')];
    const entries = await Promise.all(values.map(descriptor));
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => new Response(bytesOf(values[entries.findIndex((entry) => String(url).endsWith(entry.datasetPath!))])));
    const loader = createEvaluationShardLoader({ fetcher, subtle, maxEntries: 2 });
    await loader.load(entries[0], signal()); await loader.load(entries[1], signal()); await loader.load(entries[0], signal());
    await loader.load(entries[2], signal()); await loader.load(entries[1], signal()); expect(fetcher).toHaveBeenCalledTimes(4);
    const tiny = createEvaluationShardLoader({ fetcher, subtle, maxBytes: entries[0].datasetBytes - 1 });
    await tiny.load(entries[0], signal()); await tiny.load(entries[0], signal()); expect(fetcher).toHaveBeenCalledTimes(6);
  });
  it('does not cache failed HTTP, integrity, or aborted requests; retry succeeds', async () => {
    const value = dataset(); const entry = await descriptor(value);
    const fetcher = responseFetch(value).mockResolvedValueOnce(new Response('fail', { status: 503 }))
      .mockResolvedValueOnce(new Response(bytesOf({ ...value, generatedAt: '2026-10-11T03:00:00Z' })));
    const loader = createEvaluationShardLoader({ fetcher, subtle });
    await expect(loader.load(entry, signal())).rejects.toThrow('HTTP 503');
    await expect(loader.load(entry, signal())).rejects.toThrow('SHA-256');
    expect((await loader.load(entry, signal())).dataset).toEqual(value);
    const controller = new AbortController(); controller.abort();
    await expect(loader.load(entry, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('rejects overflow from streams even with no Content-Length', async () => {
    const entry = await descriptor(); const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array(entry.datasetBytes + 1)));
    await expect(createEvaluationShardLoader({ fetcher, subtle }).load(entry, signal())).rejects.toThrow('サイズ');
  });
});

const settle = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
describe('latest-request lifecycle and navigation contract', () => {
  it('aborts the old request and ignores an old success after a new municipality wins', async () => {
    const request = createEvaluationRequest<string>(); const states: EvaluationLoadState<string>[] = [];
    let finish!: (value: string) => void; let previous!: AbortSignal;
    request.run((signal) => { previous = signal; return new Promise((resolve) => { finish = resolve; }); }, (state) => states.push(state));
    await settle();
    const cleanup = request.run(async () => 'new municipality', (state) => states.push(state));
    expect(previous.aborted).toBe(true); await settle(); finish('old municipality'); await settle();
    expect(states).toEqual([{ status: 'loading' }, { status: 'loading' }, { status: 'ready', value: 'new municipality' }]); cleanup();
  });
  it('ignores stale rejection and allows error -> retry -> ready', async () => {
    const request = createEvaluationRequest<string>(); const states: EvaluationLoadState<string>[] = [];
    let reject!: (error: Error) => void;
    request.run(() => new Promise((_resolve, fail) => { reject = fail; }), (state) => states.push(state)); await settle();
    request.run(async () => { throw new Error('network failure'); }, (state) => states.push(state)); await settle();
    reject(new Error('stale failure')); await settle();
    const cleanup = request.run(async () => 'retry succeeded', (state) => states.push(state)); await settle();
    expect(states.filter((state) => state.status === 'error')).toEqual([{ status: 'error', message: 'network failure' }]);
    expect(states.at(-1)).toEqual({ status: 'ready', value: 'retry succeeded' }); cleanup();
  });
  it('cleanup cancels navigation/unmount without emitting an error, including an immediate cancel', async () => {
    const request = createEvaluationRequest<string>(); const update = vi.fn(); const operation = vi.fn(async () => 'ignored');
    const cleanup = request.run(operation, update); cleanup(); await settle();
    expect(operation).not.toHaveBeenCalled(); expect(update).toHaveBeenCalledExactlyOnceWith({ status: 'loading' });
  });
  it('times out even if transport ignores abort; late result is suppressed and retry works', async () => {
    vi.useFakeTimers(); const request = createEvaluationRequest<string>(1000); const states: EvaluationLoadState<string>[] = [];
    let finish!: (value: string) => void;
    request.run(() => new Promise((resolve) => { finish = resolve; }), (state) => states.push(state)); await settle();
    await vi.advanceTimersByTimeAsync(1000); finish('too late'); await settle();
    expect(states).toHaveLength(2); expect(states[1]).toMatchObject({ status: 'error' });
    const cleanup = request.run(async () => 'fresh', (state) => states.push(state)); await settle();
    expect(states.at(-1)).toEqual({ status: 'ready', value: 'fresh' }); cleanup();
  });
  it('keeps codes in shareable municipality URLs and clears to the index overview', () => {
    expect(evaluationMunicipalityHref('01100')).toBe('/evaluations/?municipality=01100');
    expect(evaluationMunicipalityHref('')).toBe('/evaluations/');
    expect(new URL(evaluationMunicipalityHref('01100'), 'https://example.com').searchParams.get('municipality')).toBe('01100');
  });
});

describe('static base-path deployment and interrupted integrity checks', () => {
  it.each(['', '/local_gov_vis'])('routes index and exact municipality assets through base path %s', async (basePath) => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', basePath);
    vi.resetModules();
    const basePathLoader = await import('./evaluationLoader');
    const entry = await descriptor(); const value = index([entry]);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(bytesOf(value))).mockResolvedValueOnce(new Response(bytesOf(dataset())));
    await basePathLoader.loadEvaluationIndex(signal(), fetcher);
    await basePathLoader.createEvaluationShardLoader({ fetcher, subtle }).load(entry, signal());
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([`${basePath}/evaluations-index.json`, `${basePath}/evaluations-municipal/01100.json`]);
    vi.unstubAllEnvs(); vi.resetModules();
  });
  it('rejects abort during a delayed digest and does not cache the stale city', async () => {
    const entry = await descriptor(); const fetcher = responseFetch(); const controller = new AbortController();
    let release!: (buffer: ArrayBuffer) => void;
    const delayed = { digest: vi.fn().mockImplementationOnce(() => new Promise<ArrayBuffer>((resolve) => { release = resolve; })).mockImplementation((...args: Parameters<SubtleCrypto['digest']>) => subtle.digest(...args)) } as unknown as SubtleCrypto;
    const loader = createEvaluationShardLoader({ fetcher, subtle: delayed });
    const pending = loader.load(entry, controller.signal);
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    controller.abort(); release(await subtle.digest('SHA-256', bytesOf(dataset())));
    await rejection;
    await loader.load(entry, signal()); expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
