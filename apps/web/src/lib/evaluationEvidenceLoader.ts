import { dataUrl } from './paths';
import { safeEvidenceUrl } from './evaluationEvidence';
import type { DocumentText, EvidenceIndex, EvidenceSource, IndexEntry, MunicipalityEvidence, OfficialLink } from '@/types/evaluationEvidence';

const MAX_INDEX_BYTES = 8 * 1024 * 1024;
const MAX_CITY_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_TEXT_CHARACTERS = 120_000;
const CODE = /^(0[1-9]|[1-3][0-9]|4[0-7])[0-9]{3}$/;
const HASH = /^[a-f0-9]{64}$/;
const SOURCE_ID = /^[a-f0-9]{24}$/;
const DISCOVERY = ['not_searched', 'searched_not_found', 'discovered', 'fetched', 'structured', 'blocked', 'unsupported'];
const EVIDENCE = ['text_available', 'sources_available', 'official_fallback_only', 'no_verified_sources'];
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === 'string';
const named = (v: unknown): v is string => string(v) && v.trim().length > 0;
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const hash = (v: unknown): v is string => string(v) && HASH.test(v);
const nullableHash = (v: unknown) => v === null || hash(v);
const nullableString = (v: unknown) => v === null || string(v);
const date = (v: unknown) => string(v) && Number.isFinite(Date.parse(v));
const url = (v: unknown): v is string => string(v) && safeEvidenceUrl(v) !== null;
const oneOf = (v: unknown, values: string[]) => string(v) && values.includes(v);
const validId = (v: unknown): v is string => string(v) && SOURCE_ID.test(v);
const invalid = (section: string) => new Error(`${section}の形式・自治体・配信先を確認できませんでした。`);

function identity(v: unknown): v is IndexEntry {
  return record(v) && string(v.municipalityCode) && CODE.test(v.municipalityCode)
    && named(v.municipalityName) && v.prefectureCode === v.municipalityCode.slice(0, 2) && named(v.prefectureName);
}
function officialLink(v: unknown): v is OfficialLink | null {
  return v === null || (record(v) && url(v.url) && named(v.title)
    && oneOf(v.kind, ['official_homepage', 'official_directory_page']) && named(v.verificationBasis)
    && url(v.evidenceUrl) && hash(v.evidenceSha256));
}
function cityDescriptor(v: unknown): v is IndexEntry {
  return identity(v) && v.shardPath === `municipalities/${v.municipalityCode}.json`
    && hash(v.shardSha256) && count(v.shardBytes) && v.shardBytes > 0 && v.shardBytes <= MAX_CITY_BYTES;
}
export function parseEvidenceIndex(value: unknown): EvidenceIndex {
  if (!record(value) || value.schemaVersion !== 1 || value.scopeMunicipalities !== 1741 || !date(value.snapshotAt)
    || !record(value.counts) || !Object.values(value.counts).every(count)
    || !Array.isArray(value.municipalities) || value.municipalities.length !== 1741) throw invalid('全国一覧');
  const codes = new Set<string>();
  for (const entry of value.municipalities) {
    if (!cityDescriptor(entry) || codes.has(entry.municipalityCode)
      || !oneOf(entry.discoveryStatus, DISCOVERY) || !oneOf(entry.evidenceStatus, EVIDENCE)
      || ![entry.evaluationPageCount, entry.sourceCount, entry.candidateCount, entry.acquiredCount, entry.textDocumentCount, entry.substantiveTextDocumentCount].every(count)
      || entry.evaluationPageCount > entry.sourceCount || entry.textDocumentCount > entry.acquiredCount
      || entry.substantiveTextDocumentCount > entry.textDocumentCount
      || entry.acquiredCount > entry.sourceCount + entry.candidateCount
      || !officialLink(entry.officialHomepage) || !officialLink(entry.officialFallback)) throw invalid('全国一覧');
    codes.add(entry.municipalityCode);
  }
  const rows = value.municipalities as IndexEntry[];
  const sums: Record<string, number> = {
    municipalities: rows.length,
    municipalitiesWithAcquiredArtifacts: rows.filter((r) => r.acquiredCount > 0).length,
    municipalitiesWithEvaluationPages: rows.filter((r) => r.evaluationPageCount > 0).length,
    municipalitiesWithOfficialFallback: rows.filter((r) => r.officialFallback !== null).length,
    municipalitiesWithOfficialHomepage: rows.filter((r) => r.officialHomepage !== null).length,
    municipalitiesWithReadableText: rows.filter((r) => r.textDocumentCount > 0).length,
    municipalitiesWithSubstantiveEvaluationText: rows.filter((r) => r.substantiveTextDocumentCount > 0).length,
    municipalitiesWithVerifiedSources: rows.filter((r) => r.sourceCount > 0).length,
    acquiredSourceRows: rows.reduce((sum, r) => sum + r.acquiredCount, 0),
    candidateSourceRows: rows.reduce((sum, r) => sum + r.candidateCount, 0),
    verifiedSourceRows: rows.reduce((sum, r) => sum + r.sourceCount, 0),
    sourceRows: rows.reduce((sum, r) => sum + r.sourceCount + r.candidateCount, 0),
    substantiveEvaluationTextDocuments: rows.reduce((sum, r) => sum + r.substantiveTextDocumentCount, 0),
    textDocuments: rows.reduce((sum, r) => sum + r.textDocumentCount, 0),
  };
  if (Object.entries(sums).some(([key, n]) => (value.counts as Record<string, unknown>)[key] !== n)) throw invalid('全国一覧の件数');
  return value as unknown as EvidenceIndex;
}

function acquisitionOrigin(v: Record<string, unknown>): boolean {
  return v.method === 'network' ? v.containerSha256 === null && v.memberPath === null && v.memberIndex === null
    : v.method === 'archive_member' && hash(v.containerSha256) && named(v.memberPath) && count(v.memberIndex);
}

function sourceRecord(v: unknown): v is EvidenceSource {
  if (!record(v) || !validId(v.id) || !url(v.url) || !named(v.title) || !named(v.format)
    || !oneOf(v.titleBasis, ['html_title', 'official_link_label', 'inventory_title', 'source_filename'])
    || !oneOf(v.role, ['evaluation_landing_page', 'evaluation_document', 'supporting_document', 'official_page', 'candidate'])
    || !oneOf(v.evaluationType, ['business_project_evaluation', 'policy_evaluation', 'facility_evaluation', 'education_inspection', 'mixed_evaluation', 'grant_project_evaluation', 'administrative_reform', 'project_activity_report', 'sector_evaluation', 'unknown'])
    || !record(v.verification) || !oneOf(v.verification.status, ['verified', 'official_host_only', 'unverified'])
    || !Array.isArray(v.verification.basis) || !v.verification.basis.every(string)
    || !(v.verification.evidenceSourceId === null || validId(v.verification.evidenceSourceId))
    || !nullableHash(v.verification.evidenceSha256) || !oneOf(v.verification.evaluationRelevance, ['verified', 'not_established'])
    || !record(v.acquisition) || !oneOf(v.acquisition.state, ['acquired', 'blocked', 'failed', 'discovered', 'cache_missing', 'hash_mismatch', 'format_integrity_hold'])
    || !oneOf(v.acquisition.inputStatus, DISCOVERY) || !acquisitionOrigin(v.acquisition)
    || !(v.acquisition.fetchedAt === null || date(v.acquisition.fetchedAt))
    || !(v.acquisition.httpStatus === null || (count(v.acquisition.httpStatus) && v.acquisition.httpStatus >= 100 && v.acquisition.httpStatus <= 599))
    || !nullableHash(v.acquisition.sourceSha256)
    || !record(v.text) || !oneOf(v.text.status, ['available', 'not_acquired', 'not_extracted', 'no_readable_text', 'verification_pending', 'format_integrity_hold', 'sanitization_hold'])
    || v.text.label !== 'unstructured_source_text' || !nullableString(v.text.preview)
    || !count(v.text.characters) || !count(v.text.exportedCharacters) || v.text.exportedCharacters > MAX_TEXT_CHARACTERS
    || v.text.exportedCharacters > v.text.characters || typeof v.text.truncated !== 'boolean'
    || !nullableHash(v.text.textSha256) || !nullableHash(v.text.inputTextSha256) || !nullableString(v.text.extractionMethod)
    || !Array.isArray(v.years) || v.years.some((y) => !record(y) || !named(y.label)
      || !count(y.calendarYear) || y.calendarYear < 1868 || y.calendarYear > 2200
      || !oneOf(y.meaning, ['evaluation_year', 'fiscal_year_mentioned', 'calendar_year_mentioned', 'unknown'])
      || !oneOf(y.basis, ['source_title', 'official_link_label', 'printed_text']) || !named(y.quote))) return false;
  if (v.navigationReview !== undefined) {
    const review = v.navigationReview;
    if (!record(review) || !oneOf(review.method, ['official_body_review', 'search_candidate'])
      || !date(review.checkedAt) || !named(review.publisher) || !url(review.evidenceUrl)
      || !(review.originEvidenceUrl === null || url(review.originEvidenceUrl))
      || !string(review.notes) || !string(review.yearNotes) || review.rawArchiveState !== 'not_downloaded'
      || !oneOf(v.acquisition.state, ['discovered', 'blocked']) || v.acquisition.sourceSha256 !== null
      || v.acquisition.inputStatus !== v.acquisition.state || v.acquisition.method !== 'network'
      || v.acquisition.fetchedAt !== null || v.acquisition.httpStatus !== null
      || v.verification.evidenceSourceId !== null || v.verification.evidenceSha256 !== null
      || v.text.status !== 'not_acquired' || v.text.preview !== null
      || v.text.characters !== 0 || v.text.exportedCharacters !== 0 || v.text.truncated !== false
      || v.text.textSha256 !== null || v.text.inputTextSha256 !== null || v.text.extractionMethod !== null
      || v.years.length !== 0
      || (review.method === 'search_candidate' && (v.role !== 'candidate' || v.verification.evaluationRelevance !== 'not_established'))
      || (review.method === 'official_body_review' && v.role === 'candidate')
      || (review.method === 'official_body_review') !== (v.verification.status === 'verified')) return false;
  }
  if (v.text.status === 'available') {
    return v.verification.status === 'verified'
      && v.acquisition.state === 'acquired' && hash(v.acquisition.sourceSha256)
      && v.text.assetPath === `documents/${v.id}.json`
      && hash(v.text.assetSha256) && count(v.text.assetBytes) && v.text.assetBytes > 0 && v.text.assetBytes <= MAX_TEXT_BYTES
      && hash(v.text.textSha256) && v.text.exportedCharacters > 0 && named(v.text.extractionMethod)
      && v.text.truncated === (v.text.exportedCharacters < v.text.characters);
  }
  return v.text.assetPath === null && v.text.assetSha256 === null && v.text.assetBytes === 0;
}

export function parseMunicipalityEvidence(value: unknown, entry: IndexEntry): MunicipalityEvidence {
  if (!record(value) || value.schemaVersion !== 1 || !identity(value.municipality)
    || (['municipalityCode', 'municipalityName', 'prefectureCode', 'prefectureName'] as const).some((key) => (value.municipality as unknown as IndexEntry)[key] !== entry[key])
    || !record(value.discovery) || value.discovery.status !== entry.discoveryStatus
    || typeof value.discovery.initialLook !== 'boolean' || !count(value.discovery.searchAttemptsCount)
    || value.discovery.coverageCompleteness !== 'not_established' || !count(value.discovery.omittedRejectedSources)
    || !officialLink(value.officialHomepage) || !officialLink(value.officialFallback)
    || !Array.isArray(value.officialDirectoryLinks) || !value.officialDirectoryLinks.every((link) => link !== null && officialLink(link))
    || !Array.isArray(value.sources) || !value.sources.every(sourceRecord)
    || !Array.isArray(value.evaluationPages) || !value.evaluationPages.every(validId)) throw invalid('自治体資料');
  const data = value as unknown as MunicipalityEvidence;
  const ids = new Set(data.sources.map((source) => source.id));
  if (ids.size !== data.sources.length || new Set(data.evaluationPages).size !== data.evaluationPages.length
    || data.evaluationPages.length !== entry.evaluationPageCount
    || data.evaluationPages.some((id) => !data.sources.some((source) => source.id === id && source.role === 'evaluation_landing_page' && source.verification.status === 'verified'))
    || data.sources.filter((source) => source.text.status === 'available').length !== entry.textDocumentCount
    || data.sources.filter((source) => source.text.status === 'available' && source.role === 'evaluation_document').length !== entry.substantiveTextDocumentCount
    || data.sources.filter((source) => source.verification.status === 'verified').length !== entry.sourceCount
    || data.sources.filter((source) => source.verification.status !== 'verified').length !== entry.candidateCount
    || data.sources.filter((source) => source.acquisition.state === 'acquired').length !== entry.acquiredCount
    || JSON.stringify(data.officialHomepage) !== JSON.stringify(entry.officialHomepage)
    || JSON.stringify(data.officialFallback) !== JSON.stringify(entry.officialFallback)) throw invalid('自治体資料');
  return data;
}

function notAborted(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('読み込みを中止しました。', 'AbortError');
}
async function fetchBytes(path: string, signal: AbortSignal, maximum: number, fetcher: typeof fetch): Promise<ArrayBuffer> {
  notAborted(signal);
  const response = await fetcher(dataUrl(`/${path}`), { signal, cache: 'no-cache', redirect: 'error' });
  if (!response.ok) throw new Error(`データを取得できませんでした（HTTP ${response.status}）。`);
  const declared = response.headers.get('content-length');
  if (declared && Number(declared) > maximum) throw new Error('データのサイズが上限を超えています。');
  if (!response.body) {
    const bytes = await response.arrayBuffer(); notAborted(signal);
    if (bytes.byteLength > maximum) throw new Error('データのサイズが上限を超えています。');
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      notAborted(signal);
      const { done, value } = await reader.read(); notAborted(signal);
      if (done) break;
      total += value.byteLength;
      if (total > maximum) throw new Error('データのサイズが上限を超えています。');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}
function json(bytes: ArrayBuffer): unknown {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new Error('配信されたJSONデータを読み取れませんでした。'); }
}
type Integrity = 'sha256_verified' | 'sha256_unavailable';
export interface LoadedEvidence<T> { data: T; integrity: Integrity }
async function verify(bytes: ArrayBuffer, expectedBytes: number, expectedHash: string, signal: AbortSignal, subtle: SubtleCrypto | null): Promise<Integrity> {
  notAborted(signal);
  if (bytes.byteLength !== expectedBytes) throw new Error('データのバイト数が一覧と一致しません。再読み込みしてください。');
  if (!subtle) return 'sha256_unavailable';
  const digest = await subtle.digest('SHA-256', bytes); notAborted(signal);
  const actual = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  if (actual !== expectedHash) throw new Error('データのSHA-256が一覧と一致しません。再読み込みしてください。');
  return 'sha256_verified';
}
export async function loadEvidenceIndex(signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<EvidenceIndex> {
  const bytes = await fetchBytes('evaluation-evidence/index.json', signal, MAX_INDEX_BYTES, fetcher);
  notAborted(signal); return parseEvidenceIndex(json(bytes));
}
export async function validateMunicipalityEvidence(bytes: ArrayBuffer, entry: IndexEntry, signal: AbortSignal, subtle: SubtleCrypto | null = globalThis.crypto?.subtle ?? null): Promise<LoadedEvidence<MunicipalityEvidence>> {
  if (!cityDescriptor(entry)) throw invalid('自治体配信先');
  const integrity = await verify(bytes, entry.shardBytes, entry.shardSha256, signal, subtle);
  return { data: parseMunicipalityEvidence(json(bytes), entry), integrity };
}
export async function validateDocumentText(bytes: ArrayBuffer, municipalityCode: string, source: EvidenceSource, signal: AbortSignal, subtle: SubtleCrypto | null = globalThis.crypto?.subtle ?? null): Promise<LoadedEvidence<DocumentText>> {
  if (!CODE.test(municipalityCode) || !sourceRecord(source) || source.text.status !== 'available') throw invalid('テキスト配信先');
  const integrity = await verify(bytes, source.text.assetBytes, source.text.assetSha256!, signal, subtle);
  const value = json(bytes);
  if (!record(value) || value.schemaVersion !== 1 || value.label !== 'unstructured_source_text'
    || value.municipalityCode !== municipalityCode || value.sourceId !== source.id || value.sourceUrl !== source.url
    || value.sourceSha256 !== source.acquisition.sourceSha256 || !string(value.text)
    || value.acquisitionMethod !== source.acquisition.method || value.containerSha256 !== source.acquisition.containerSha256
    || value.memberPath !== source.acquisition.memberPath || value.memberIndex !== source.acquisition.memberIndex
    || value.textSha256 !== source.text.textSha256 || value.inputTextSha256 !== source.text.inputTextSha256
    || value.extractionMethod !== source.text.extractionMethod || value.characters !== source.text.characters
    || value.exportedCharacters !== source.text.exportedCharacters || value.truncated !== source.text.truncated
    || Array.from(value.text).length !== value.exportedCharacters) throw invalid('取得テキスト');
  if (subtle) {
    const textBytes = new TextEncoder().encode(value.text).buffer;
    await verify(textBytes, textBytes.byteLength, source.text.textSha256!, signal, subtle);
  }
  notAborted(signal);
  return { data: value as unknown as DocumentText, integrity };
}

/** Two independently bounded LRU caches. Only validated results are cached, never errors or aborted reads. */
export function createEvidenceLoader(options: { fetcher?: typeof fetch; subtle?: SubtleCrypto | null; maxEntries?: number; maxBytes?: number } = {}) {
  const cities = new Map<string, { value: LoadedEvidence<MunicipalityEvidence>; bytes: number }>();
  const texts = new Map<string, { value: LoadedEvidence<DocumentText>; bytes: number }>();
  const subtle = () => options.subtle === undefined ? globalThis.crypto?.subtle ?? null : options.subtle;
  async function cached<T>(cache: Map<string, { value: T; bytes: number }>, key: string, path: string, size: number,
    signal: AbortSignal, reload: boolean, validate: (bytes: ArrayBuffer) => Promise<T>): Promise<T> {
    notAborted(signal);
    const found = cache.get(key);
    if (found && !reload) { cache.delete(key); cache.set(key, found); return found.value; }
    cache.delete(key);
    const bytes = await fetchBytes(path, signal, size, options.fetcher ?? fetch);
    const value = await validate(bytes); notAborted(signal);
    const maxBytes = Math.max(0, options.maxBytes ?? 4 * 1024 * 1024);
    const maxEntries = Math.max(0, options.maxEntries ?? 3);
    if (maxEntries > 0 && size <= maxBytes) {
      cache.set(key, { value, bytes: size });
      while (cache.size > maxEntries || Array.from(cache.values()).reduce((sum, item) => sum + item.bytes, 0) > maxBytes) cache.delete(cache.keys().next().value as string);
    }
    return value;
  }
  return {
    clear() { cities.clear(); texts.clear(); },
    loadMunicipality(entry: IndexEntry, signal: AbortSignal, reload = false) {
      if (!cityDescriptor(entry)) return Promise.reject(invalid('自治体配信先'));
      const key = JSON.stringify(entry);
      return cached(cities, key, `evaluation-evidence/${entry.shardPath}`, entry.shardBytes, signal, reload,
        (bytes) => validateMunicipalityEvidence(bytes, entry, signal, subtle()));
    },
    loadText(code: string, source: EvidenceSource, signal: AbortSignal, reload = false) {
      if (!CODE.test(code) || !sourceRecord(source) || source.text.status !== 'available') return Promise.reject(invalid('テキスト配信先'));
      const key = JSON.stringify([code, source]);
      return cached(texts, key, `evaluation-evidence/${source.text.assetPath}`, source.text.assetBytes, signal, reload,
        (bytes) => validateDocumentText(bytes, code, source, signal, subtle()));
    },
  };
}
