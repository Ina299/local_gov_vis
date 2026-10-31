import { describe, expect, it } from 'vitest';
import { COVERAGE_COLORS, COVERAGE_LEVELS, coverageLabel, evaluationEntryHref, transparencyOf } from './evaluationCoverage';
import { categoryKeys, metricDef, metricLabelValue, metricValue } from './metrics';
import { categoryColor, categoryOrder } from './parties';
import type { LocalGovBudget } from '@/types/budget';

describe('evaluation coverage', () => {
  it('links to the cost flow only when the municipality has one, otherwise to its sources', () => {
    expect(evaluationEntryHref('27140', { level: 0, flowYear: 2024 })).toBe('/evaluations/?municipality=27140&view=normalized#evaluation-cost-flow');
    expect(evaluationEntryHref('27140', { level: 1 })).toBe('/evaluations/?municipality=27140');
    expect(evaluationEntryHref('27140', undefined)).toBe('/evaluations/?municipality=27140');
    expect(evaluationEntryHref('27', { level: 2 })).toBe('/evaluations/?municipality=27000');
    expect(evaluationEntryHref('', undefined)).toBe('/evaluations/');
  });

  it('is a categorical layer with ordered, colored levels', () => {
    expect(categoryKeys('evaluation')).toEqual(['evaluationCoverage', 'evaluationTransparency']);
    expect(metricDef('evaluationCoverage').kind).toBe('category');
    const budget = { code: '27140', evaluationCoverage: { level: 2 } } as LocalGovBudget;
    expect(metricLabelValue(budget, 'evaluationCoverage')).toBe('評価資料の本文あり');
    expect(metricLabelValue({ code: '27140' } as LocalGovBudget, 'evaluationCoverage')).toBeNull();
    expect(coverageLabel({ level: 99 })).toBeNull();
    expect(categoryOrder('evaluationCoverage')).toEqual(COVERAGE_LEVELS);
    for (const label of COVERAGE_LEVELS) expect(categoryColor('evaluationCoverage', label)).toBe(COVERAGE_COLORS[label]);
  });

  it('transparency: the best comparable year, preferring same-year totals, 0 when nothing was read', () => {
    const totals = { '2023': 1000, '2024': 2000 };
    expect(transparencyOf({}, totals)).toBe(0);
    expect(transparencyOf({ '2023': 100, '2024': 100 }, totals)).toEqual({ ratio: 0.1, year: 2023, totalYear: 2023 });
    // 2025 has no total yet: use 2024 only when no same-year comparison exists
    expect(transparencyOf({ '2024': 100, '2025': 1000 }, totals)).toEqual({ ratio: 0.05, year: 2024, totalYear: 2024 });
    expect(transparencyOf({ '2025': 500 }, totals)).toEqual({ ratio: 0.25, year: 2025, totalYear: 2024 });
    expect(transparencyOf({ '2023': 5000 }, totals)).toBeNull(); // recorded exceeds the whole expenditure
    expect(transparencyOf({ '2010': 5 }, totals)).toBeNull();
    const budget = { code: '27140', evaluationCoverage: { level: 0, transparency: 0.25 } } as LocalGovBudget;
    expect(metricValue(budget, 'evaluationTransparency', 'total')).toBe(0.25);
    expect(metricValue({ code: '27140' } as LocalGovBudget, 'evaluationTransparency', 'total')).toBeNull();
    expect(metricDef('evaluationTransparency').kind).toBe('ratio');
  });
});
