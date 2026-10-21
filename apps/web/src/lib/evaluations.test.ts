import { describe, expect, it } from 'vitest';
import type { EvaluationDataset, EvaluationEvidence, EvaluationSourceStatus, ProjectEvaluation } from '@/types/evaluation';
import {
  EMPTY_EVALUATION_FILTERS,
  evaluationMunicipalities,
  evaluationYearOptions,
  filterEvaluations,
  filterEvaluationSources,
  formatEvaluationAmount,
  formatEvaluationTimestamp,
  formatEvaluationYear,
  matchesEvaluationYear,
  parseEvaluationDataset,
  safeEvaluationUrl,
} from './evaluations';

const evidence: EvaluationEvidence = {
  sourceUrl: 'https://example.lg.jp/evaluation.pdf',
  sourcePageUrl: 'https://example.lg.jp/evaluation/',
  format: 'pdf', fetchedAt: '2026-10-10T00:00:00Z', sha256: 'a'.repeat(64),
  rawText: '事業費 0 千円', page: 4, sheet: null, cell: null,
};
const baseProject: ProjectEvaluation = {
  id: 'project-1', municipalityCode: '01100', municipalityName: '札幌市',
  projectCode: 'A-01', projectName: '公園整備事業', department: 'みどりの課',
  evaluationYear: 2025, evaluatedFiscalYear: 2024,
  purpose: '安全で快適な遊び場の確保', activities: '公園を整備', outcomes: '利用者が増加',
  amounts: [{ kind: 'actual', fiscalYear: 2024, amountYen: 0, rawValue: '0', rawUnit: '千円', evidence }],
  indicators: [{ name: '利用者数', fiscalYear: 2024, target: '100', actual: '0', unit: '人', evidence }],
  ratings: [{ kind: 'self', label: '達成度', value: 'A', scale: '市の尺度：目標を達成', evidence }],
  evidence: [evidence], extractionStatus: 'extracted', warnings: [],
};
const projects: ProjectEvaluation[] = [
  baseProject,
  { ...baseProject, id: 'project-2', projectName: '健康づくり', evaluationYear: 2024, evaluatedFiscalYear: 2023 },
  { ...baseProject, id: 'project-3', municipalityCode: '14206', municipalityName: '小田原市', projectName: '福祉事業', department: '福祉課', evaluationYear: null, evaluatedFiscalYear: null },
];
const baseSource: EvaluationSourceStatus = {
  id: 'source-1', municipalityCode: '01100', municipalityName: '札幌市',
  sourcePageUrl: 'https://example.lg.jp/evaluation/', evaluationYear: 2025,
  status: 'partial', discoveredDocuments: 2, fetchedDocuments: 1, extractedProjects: 1,
  scope: '登録資料の範囲のみ', message: '1資料は取得失敗',
  lastAttemptAt: '2026-10-10T00:00:00Z', lastSuccessAt: '2026-10-10T00:00:00Z',
  documents: [{ url: evidence.sourceUrl, format: 'pdf', status: 'ok', sha256: evidence.sha256, fetchedAt: evidence.fetchedAt, projectCount: 1, message: '取得済み' }],
};
const dataset: EvaluationDataset = {
  schemaVersion: 1, generatedAt: '2026-10-10T00:00:00Z', projects,
  sources: [baseSource, { ...baseSource, id: 'source-2', municipalityCode: '11237', municipalityName: '三郷市', status: 'failed', extractedProjects: 0 }],
};
const filters = { ...EMPTY_EVALUATION_FILTERS };

// These fixtures exercise the web contract, independent of parser-specific examples.
describe('evaluation filtering', () => {
  it('returns all projects when no filters are set without mutating their order', () => {
    expect(filterEvaluations(projects, filters)).toEqual(projects);
    expect(projects.map((project) => project.id)).toEqual(['project-1', 'project-2', 'project-3']);
  });
  it('filters by exact municipality code, retaining leading zeroes', () => {
    expect(filterEvaluations(projects, { ...filters, municipality: '01100' })).toHaveLength(2);
    expect(filterEvaluations(projects, { ...filters, municipality: '1100' })).toHaveLength(0);
  });
  it('does not treat the assessment year as the assessed fiscal year', () => {
    expect(filterEvaluations(projects, { ...filters, evaluationYear: '2025', fiscalYear: '2024' }).map((project) => project.id)).toEqual(['project-1']);
    expect(filterEvaluations(projects, { ...filters, evaluationYear: '2024', fiscalYear: '2024' })).toHaveLength(0);
  });
  it('can find unknown years without treating them as year zero', () => {
    expect(filterEvaluations(projects, { ...filters, fiscalYear: 'unknown' }).map((project) => project.id)).toEqual(['project-3']);
    expect(matchesEvaluationYear(null, '0')).toBe(false);
    expect(matchesEvaluationYear(null, 'unknown')).toBe(true);
  });
  it('normalizes full-width Latin text and requires all search terms', () => {
    expect(filterEvaluations(projects, { ...filters, query: 'Ａ－０１　公園整備事業' }).map((project) => project.id)).toEqual(['project-1']);
    expect(filterEvaluations(projects, { ...filters, query: '公園 見つからない' })).toHaveLength(0);
  });
  it('searches project descriptions, departments and original indicators', () => {
    expect(filterEvaluations(projects, { ...filters, query: '快適 みどり' })).toHaveLength(2);
    expect(filterEvaluations(projects, { ...filters, query: '利用者数' })).toHaveLength(3);
    expect(filterEvaluations(projects, { ...filters, query: '   ' })).toHaveLength(3);
  });
  it('preserves municipality-specific self/external ratings unchanged', () => {
    const external = { ...baseProject, ratings: [{ ...baseProject.ratings[0], kind: 'external' as const, value: '継続', scale: '原資料の定義' }] };
    expect(filterEvaluations([external], { ...filters, query: '継続' })[0].ratings).toEqual(external.ratings);
  });
  it('keeps coverage visible when keywords or assessed-year filters remove all projects', () => {
    const chosen = { ...filters, municipality: '01100', fiscalYear: '1990', query: '不一致' };
    expect(filterEvaluations(projects, chosen)).toHaveLength(0);
    expect(filterEvaluationSources(dataset.sources, chosen)).toEqual([baseSource]);
  });
  it('keeps latest acquisition warnings visible for retained projects from prior assessment years', () => {
    const chosen = { ...filters, municipality: '01100', evaluationYear: '2024' };
    expect(filterEvaluations(projects, chosen)).toHaveLength(1);
    expect(filterEvaluationSources(dataset.sources, chosen)).toEqual([baseSource]);
    expect(filterEvaluationSources(dataset.sources, chosen)[0].status).toBe('partial');
  });
  it('includes municipalities with failed acquisition and no extracted projects', () => {
    expect(evaluationMunicipalities(dataset)).toEqual([
      { code: '01100', name: '札幌市' }, { code: '11237', name: '三郷市' }, { code: '14206', name: '小田原市' },
    ]);
  });
  it('does not fall back to unrelated projects for unregistered municipalities', () => {
    expect(filterEvaluations(projects, { ...filters, municipality: '99999' })).toHaveLength(0);
    expect(filterEvaluationSources(dataset.sources, { ...filters, municipality: '99999' })).toHaveLength(0);
  });
  it('sorts unique years descending with unknown last', () => {
    expect(evaluationYearOptions([2023, null, 2025, 2023, 2024, null])).toEqual(['2025', '2024', '2023', 'unknown']);
    expect(evaluationYearOptions([])).toEqual([]);
  });
});

describe('evaluation formatting and links', () => {
  it('distinguishes a real zero from missing money', () => {
    expect(formatEvaluationAmount(0)).toBe('0円');
    expect(formatEvaluationAmount(null)).toBe('金額未取得');
    expect(formatEvaluationAmount(Number.NaN)).toBe('金額未取得');
  });
  it('shows exact yen values including small and negative amounts', () => {
    expect(formatEvaluationAmount(1234567)).toBe('1,234,567円');
    expect(formatEvaluationAmount(0.25)).toBe('0.25円');
    expect(formatEvaluationAmount(-500)).toBe('-500円');
  });
  it('does not fabricate a year or date', () => {
    expect(formatEvaluationYear(null)).toBe('年度不明');
    expect(formatEvaluationYear(2024)).toBe('2024年度');
    expect(formatEvaluationTimestamp(null)).toBe('記録なし');
    expect(formatEvaluationTimestamp('invalid-date')).toBe('日時不明');
  });
  it('makes the display timezone explicit', () => {
    expect(formatEvaluationTimestamp('2026-10-10T00:00:00Z')).toContain('09:00');
    expect(formatEvaluationTimestamp('2026-10-10T00:00:00Z')).toContain('日本時間');
  });
  it('allows official web source URLs while preventing unsafe source links', () => {
    expect(safeEvaluationUrl('https://example.lg.jp/file.pdf')).toBe('https://example.lg.jp/file.pdf');
    expect(safeEvaluationUrl('http://example.lg.jp/file.pdf')).toBe('http://example.lg.jp/file.pdf');
    expect(safeEvaluationUrl('javascript:alert(1)')).toBeNull();
    expect(safeEvaluationUrl('data:text/html,unsafe')).toBeNull();
    expect(safeEvaluationUrl('/relative-file.pdf')).toBeNull();
  });
});

describe('evaluation asset validation', () => {
  it('accepts the complete version-one dataset and preserves original data', () => {
    expect(parseEvaluationDataset(dataset)).toBe(dataset);
    expect(parseEvaluationDataset(dataset).projects[0].amounts[0].amountYen).toBe(0);
  });
  it('accepts an empty but valid dataset', () => {
    expect(parseEvaluationDataset({ schemaVersion: 1, generatedAt: '', sources: [], projects: [] }).projects).toHaveLength(0);
  });
  it.each([null, [], {}, { ...dataset, schemaVersion: 2 }, { ...dataset, projects: null }, { ...dataset, sources: null }])('rejects malformed top-level payloads (case %#)', (value) => {
    expect(() => parseEvaluationDataset(value)).toThrow('形式');
  });
  it('rejects missing nested evidence and non-numeric money rather than displaying them as zero', () => {
    expect(() => parseEvaluationDataset({ ...dataset, projects: [{ ...baseProject, amounts: [{ ...baseProject.amounts[0], evidence: null }] }] })).toThrow();
    expect(() => parseEvaluationDataset({ ...dataset, projects: [{ ...baseProject, amounts: [{ ...baseProject.amounts[0], amountYen: '0' }] }] })).toThrow();
  });
  it('rejects unrecognized acquisition states', () => {
    expect(() => parseEvaluationDataset({ ...dataset, sources: [{ ...baseSource, status: 'perfect' }] })).toThrow();
  });
  it('accepts explicit failed and unsupported sources without inventing projects', () => {
    const value = parseEvaluationDataset({ ...dataset, projects: [], sources: [{ ...baseSource, status: 'unsupported', documents: [], lastSuccessAt: null }] });
    expect(value.projects).toEqual([]);
    expect(value.sources[0].lastSuccessAt).toBeNull();
  });
});
