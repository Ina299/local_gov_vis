import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createEvidenceLoader, parseEvidenceIndex, parseMunicipalityEvidence } from './evaluationEvidenceLoader';
import { SourceDetail } from '@/components/EvaluationBrowser';
import type { EvidenceSource, MunicipalityEvidence } from '@/types/evaluationEvidence';
const read = (path: string) => JSON.parse(readFileSync(new URL(`../../public/evaluation-evidence/${path}`, import.meta.url), 'utf8'));
const index = parseEvidenceIndex(read('index.json'));
const sample = () => {
  // 網走 (01211) links were all collected later; 01212 still has a link-only review.
  const entry = index.municipalities.find((x) => x.municipalityCode === '01212')!;
  const city = read(entry.shardPath) as MunicipalityEvidence;
  return { entry, city, source: city.sources.find((x) => x.navigationReview?.method === 'official_body_review' && x.navigationReview.rawArchiveState === 'not_downloaded')! };
};
describe('reviewed navigation without raw acquisition', () => {
  it('accepts verified navigation while keeping raw bytes and text absent', () => {
    const { entry, city, source } = sample();
    expect(parseMunicipalityEvidence(city, entry)).toBe(city);
    expect(source.acquisition.state).toBe('discovered'); expect(source.acquisition.sourceSha256).toBeNull();
    expect(source.text.status).toBe('not_acquired'); expect(source.text.assetPath).toBeNull();
    expect(index.counts.reviewedNavigationMunicipalities).toBeGreaterThanOrEqual(27);
  });
  it('rejects reviewed links claiming archived source bytes', () => {
    for (const field of ['state', 'sourceSha256', 'fetchedAt'] as const) {
      const { entry, city, source } = sample();
      if (field === 'state') source.acquisition.state = 'acquired';
      if (field === 'sourceSha256') source.acquisition.sourceSha256 = 'a'.repeat(64);
      if (field === 'fetchedAt') source.acquisition.fetchedAt = '2026-10-12T10:00:00Z';
      expect(() => parseMunicipalityEvidence(city, entry)).toThrow();
    }
  });
  it('rejects unsafe evidence URLs and mismatched verification methods', () => {
    for (const which of ['evidence', 'origin', 'method']) {
      const { entry, city, source } = sample();
      if (which === 'evidence') source.navigationReview!.evidenceUrl = 'javascript:alert(1)';
      if (which === 'origin') source.navigationReview!.originEvidenceUrl = 'data:text/html,bad';
      if (which === 'method') source.navigationReview!.method = 'search_candidate';
      expect(() => parseMunicipalityEvidence(city, entry)).toThrow();
    }
  });
  it('rejects all invented navigation-only extraction, archive and printed-year claims', () => {
    const mutations: Array<(source: EvidenceSource) => void> = [
      (s) => { s.text.preview = 'Invented body'; },
      (s) => { s.text.textSha256 = 'a'.repeat(64); },
      (s) => { s.text.inputTextSha256 = 'a'.repeat(64); },
      (s) => { s.text.characters = 100; },
      (s) => { s.text.characters = 100; s.text.exportedCharacters = 50; },
      (s) => { s.text.truncated = true; },
      (s) => { s.text.extractionMethod = 'pdf_text'; },
      (s) => { s.text.assetPath = `documents/${s.id}.json`; },
      (s) => { s.text.assetBytes = 100; },
      (s) => { s.text.assetSha256 = 'a'.repeat(64); },
      (s) => { s.years = [{ label: '令和6年度', calendarYear: 2024, meaning: 'evaluation_year', basis: 'printed_text', quote: 'Invented printed year' }]; },
      (s) => { s.verification.evidenceSourceId = 'a'.repeat(24); },
      (s) => { s.verification.evidenceSha256 = 'a'.repeat(64); },
      (s) => { s.acquisition.httpStatus = 200; },
      (s) => { s.acquisition.inputStatus = 'fetched'; },
      (s) => { s.acquisition.method = 'archive_member'; s.acquisition.containerSha256 = 'a'.repeat(64); s.acquisition.memberPath = 'report.pdf'; s.acquisition.memberIndex = 0; },
      (s) => { s.role = 'candidate'; },
    ];
    for (const mutate of mutations) {
      const { entry, city, source } = sample(); mutate(source);
      expect(() => parseMunicipalityEvidence(city, entry)).toThrow();
    }
  });
  it('shows review notes without claiming saved original text or printed-year citations', () => {
    const { source } = sample();
    const html = renderToStaticMarkup(React.createElement(SourceDetail, { code: '01212', source, loader: createEvidenceLoader() }));
    expect(html).toContain('公式ページの本文・リンクを確認した追加出典');
    expect(html).toContain('このアプリにはまだ保存していません');
    expect(html).toContain('出典確認時の年度メモ');
    expect(html).not.toContain('取得テキスト（未構造化）');
    expect(html).toContain('未取得・未記録');
  });
  it('accepts a reviewed link whose original was saved by a later collection, and labels it as such', () => {
    const entry = index.municipalities.find((x) => x.municipalityCode === '01211')!;
    const city = read(entry.shardPath) as MunicipalityEvidence;
    const source = city.sources.find((x) => x.navigationReview?.rawArchiveState === 'collected')!;
    expect(parseMunicipalityEvidence(city, entry)).toBe(city);
    expect(source.acquisition.state).toBe('acquired'); expect(source.acquisition.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    const html = renderToStaticMarkup(React.createElement(SourceDetail, { code: '01211', source, loader: createEvidenceLoader() }));
    expect(html).toContain('後日の収集で公式URLから保存');
    expect(html).not.toContain('このアプリにはまだ保存していません');
    const tampered = structuredClone(city); tampered.sources.find((x) => x.id === source.id)!.navigationReview!.rawArchiveState = 'not_downloaded';
    expect(() => parseMunicipalityEvidence(tampered, entry)).toThrow();
  });
  it('keeps self-declared third-party hosting identity-pending', () => {
    const city = read('municipalities/01393.json') as MunicipalityEvidence;
    const source = city.sources.find((x) => x.url.includes('jimdofree.com'))!;
    expect(source.verification.status).toBe('unverified');
    expect(source.navigationReview!.method).toBe('search_candidate');
    expect(source.role).toBe('candidate');
  });
});
