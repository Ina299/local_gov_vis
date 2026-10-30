import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvidenceLoader, loadEvidenceIndex, parseEvidenceIndex, parseMunicipalityEvidence, validateDocumentText, validateMunicipalityEvidence } from './evaluationEvidenceLoader';
import { createEvaluationRequest, type EvaluationLoadState } from './evaluationLoader';
import { DISCOVERY_LABELS, ROLE_LABELS, evidenceHref, findTextMatches, readEvidenceSelection, safeEvidenceUrl, searchEvidenceMunicipalities } from './evaluationEvidence';
import type { DocumentText, EvidenceIndex, EvidenceSource, IndexEntry, MunicipalityEvidence } from '@/types/evaluationEvidence';

const subtle = webcrypto.subtle as unknown as SubtleCrypto;
const prefix = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).buffer;
const signal = () => new AbortController().signal;
const digest = async (bytes: ArrayBuffer) => Array.from(new Uint8Array(await subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
async function fixture(code = '13206', name = '府中市') {
  const text = '成果🌳\n子育ての評価\n<script>alert(1)</script>\n子育て';
  const textSha256 = await digest(new TextEncoder().encode(text).buffer);
  const source: EvidenceSource = {
    id: code.padEnd(24, 'a'), url: 'https://example.lg.jp/evaluation.pdf', title: '公式の評価資料', titleBasis: 'official_link_label', format: 'pdf', role: 'evaluation_document', evaluationType: 'business_project_evaluation',
    verification: { status: 'verified', basis: ['literal_link_in_verified_official_page'], evidenceSourceId: null, evidenceSha256: 'b'.repeat(64), evaluationRelevance: 'verified' },
    acquisition: { state: 'acquired', inputStatus: 'unsupported', method: 'network', containerSha256: null, memberPath: null, memberIndex: null, fetchedAt: '2026-10-11T00:00:00Z', httpStatus: 200, sourceSha256: 'a'.repeat(64) },
    text: { status: 'available', label: 'unstructured_source_text', preview: text, assetPath: `documents/${code.padEnd(24, 'a')}.json`, assetBytes: 0, assetSha256: null, characters: Array.from(text).length + 10, exportedCharacters: Array.from(text).length, truncated: true, textSha256, inputTextSha256: 'c'.repeat(64), extractionMethod: 'pdftotext' }, years: [],
  };
  const document: DocumentText = { schemaVersion: 1, sourceId: source.id, municipalityCode: code, sourceUrl: source.url, sourceSha256: source.acquisition.sourceSha256!, acquisitionMethod: 'network', containerSha256: null, memberPath: null, memberIndex: null, label: 'unstructured_source_text', text, characters: source.text.characters, exportedCharacters: source.text.exportedCharacters, truncated: true, textSha256, inputTextSha256: source.text.inputTextSha256, extractionMethod: 'pdftotext' };
  source.text.assetBytes = bytesOf(document).byteLength; source.text.assetSha256 = await digest(bytesOf(document));
  const city: MunicipalityEvidence = { schemaVersion: 1, municipality: { municipalityCode: code, municipalityName: name, prefectureCode: code.slice(0, 2), prefectureName: code.startsWith('13') ? '東京都' : '広島県' }, discovery: { status: 'fetched', initialLook: true, searchAttemptsCount: 1, coverageCompleteness: 'not_established', omittedRejectedSources: 0 }, officialHomepage: null, officialFallback: null, officialDirectoryLinks: [], evaluationPages: [], sources: [source] };
  const entry: IndexEntry = { ...city.municipality, discoveryStatus: 'fetched', evidenceStatus: 'text_available', shardPath: `municipalities/${code}.json`, shardSha256: await digest(bytesOf(city)), shardBytes: bytesOf(city).byteLength, evaluationPageCount: 0, sourceCount: 1, candidateCount: 0, acquiredCount: 1, textDocumentCount: 1, substantiveTextDocumentCount: 1, officialHomepage: null, officialFallback: null };
  return { source, document, city, entry };
}
function index(entries: IndexEntry[]): EvidenceIndex {
  const blank = entries[0];
  const municipalities: IndexEntry[] = Array.from({ length: 1741 - entries.length }, (_, i) => ({ ...blank, municipalityCode: String(1001 + i + Math.floor(i / 999)).padStart(5, '0'), municipalityName: `自治体${i}`, prefectureCode: String(1001 + i + Math.floor(i / 999)).padStart(5, '0').slice(0, 2), prefectureName: '北海道', shardPath: `municipalities/${String(1001 + i + Math.floor(i / 999)).padStart(5, '0')}.json`, discoveryStatus: 'searched_not_found', evidenceStatus: 'no_verified_sources', sourceCount: 0, candidateCount: 0, acquiredCount: 0, textDocumentCount: 0, substantiveTextDocumentCount: 0, evaluationPageCount: 0 }));
  municipalities.push(...entries);
  const sum = (key: 'acquiredCount' | 'candidateCount' | 'sourceCount' | 'substantiveTextDocumentCount' | 'textDocumentCount') => municipalities.reduce((n, e) => n + e[key], 0);
  const present = (key: 'acquiredCount' | 'evaluationPageCount' | 'textDocumentCount' | 'substantiveTextDocumentCount' | 'sourceCount') => municipalities.filter((e) => e[key] > 0).length;
  return { schemaVersion: 1, scopeMunicipalities: 1741, snapshotAt: '2026-10-12T00:00:00Z', counts: { municipalities: 1741, municipalitiesWithAcquiredArtifacts: present('acquiredCount'), municipalitiesWithEvaluationPages: present('evaluationPageCount'), municipalitiesWithOfficialFallback: 0, municipalitiesWithOfficialHomepage: 0, municipalitiesWithReadableText: present('textDocumentCount'), municipalitiesWithSubstantiveEvaluationText: present('substantiveTextDocumentCount'), municipalitiesWithVerifiedSources: present('sourceCount'), acquiredSourceRows: sum('acquiredCount'), candidateSourceRows: sum('candidateCount'), verifiedSourceRows: sum('sourceCount'), sourceRows: sum('sourceCount') + sum('candidateCount'), substantiveEvaluationTextDocuments: sum('substantiveTextDocumentCount'), textDocuments: sum('textDocumentCount'), truncatedTextDocuments: 1 }, municipalities };
}
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('all-municipality directory and honest status contract', () => {
  it('defaults to all 1,741 including no-hit and unstructured-only entries', async () => {
    const { entry } = await fixture(); const value = parseEvidenceIndex(index([entry]));
    expect(searchEvidenceMunicipalities(value.municipalities, '')).toHaveLength(1741);
    expect(searchEvidenceMunicipalities(value.municipalities, '東京都 １３２０６')).toEqual([entry]);
    expect(searchEvidenceMunicipalities(value.municipalities, '', '', 'text_available')).toEqual([entry]);
  });
  it('disambiguates same-name municipalities by prefecture and code', async () => {
    const a = (await fixture()).entry; const b = (await fixture('34208')).entry;
    expect(searchEvidenceMunicipalities([a, b], '府中市')).toHaveLength(2);
    expect(searchEvidenceMunicipalities([a, b], '広島 府中')).toEqual([b]);
    expect(searchEvidenceMunicipalities([a, b], '府中', '13')).toEqual([a]);
  });
  it('rejects partial indexes, duplicate codes, invalid enums and inconsistent totals', async () => {
    const value = index([(await fixture()).entry]);
    expect(() => parseEvidenceIndex({ ...value, municipalities: value.municipalities.slice(0, 53) })).toThrow();
    const duplicate = structuredClone(value); duplicate.municipalities[1] = duplicate.municipalities[0]; expect(() => parseEvidenceIndex(duplicate)).toThrow();
    const changed = structuredClone(value); changed.counts.textDocuments += 1; expect(() => parseEvidenceIndex(changed)).toThrow();
    const unknown = structuredClone(value); Object.assign(unknown.municipalities[0], { discoveryStatus: 'unpublished' }); expect(() => parseEvidenceIndex(unknown)).toThrow();
    expect(DISCOVERY_LABELS.blocked).not.toBe(DISCOVERY_LABELS.unsupported);
    expect(ROLE_LABELS.evaluation_landing_page).not.toBe(ROLE_LABELS.evaluation_document);
  });
  it.each(['https://evil.example/a.json', '//evil.example/a.json', 'municipalities/../13206.json', 'municipalities/34208.json', 'municipalities/13206.json?x=1', '/municipalities/13206.json'])('rejects foreign or noncanonical city path %s without fetch', async (shardPath) => {
    const entry = { ...(await fixture()).entry, shardPath }; const fetcher = vi.fn<typeof fetch>();
    await expect(createEvidenceLoader({ fetcher }).loadMunicipality(entry, signal())).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('source and acquired-text integrity', () => {
  it('keeps unsupported but readable text, unknown years and explicit truncation', async () => {
    const f = await fixture();
    expect((await validateMunicipalityEvidence(bytesOf(f.city), f.entry, signal(), subtle)).integrity).toBe('sha256_verified');
    const result = await validateDocumentText(bytesOf(f.document), f.entry.municipalityCode, f.source, signal(), subtle);
    expect(result.data.truncated).toBe(true); expect(f.source.years).toEqual([]); expect(f.source.acquisition.inputStatus).toBe('unsupported');
    expect(result.data.text).toContain('<script>'); // It stays plain text; the UI never inserts source HTML.
  });
  it('allows supporting official text whose evaluation relevance is not established', async () => {
    const f = await fixture(); f.source.role = 'supporting_document'; f.source.verification.evaluationRelevance = 'not_established'; f.entry.substantiveTextDocumentCount = 0;
    expect(parseMunicipalityEvidence(f.city, f.entry).sources[0].text.status).toBe('available');
    expect((await validateDocumentText(bytesOf(f.document), f.entry.municipalityCode, f.source, signal(), subtle)).data).toEqual(f.document);
  });
  it('accepts landing-only and empty blocked/no-hit cities without claiming evaluation reports', async () => {
    const f = await fixture(); f.source.role = 'evaluation_landing_page'; f.entry.substantiveTextDocumentCount = 0; f.city.evaluationPages = [f.source.id]; f.entry.evaluationPageCount = 1;
    expect(parseMunicipalityEvidence(f.city, f.entry).sources[0].role).toBe('evaluation_landing_page');
    for (const status of ['blocked', 'searched_not_found'] as const) {
      f.city.sources = []; f.city.evaluationPages = []; f.city.discovery.status = status;
      Object.assign(f.entry, { discoveryStatus: status, evaluationPageCount: 0, sourceCount: 0, textDocumentCount: 0, acquiredCount: 0, evidenceStatus: 'no_verified_sources' });
      expect(parseMunicipalityEvidence(f.city, f.entry).discovery.status).toBe(status);
    }
  });
  it('rejects wrong-city JSON, unknown source references and count mismatches', async () => {
    const f = await fixture(); const altered = structuredClone(f.city); altered.municipality.municipalityCode = '34208';
    expect(() => parseMunicipalityEvidence(altered, f.entry)).toThrow();
    expect(() => parseMunicipalityEvidence({ ...f.city, evaluationPages: ['e'.repeat(24)] }, f.entry)).toThrow();
    expect(() => parseMunicipalityEvidence(f.city, { ...f.entry, candidateCount: 1 })).toThrow();
  });
  it.each(['municipalityCode', 'sourceId', 'sourceUrl', 'sourceSha256', 'textSha256', 'inputTextSha256', 'acquisitionMethod', 'memberPath'])('rejects text with changed %s even if byte-hash is unavailable', async (key) => {
    const f = await fixture(); const changed = { ...f.document, [key]: 'wrong' }; f.source.text.assetBytes = bytesOf(changed).byteLength;
    await expect(validateDocumentText(bytesOf(changed), f.entry.municipalityCode, f.source, signal(), null)).rejects.toThrow();
  });
  it('verifies JSON bytes, text content digest, Unicode codepoint length and ZIP container binding', async () => {
    const f = await fixture();
    await expect(validateDocumentText(bytesOf(f.document), f.entry.municipalityCode, { ...f.source, text: { ...f.source.text, assetBytes: f.source.text.assetBytes + 1 } }, signal(), subtle)).rejects.toThrow('バイト数');
    const changed = { ...f.document, text: f.document.text.replace('成果', '実績') };
    await expect(validateDocumentText(bytesOf(changed), f.entry.municipalityCode, f.source, signal(), subtle)).rejects.toThrow('SHA-256');
    f.source.text.assetSha256 = await digest(bytesOf(changed)); f.source.text.assetBytes = bytesOf(changed).byteLength;
    await expect(validateDocumentText(bytesOf(changed), f.entry.municipalityCode, f.source, signal(), subtle)).rejects.toThrow('SHA-256');
    const z = await fixture(); Object.assign(z.source.acquisition, { method: 'archive_member', containerSha256: 'd'.repeat(64), memberPath: '資料/評価.pdf', memberIndex: 2 });
    Object.assign(z.document, { acquisitionMethod: 'archive_member', containerSha256: 'd'.repeat(64), memberPath: '資料/評価.pdf', memberIndex: 2 });
    z.source.text.assetBytes = bytesOf(z.document).byteLength; z.source.text.assetSha256 = await digest(bytesOf(z.document));
    expect((await validateDocumentText(bytesOf(z.document), z.entry.municipalityCode, z.source, signal(), subtle)).data.memberIndex).toBe(2);
  });
  it('refuses unsafe text paths and source URLs before any request', async () => {
    const f = await fixture(); const fetcher = vi.fn<typeof fetch>(); const loader = createEvidenceLoader({ fetcher });
    for (const path of ['../x.json', 'documents/other.json', '//evil.example/x.json', 'documents/a.json?x']) {
      await expect(loader.loadText(f.entry.municipalityCode, { ...f.source, text: { ...f.source.text, assetPath: path } }, signal())).rejects.toThrow();
    }
    for (const url of ['javascript:alert(1)', 'data:text/html,a', 'https://user:pass@example.com/a']) {
      expect(safeEvidenceUrl(url)).toBeNull(); await expect(loader.loadText(f.entry.municipalityCode, { ...f.source, url }, signal())).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('bounded fetch, cache, repeated selection and cancellation', () => {
  it('fetches only the index first, then only selected municipality/document; caches and retries explicitly', async () => {
    const f = await fixture(); const value = index([f.entry]);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (path) => new Response(bytesOf(String(path).endsWith('index.json') ? value : String(path).includes('/municipalities/') ? f.city : f.document)));
    await loadEvidenceIndex(signal(), fetcher); expect(fetcher).toHaveBeenCalledTimes(1);
    const loader = createEvidenceLoader({ fetcher, subtle }); await loader.loadMunicipality(f.entry, signal()); await loader.loadText(f.entry.municipalityCode, f.source, signal());
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([`${prefix}/evaluation-evidence/index.json`, `${prefix}/evaluation-evidence/${f.entry.shardPath}`, `${prefix}/evaluation-evidence/${f.source.text.assetPath}`]);
    await loader.loadText(f.entry.municipalityCode, f.source, signal()); expect(fetcher).toHaveBeenCalledTimes(3);
    await loader.loadText(f.entry.municipalityCode, f.source, signal(), true); expect(fetcher).toHaveBeenCalledTimes(4);
    loader.clear(); await loader.loadText(f.entry.municipalityCode, f.source, signal()); expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it('does not cache error, overflow or aborted results, and bounds cache by entry count and bytes', async () => {
    const f = await fixture(); const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('unavailable', { status: 503 })).mockResolvedValueOnce(new Response(new Uint8Array(f.source.text.assetBytes + 1))).mockImplementation(async () => new Response(bytesOf(f.document)));
    const loader = createEvidenceLoader({ fetcher, subtle, maxBytes: 1 });
    await expect(loader.loadText(f.entry.municipalityCode, f.source, signal())).rejects.toThrow('HTTP 503');
    await expect(loader.loadText(f.entry.municipalityCode, f.source, signal())).rejects.toThrow('サイズ');
    await loader.loadText(f.entry.municipalityCode, f.source, signal()); await loader.loadText(f.entry.municipalityCode, f.source, signal()); expect(fetcher).toHaveBeenCalledTimes(4);
    const aborted = new AbortController(); aborted.abort(); await expect(loader.loadText(f.entry.municipalityCode, f.source, aborted.signal)).rejects.toMatchObject({ name: 'AbortError' });
    const g = await fixture('34208'); const paths = vi.fn<typeof fetch>().mockImplementation(async (path) => new Response(bytesOf(String(path).includes(g.source.id) ? g.document : f.document)));
    const one = createEvidenceLoader({ fetcher: paths, subtle, maxEntries: 1 });
    await one.loadText(f.entry.municipalityCode, f.source, signal()); await one.loadText(g.entry.municipalityCode, g.source, signal()); await one.loadText(f.entry.municipalityCode, f.source, signal()); expect(paths).toHaveBeenCalledTimes(3);
  });
  it('latest source selection wins when an old text request ignores abort', async () => {
    const request = createEvaluationRequest<string>(); const states: EvaluationLoadState<string>[] = [];
    let finish!: (s: string) => void; let firstSignal!: AbortSignal;
    request.run((s) => { firstSignal = s; return new Promise((resolve) => { finish = resolve; }); }, (s) => states.push(s));
    await Promise.resolve(); const cancel = request.run(async () => 'new source', (s) => states.push(s));
    await vi.waitFor(() => expect(states.at(-1)).toEqual({ status: 'ready', value: 'new source' }));
    finish('old source'); await Promise.resolve(); expect(firstSignal.aborted).toBe(true); expect(states.at(-1)).toEqual({ status: 'ready', value: 'new source' }); cancel();
  });
  it.each(['', '/local_gov_vis'])('honors deployed base path %s for city and text', async (base) => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', base); vi.resetModules(); const imported = await import('./evaluationEvidenceLoader'); const f = await fixture();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(bytesOf(f.city))).mockResolvedValueOnce(new Response(bytesOf(f.document))); const loader = imported.createEvidenceLoader({ fetcher, subtle });
    await loader.loadMunicipality(f.entry, signal()); await loader.loadText(f.entry.municipalityCode, f.source, signal());
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([`${base}/evaluation-evidence/${f.entry.shardPath}`, `${base}/evaluation-evidence/${f.source.text.assetPath}`]); vi.unstubAllEnvs(); vi.resetModules();
  });
});

describe('shareable source selection and literal text search', () => {
  it('round-trips city/source/view state through Back and Forward URLs and resets source with a new city', () => {
    const urls = [evidenceHref('13206'), evidenceHref('13206', 'a'.repeat(24)), evidenceHref('13206', '', 'normalized'), evidenceHref('34208')];
    const states = urls.map((href) => readEvidenceSelection(new URL(href, 'https://example.com').searchParams));
    expect(states[0]).toEqual({ municipality: '13206', source: '', view: 'sources' });
    expect(states[1].source).toBe('a'.repeat(24)); expect(states[2]).toEqual({ municipality: '13206', source: '', view: 'normalized' });
    expect(states[3]).toEqual({ municipality: '34208', source: '', view: 'sources' });
    expect(readEvidenceSelection(new URL(urls[1], 'https://example.com').searchParams)).toEqual(states[1]);
    expect(evidenceHref('')).toBe('/evaluations/'); expect(evidenceHref('13206', 'ignored', 'normalized')).not.toContain('source=');
  });
  it('searches only loaded literal text and caps rendered snippets', () => {
    expect(findTextMatches('a+a a+a', 'a+a').count).toBe(2);
    expect(findTextMatches('🌳🌳', '🌳').count).toBe(2);
    expect(findTextMatches('a'.repeat(120000), 'a').snippets).toHaveLength(100);
    expect(findTextMatches('test', ' ')).toEqual({ count: 0, snippets: [] });
    expect(findTextMatches('<script>alert(1)</script>', 'alert').snippets[0]).toContain('<script>');
  });
});
