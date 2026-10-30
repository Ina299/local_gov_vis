import { describe, expect, it } from 'vitest';
import { COVERAGE_COLORS, COVERAGE_LEVELS, coverageLabel, evaluationEntryHref } from './evaluationCoverage';
import { categoryKeys, metricDef, metricLabelValue } from './metrics';
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
    expect(categoryKeys('evaluation')).toEqual(['evaluationCoverage']);
    expect(metricDef('evaluationCoverage').kind).toBe('category');
    const budget = { code: '27140', evaluationCoverage: { level: 2 } } as LocalGovBudget;
    expect(metricLabelValue(budget, 'evaluationCoverage')).toBe('評価資料の本文あり');
    expect(metricLabelValue({ code: '27140' } as LocalGovBudget, 'evaluationCoverage')).toBeNull();
    expect(coverageLabel({ level: 99 })).toBeNull();
    expect(categoryOrder('evaluationCoverage')).toEqual(COVERAGE_LEVELS);
    for (const label of COVERAGE_LEVELS) expect(categoryColor('evaluationCoverage', label)).toBe(COVERAGE_COLORS[label]);
  });
});
