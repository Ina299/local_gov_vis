import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EvidenceDocumentText, SourceDetail } from '@/components/EvaluationBrowser';
import { createEvidenceLoader, parseMunicipalityEvidence, validateTextContinuation } from './evaluationEvidenceLoader';
import type { DocumentText, DocumentTextContinuation, EvidenceIndex, EvidenceSource, IndexEntry, MunicipalityEvidence } from '@/types/evaluationEvidence';

const subtle = webcrypto.subtle as unknown as SubtleCrypto;
const prefix = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).buffer;
const signal = () => new AbortController().signal;
const digest = async (bytes: ArrayBuffer) => Array.from(new Uint8Array(await subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
const textDigest = (text: string) => digest(new TextEncoder().encode(text).buffer);
const publicJson = (path: string) => JSON.parse(readFileSync(new URL(`../../public/evaluation-evidence/${path}`, import.meta.url), 'utf8'));

/** Clones a real available-text source from a published shard and splits its text into three parts. */
async function splitFixture() {
  const city = structuredClone(publicJson('municipalities/13206.json') as MunicipalityEvidence);
  const entry = (publicJson('index.json') as EvidenceIndex).municipalities.find((e) => e.municipalityCode === '13206')!;
  const source = city.sources.find((s) => s.text.status === 'available')!;
  const texts = ['第1部の本文🌳\n子育て', '第2部<script>alert(1)</script>子育て', '第3部の結び'];
  const length = (text: string) => Array.from(text).length;
  const fullTextSha256 = await textDigest(texts.join(''));
  const document: DocumentText = { schemaVersion: 1, sourceId: source.id, municipalityCode: '13206', sourceUrl: source.url, sourceSha256: source.acquisition.sourceSha256!, acquisitionMethod: source.acquisition.method, containerSha256: source.acquisition.containerSha256, memberPath: source.acquisition.memberPath, memberIndex: source.acquisition.memberIndex, label: 'unstructured_source_text', text: texts[0], characters: texts.reduce((n, t) => n + length(t), 0), exportedCharacters: length(texts[0]), truncated: true, textSha256: await textDigest(texts[0]), inputTextSha256: source.text.inputTextSha256, extractionMethod: source.text.extractionMethod ?? 'pdftotext' };
  Object.assign(source.text, { characters: document.characters, exportedCharacters: document.exportedCharacters, truncated: true, textSha256: document.textSha256, extractionMethod: document.extractionMethod, assetBytes: bytesOf(document).byteLength, assetSha256: await digest(bytesOf(document)), fullTextSha256 });
  const parts: DocumentTextContinuation[] = [];
  source.text.continuations = [];
  let start = document.exportedCharacters;
  for (let i = 0; i < texts.length - 1; i += 1) {
    const text = texts[i + 1];
    const part: DocumentTextContinuation = { schemaVersion: 1, label: 'unstructured_source_text_continuation', municipalityCode: '13206', sourceId: source.id, sourceUrl: source.url, sourceSha256: source.acquisition.sourceSha256!, part: i + 2, startCharacter: start, exportedCharacters: length(text), text, textSha256: await textDigest(text), fullTextSha256 };
    parts.push(part);
    source.text.continuations.push({ part: part.part, assetPath: `documents/${source.id}-${part.part}.json`, assetBytes: bytesOf(part).byteLength, assetSha256: await digest(bytesOf(part)), startCharacter: start, exportedCharacters: part.exportedCharacters, textSha256: part.textSha256 });
    start += part.exportedCharacters;
  }
  return { city, entry, source, document, parts };
}
const withSource = (city: MunicipalityEvidence, source: EvidenceSource) => ({ ...city, sources: city.sources.map((s) => s.id === source.id ? source : s) });

describe('split full text in municipality shards', () => {
  it('accepts a shard whose source carries contiguous continuation parts, and plain shards unchanged', async () => {
    const f = await splitFixture();
    expect(parseMunicipalityEvidence(f.city, f.entry).sources.find((s) => s.id === f.source.id)!.text.continuations).toHaveLength(2);
    expect(() => parseMunicipalityEvidence(publicJson('municipalities/13206.json'), f.entry)).not.toThrow();
  });
  it.each<[string, (source: EvidenceSource) => void]>([
    ['missing part (gap)', (s) => { s.text.continuations!.splice(0, 1); }],
    ['parts not starting at 2', (s) => { s.text.continuations![0].part = 1; }],
    ['start discontinuity', (s) => { s.text.continuations![1].startCharacter += 1; }],
    ['first part start not at part 1 length', (s) => { s.text.continuations![0].startCharacter = 0; }],
    ['total characters mismatch', (s) => { s.text.characters += 1; }],
    ['path of another source', (s) => { s.text.continuations![0].assetPath = `documents/${'f'.repeat(24)}-2.json`; }],
    ['path traversal', (s) => { s.text.continuations![0].assetPath = `../documents/${s.id}-2.json`; }],
    ['path with wrong part', (s) => { s.text.continuations![1].assetPath = `documents/${s.id}-2.json`; }],
    ['invalid asset hash', (s) => { s.text.continuations![0].assetSha256 = 'A'.repeat(64); }],
    ['invalid part text hash', (s) => { s.text.continuations![1].textSha256 = 'xyz'; }],
    ['invalid full text hash', (s) => { s.text.fullTextSha256 = 'g'.repeat(64); }],
    ['full text hash without parts', (s) => { delete s.text.continuations; }],
    ['parts without full text hash', (s) => { delete s.text.fullTextSha256; }],
    ['empty parts', (s) => { s.text.continuations = []; s.text.truncated = true; }],
    ['empty asset', (s) => { s.text.continuations![0].assetBytes = 0; }],
    ['oversized asset', (s) => { s.text.continuations![0].assetBytes = 1024 * 1024 + 1; }],
    ['oversized part text', (s) => { s.text.continuations![1].exportedCharacters = 120_001; s.text.characters += 120_001 - 6; }],
  ])('rejects %s', async (_, mutate) => {
    const f = await splitFixture(); mutate(f.source);
    expect(() => parseMunicipalityEvidence(withSource(f.city, f.source), f.entry)).toThrow('自治体資料');
  });
});

describe('loading continuation parts', () => {
  it('fetches only the requested part, verifies it against the shard and caches validated results', async () => {
    const f = await splitFixture();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (path) => new Response(bytesOf(String(path).endsWith('-3.json') ? f.parts[1] : f.parts[0])));
    const loader = createEvidenceLoader({ fetcher, subtle });
    expect((await loader.loadTextContinuation('13206', f.source, 2, signal())).data.text).toBe(f.parts[0].text);
    expect((await loader.loadTextContinuation('13206', f.source, 3, signal())).integrity).toBe('sha256_verified');
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([`${prefix}/evaluation-evidence/documents/${f.source.id}-2.json`, `${prefix}/evaluation-evidence/documents/${f.source.id}-3.json`]);
    await loader.loadTextContinuation('13206', f.source, 2, signal()); expect(fetcher).toHaveBeenCalledTimes(2);
    await loader.loadTextContinuation('13206', f.source, 2, signal(), true); expect(fetcher).toHaveBeenCalledTimes(3);
    await expect(loader.loadTextContinuation('13206', f.source, 4, signal())).rejects.toThrow('続きのテキスト配信先');
    await expect(loader.loadTextContinuation('13206', { ...f.source, text: { ...f.source.text, continuations: undefined, fullTextSha256: undefined } }, 2, signal())).rejects.toThrow('続きのテキスト配信先');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it.each<[string, Partial<DocumentTextContinuation>]>([
    ['another source', { sourceId: 'f'.repeat(24) }],
    ['another municipality', { municipalityCode: '34208' }],
    ['another source URL', { sourceUrl: 'https://example.lg.jp/other.pdf' }],
    ['another original file', { sourceSha256: 'e'.repeat(64) }],
    ['another full text', { fullTextSha256: 'e'.repeat(64) }],
    ['another part number', { part: 3 }],
    ['another start', { startCharacter: 0 }],
    ['another part text digest', { textSha256: 'e'.repeat(64) }],
    ['wrong label', { label: 'unstructured_source_text' as never }],
    ['codepoint count mismatch', { text: '短い' }],
  ])('rejects a part file bound to %s even when its bytes match the shard', async (_, change) => {
    const f = await splitFixture(); const changed = { ...f.parts[0], ...change };
    Object.assign(f.source.text.continuations![0], { assetBytes: bytesOf(changed).byteLength, assetSha256: await digest(bytesOf(changed)) });
    await expect(validateTextContinuation(bytesOf(changed), '13206', f.source, 2, signal(), subtle)).rejects.toThrow('続きのテキスト');
  });
  it('rejects tampered bytes and text whose content digest differs from the shard', async () => {
    const f = await splitFixture();
    const altered = { ...f.parts[0], text: f.parts[0].text.replace('子育て', '子育ち') };
    await expect(validateTextContinuation(bytesOf(altered), '13206', f.source, 2, signal(), subtle)).rejects.toThrow('SHA-256');
    Object.assign(f.source.text.continuations![0], { assetBytes: bytesOf(altered).byteLength, assetSha256: await digest(bytesOf(altered)) });
    await expect(validateTextContinuation(bytesOf(altered), '13206', f.source, 2, signal(), subtle)).rejects.toThrow('SHA-256');
  });
});

describe('split text presentation', () => {
  it('offers the next part under the first part in the static source detail', async () => {
    const f = await splitFixture();
    const html = renderToStaticMarkup(React.createElement(SourceDetail, { code: '13206', source: f.source, loader: createEvidenceLoader() }));
    expect(html).toContain(`続きを読み込む（第2部／全3部、全${f.document.characters.toLocaleString()}文字）`);
    expect(html).toContain('取得テキスト（未構造化）');
  });
  it('joins loaded parts as inert text, states the loaded range and searches only what is loaded', async () => {
    const f = await splitFixture();
    const html = renderToStaticMarkup(React.createElement(EvidenceDocumentText, { document: f.document, integrity: 'sha256_verified', continuations: [f.parts[0]], totalParts: 3 }));
    expect(html).toContain(`全文${f.document.characters.toLocaleString()}文字を3部に分けて配信。第2部まで読み込み済み`);
    expect(html).toContain('読み込み済みの範囲を検索しています'); expect(html).toContain('未読み込みの部分は検索しません');
    expect(html).toContain('子育て第2部&lt;script&gt;'); expect(html).not.toContain('<script>'); expect(html).not.toContain('第3部の結び');
    expect(html).not.toContain('配信上限による省略');
    const complete = renderToStaticMarkup(React.createElement(EvidenceDocumentText, { document: f.document, integrity: 'sha256_verified', continuations: f.parts, totalParts: 3 }));
    expect(complete).toContain('第3部まで読み込み済み'); expect(complete).toContain('全文を読み込みました'); expect(complete).toContain('第3部の結び');
    expect(complete).not.toContain('未読み込みの部分は検索しません');
  });
});
