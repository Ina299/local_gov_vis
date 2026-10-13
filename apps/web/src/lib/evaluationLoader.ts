import { parseEvaluationDataset } from './evaluations';
import { dataUrl } from './paths';
import type { EvaluationDataset } from '@/types/evaluation';

export type EvaluationDiscoveryStatus = 'structured' | 'fetched' | 'discovered' | 'blocked' | 'searched_not_found';
export type EvaluationDataStatus = 'primary_available' | 'historical_only' | 'no_structured_data_yet';
export interface EvaluationIndexEntry {
  municipalityCode: string;
  municipalityName: string;
  prefectureCode: string;
  discoveryStatus: EvaluationDiscoveryStatus;
  dataStatus: EvaluationDataStatus;
  primaryEvaluationRecords: number;
  historicalEvaluationRecords: number;
  recordsWithExplicitActualDirectCosts: number;
  recordsWithSourceLabelledOutcomeIndicators: number;
  scopeCompleteness: 'not_established';
  datasetPath: string | null;
  datasetSha256: string | null;
  datasetBytes: number;
}
export interface EvaluationIndex {
  schemaVersion: 1;
  datasetKind: 'municipality_evaluation_index';
  generatedAt: string;
  sourceProjectionSha256: string;
  scopeMunicipalities: number;
  primaryEvaluationRecords: number;
  primaryMunicipalities: number;
  municipalities: EvaluationIndexEntry[];
  notes: string[];
  baselineSourceSha256?: string;
  cohorts?: {
    national: { primaryMunicipalities: number; primaryEvaluationRecords: number };
    baseline: { primaryMunicipalities: number; primaryEvaluationRecords: number };
    cachedExpansion?: { primaryMunicipalities: number; primaryEvaluationRecords: number };
  };
}
export interface LoadedEvaluationShard {
  dataset: EvaluationDataset;
  integrity: 'sha256_verified' | 'sha256_unavailable';
}
export type EvaluationLoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; value: T };

const MAX_INDEX_BYTES = 4 * 1024 * 1024;
const MAX_SHARD_BYTES = 32 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const CODE = /^(0[1-9]|[1-3][0-9]|4[0-7])[0-9]{3}$/;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isHash = (value: unknown): value is string => typeof value === 'string' && HASH.test(value);
const isDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

/** Exact local path, code and totals are checked before any municipality is fetched. */
export function parseEvaluationIndex(value: unknown): EvaluationIndex {
  const invalid = () => new Error('自治体一覧の形式・件数・配信先を確認できませんでした。');
  if (!isRecord(value) || value.schemaVersion !== 1 || value.datasetKind !== 'municipality_evaluation_index'
    || !isDate(value.generatedAt) || !isHash(value.sourceProjectionSha256)
    || !isCount(value.scopeMunicipalities) || !isCount(value.primaryEvaluationRecords) || !isCount(value.primaryMunicipalities)
    || !Array.isArray(value.municipalities) || value.scopeMunicipalities !== value.municipalities.length
    || !Array.isArray(value.notes) || !value.notes.every((note) => typeof note === 'string')) throw invalid();
  if (value.cohorts !== undefined || value.baselineSourceSha256 !== undefined) {
    if (!isHash(value.baselineSourceSha256) || !isRecord(value.cohorts)
      || !isRecord(value.cohorts.national) || !isRecord(value.cohorts.baseline)) throw invalid();
    const { national, baseline, cachedExpansion } = value.cohorts;
    if (cachedExpansion !== undefined && (!isRecord(cachedExpansion) || !isCount(cachedExpansion.primaryMunicipalities) || !isCount(cachedExpansion.primaryEvaluationRecords))) throw invalid();
    const expansion = (cachedExpansion ?? { primaryMunicipalities: 0, primaryEvaluationRecords: 0 }) as { primaryMunicipalities: number; primaryEvaluationRecords: number };
    if (![national.primaryMunicipalities, national.primaryEvaluationRecords, baseline.primaryMunicipalities, baseline.primaryEvaluationRecords].every(isCount)
      || Number(national.primaryMunicipalities) + Number(baseline.primaryMunicipalities) + expansion.primaryMunicipalities !== value.primaryMunicipalities
      || Number(national.primaryEvaluationRecords) + Number(baseline.primaryEvaluationRecords) + expansion.primaryEvaluationRecords !== value.primaryEvaluationRecords) throw invalid();
  }
  const codes = new Set<string>();
  let records = 0;
  let available = 0;
  for (const entry of value.municipalities) {
    if (!isRecord(entry) || typeof entry.municipalityCode !== 'string' || !CODE.test(entry.municipalityCode)
      || typeof entry.municipalityName !== 'string' || !entry.municipalityName.trim()
      || entry.prefectureCode !== entry.municipalityCode.slice(0, 2) || codes.has(entry.municipalityCode)
      || !['structured', 'fetched', 'discovered', 'blocked', 'searched_not_found'].includes(String(entry.discoveryStatus))
      || !['primary_available', 'historical_only', 'no_structured_data_yet'].includes(String(entry.dataStatus))
      || entry.scopeCompleteness !== 'not_established'
      || !isCount(entry.primaryEvaluationRecords) || !isCount(entry.historicalEvaluationRecords)
      || !isCount(entry.recordsWithExplicitActualDirectCosts) || !isCount(entry.recordsWithSourceLabelledOutcomeIndicators)
      || entry.recordsWithExplicitActualDirectCosts > entry.primaryEvaluationRecords
      || entry.recordsWithSourceLabelledOutcomeIndicators > entry.primaryEvaluationRecords
      || !isCount(entry.datasetBytes)) throw invalid();
    codes.add(entry.municipalityCode);
    if (entry.dataStatus === 'primary_available') {
      if (entry.primaryEvaluationRecords === 0 || entry.datasetBytes === 0 || entry.datasetBytes > MAX_SHARD_BYTES
        || entry.datasetPath !== `evaluations-municipal/${entry.municipalityCode}.json` || !isHash(entry.datasetSha256)) throw invalid();
      available += 1;
    } else if (entry.primaryEvaluationRecords !== 0 || entry.datasetPath !== null || entry.datasetSha256 !== null || entry.datasetBytes !== 0
      || (entry.dataStatus === 'historical_only' && entry.historicalEvaluationRecords === 0)
      || (entry.dataStatus === 'no_structured_data_yet' && entry.historicalEvaluationRecords !== 0)) throw invalid();
    records += entry.primaryEvaluationRecords;
  }
  if (records !== value.primaryEvaluationRecords || available !== value.primaryMunicipalities) throw invalid();
  return value as unknown as EvaluationIndex;
}

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('読み込みを中止しました。', 'AbortError');
}
async function fetchBytes(path: string, signal: AbortSignal, maxBytes: number, fetcher: typeof fetch): Promise<ArrayBuffer> {
  assertNotAborted(signal);
  const response = await fetcher(dataUrl(path), { signal, cache: 'no-cache', redirect: 'error' });
  if (!response.ok) throw new Error(`データを取得できませんでした（HTTP ${response.status}）。`);
  const declaredLength = response.headers.get('content-length');
  if (declaredLength && Number(declaredLength) > maxBytes) throw new Error('データのサイズが上限を超えています。');
  // Streams bound memory even when Content-Length is absent or incorrect.
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        assertNotAborted(signal);
        const { done, value } = await reader.read();
        assertNotAborted(signal);
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) throw new Error('データのサイズが上限を超えています。');
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally { reader.releaseLock(); }
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    return joined.buffer;
  }
  const bytes = await response.arrayBuffer();
  assertNotAborted(signal);
  if (bytes.byteLength > maxBytes) throw new Error('データのサイズが上限を超えています。');
  return bytes;
}
function parseJson(bytes: ArrayBuffer): unknown {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new Error('配信されたJSONデータを読み取れませんでした。'); }
}
export async function loadEvaluationIndex(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<EvaluationIndex> {
  const bytes = await fetchBytes('/evaluations-index.json', signal, MAX_INDEX_BYTES, fetcher);
  assertNotAborted(signal);
  return parseEvaluationIndex(parseJson(bytes));
}

export async function validateEvaluationShard(
  bytes: ArrayBuffer, entry: EvaluationIndexEntry, signal: AbortSignal,
  subtle: SubtleCrypto | null = globalThis.crypto?.subtle ?? null,
): Promise<LoadedEvaluationShard> {
  assertNotAborted(signal);
  if (bytes.byteLength !== entry.datasetBytes) throw new Error('自治体データのバイト数が一覧と一致しません。再読み込みしてください。');
  if (subtle) {
    const digest = await subtle.digest('SHA-256', bytes);
    const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== entry.datasetSha256) throw new Error('自治体データのSHA-256が一覧と一致しません。再読み込みしてください。');
  }
  assertNotAborted(signal);
  const dataset = parseEvaluationDataset(parseJson(bytes));
  const ids = new Set<string>();
  if (dataset.projects.length !== entry.primaryEvaluationRecords
    || [...dataset.sources, ...dataset.projects].some((record) => record.municipalityCode !== entry.municipalityCode || record.municipalityName !== entry.municipalityName)
    || dataset.projects.some((project) => { if (ids.has(project.id)) return true; ids.add(project.id); return false; })) {
    throw new Error('自治体データのコード・名称・件数が一覧と一致しません。');
  }
  return { dataset, integrity: subtle ? 'sha256_verified' : 'sha256_unavailable' };
}

/** Per-page LRU cache: at most three municipalities and 12 MiB of source bytes. Never caches failures. */
export function createEvaluationShardLoader(options: {
  fetcher?: typeof fetch; subtle?: SubtleCrypto | null; maxEntries?: number; maxBytes?: number;
} = {}) {
  const cache = new Map<string, { value: LoadedEvaluationShard; bytes: number }>();
  const maxEntries = Math.max(0, options.maxEntries ?? 3);
  const maxBytes = Math.max(0, options.maxBytes ?? 12 * 1024 * 1024);
  return {
    clear() { cache.clear(); },
    async load(entry: EvaluationIndexEntry, signal: AbortSignal, reload = false): Promise<LoadedEvaluationShard> {
      assertNotAborted(signal);
      // Recheck even for a caller that did not obtain its descriptor from the index parser.
      if (!CODE.test(entry.municipalityCode) || entry.datasetPath !== `evaluations-municipal/${entry.municipalityCode}.json`
        || !isHash(entry.datasetSha256) || !isCount(entry.datasetBytes) || entry.datasetBytes === 0
        || entry.datasetBytes > MAX_SHARD_BYTES || entry.dataStatus !== 'primary_available') throw new Error('この自治体の配信先を確認できませんでした。');
      const key = JSON.stringify([entry.municipalityCode, entry.municipalityName, entry.datasetPath, entry.datasetSha256, entry.datasetBytes, entry.primaryEvaluationRecords]);
      const cached = cache.get(key);
      if (cached && !reload) {
        cache.delete(key); cache.set(key, cached);
        return cached.value;
      }
      cache.delete(key);
      const bytes = await fetchBytes(`/${entry.datasetPath}`, signal, entry.datasetBytes, options.fetcher ?? fetch);
      const value = await validateEvaluationShard(bytes, entry, signal, options.subtle === undefined ? globalThis.crypto?.subtle ?? null : options.subtle);
      assertNotAborted(signal);
      if (maxEntries > 0 && bytes.byteLength <= maxBytes) {
        cache.set(key, { value, bytes: bytes.byteLength });
        while (cache.size > maxEntries || Array.from(cache.values()).reduce((sum, item) => sum + item.bytes, 0) > maxBytes) {
          cache.delete(cache.keys().next().value as string);
        }
      }
      return value;
    },
  };
}

/** Latest request wins, including fetch implementations that ignore abort and delayed hash checks. */
export function createEvaluationRequest<T>(timeoutMs = 60_000) {
  let current: (() => void) | null = null;
  return {
    run(operation: (signal: AbortSignal) => Promise<T>, update: (state: EvaluationLoadState<T>) => void): () => void {
      current?.();
      const controller = new AbortController();
      let active = true;
      let timer: ReturnType<typeof setTimeout>;
      const cancel = () => { active = false; clearTimeout(timer); controller.abort(); if (current === cancel) current = null; };
      current = cancel;
      timer = setTimeout(() => {
        if (active) { cancel(); update({ status: 'error', message: 'データの読み込みがタイムアウトしました。再試行してください。' }); }
      }, timeoutMs);
      update({ status: 'loading' });
      Promise.resolve().then(() => { assertNotAborted(controller.signal); return operation(controller.signal); })
        .then((value) => { if (active) { clearTimeout(timer); update({ status: 'ready', value }); } })
        .catch((error: unknown) => {
          if (active) { clearTimeout(timer); update({ status: 'error', message: error instanceof Error ? error.message : '読み込みに失敗しました。' }); }
        });
      return cancel;
    },
  };
}

export function evaluationMunicipalityHref(code: string): string {
  return code ? `/evaluations/?${new URLSearchParams({ municipality: code })}` : '/evaluations/';
}
export function searchEvaluationMunicipalities(entries: EvaluationIndexEntry[], query: string): EvaluationIndexEntry[] {
  const terms = query.normalize('NFKC').toLocaleLowerCase('ja-JP').trim().split(/\s+/).filter(Boolean);
  return entries.filter((entry) => terms.every((term) => `${entry.municipalityName} ${entry.municipalityCode}`.normalize('NFKC').toLocaleLowerCase('ja-JP').includes(term)));
}
