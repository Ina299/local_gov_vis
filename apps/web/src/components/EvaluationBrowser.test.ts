import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EvidenceDocumentText, SourceDetail } from './EvaluationBrowser';
import { createEvidenceLoader } from '@/lib/evaluationEvidenceLoader';
import type { DocumentText, MunicipalityEvidence } from '@/types/evaluationEvidence';

const city = (code: string) => JSON.parse(readFileSync(new URL(`../../public/evaluation-evidence/municipalities/${code}.json`, import.meta.url), 'utf8')) as MunicipalityEvidence;
const renderSource = (code: string, source: MunicipalityEvidence['sources'][number]) => renderToStaticMarkup(React.createElement(SourceDetail, { code, source, loader: createEvidenceLoader() }));

describe('deterministic source/text presentation (no browser or source network)', () => {
  it('escapes source text as inert text and marks truncation and search scope', () => {
    const document: DocumentText = { schemaVersion: 1, municipalityCode: '13206', sourceId: 'a'.repeat(24), sourceUrl: 'https://example.lg.jp/a.pdf', sourceSha256: 'b'.repeat(64), acquisitionMethod: 'network', containerSha256: null, memberPath: null, memberIndex: null, label: 'unstructured_source_text', text: '<script>alert(1)</script>', characters: 1000, exportedCharacters: 25, truncated: true, textSha256: 'c'.repeat(64), inputTextSha256: null, extractionMethod: 'pdftotext' };
    const html = renderToStaticMarkup(React.createElement(EvidenceDocumentText, { document, integrity: 'sha256_verified' }));
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>'); expect(html).not.toContain('<iframe');
    expect(html).toContain('配信上限による省略'); expect(html).toContain('この資料の取得テキスト内を検索'); expect(html).toContain('配信済みテキストだけ');
    const unavailable = renderToStaticMarkup(React.createElement(EvidenceDocumentText, { document, integrity: 'sha256_unavailable' })); expect(unavailable).toContain('SHA-256を検証できません');
  });
  it('labels landing text separately, allows official supporting text and leaves unknown years unknown', () => {
    const landing = city('13206').sources.find((s) => s.role === 'evaluation_landing_page' && s.text.status === 'available')!;
    const html = renderSource('13206', { ...landing, years: [] });
    expect(html).toContain('案内・索引ページ'); expect(html).toContain('評価報告書の本文ではありません'); expect(html).toContain('年度不明'); expect(html).toContain('取得テキスト（未構造化）');
    expect(html).toContain('文字を抽出できた範囲のみ'); expect(html).toContain('noopener noreferrer');
    const supporting = city('34208').sources.find((s) => s.role === 'supporting_document' && s.text.status === 'available')!;
    const supportingHtml = renderSource('34208', supporting); expect(supportingHtml).toContain('関連資料'); expect(supportingHtml).toContain('取得テキスト（未構造化）');
  });
  it('distinguishes blocked access from original review holds, and candidate links from verified ones', () => {
    const blocked = city('02201').sources.find((s) => s.acquisition.state === 'blocked')!;
    const html = renderSource('02201', blocked); expect(html).toContain('アクセス制約'); expect(html).toContain('候補URL（未検証）'); expect(html).not.toContain('取得テキスト（未構造化）');
    const unsupported = city('13206').sources.find((s) => s.acquisition.inputStatus === 'unsupported')!;
    expect(renderSource('13206', unsupported)).toContain('元の収集・内容確認では未対応・保留');
  });
  it('does not describe a saved HTTP403 response as successfully acquired material', () => {
    const source = city('42213').sources.find((s) => s.acquisition.httpStatus === 403)!;
    expect(source.acquisition.state).toBe('acquired');
    const html = renderSource('42213', source);
    expect(html).toContain('エラー応答を保存（HTTP 403・資料の取得は未確認）');
    expect(html).not.toContain('原資料取得済み');
  });
  it('keeps a legacy blocked archive visibly unconfirmed when HTTP status is missing', () => {
    const source = city('42213').sources.find((s) => s.acquisition.httpStatus === 403)!;
    const html = renderSource('42213', { ...source, acquisition: { ...source.acquisition, httpStatus: null } });
    expect(html).toContain('制限応答を保存・資料の取得は未確認');
    expect(html).not.toContain('原資料取得済み');
  });
  it('renders archive member and container identities explicitly rather than attaching a member hash to ZIP bytes', () => {
    const sample = city('13206').sources[0];
    const source = { ...sample, acquisition: { ...sample.acquisition, method: 'archive_member' as const, containerSha256: 'd'.repeat(64), memberPath: '評価/事業.pdf', memberIndex: 0 } };
    const html = renderSource('13206', source); expect(html).toContain('ZIPファイル（格納元）'); expect(html).toContain('ZIP内の資料'); expect(html).toContain('ZIP格納元 SHA-256'); expect(html).toContain('評価/事業.pdf');
  });
});
