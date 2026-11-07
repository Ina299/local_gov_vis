import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractKomoroBudget } from '../../../crawler/src/evaluations/komoro-budget';
import { costFlowYears } from './projectCostFlow';
import { filterEvaluations, parseEvaluationDataset } from './evaluations';
const dataset = extractKomoroBudget(JSON.parse(readFileSync(new URL('../../../../data/evaluations/komoro-budget-2026.json', import.meta.url), 'utf8')));

describe('Komoro initial budget display', () => {
  it('shows all 249 budget lines in 2026 without inventing actual expenditure', () => {
    const [flow] = costFlowYears(dataset.projects, 5, 'budget');
    expect(flow.fiscalYear).toBe(2026);
    expect(flow.projects).toHaveLength(249);
    expect(flow.total).toBe(23_700_000_000);
    expect(flow.conflicting).toBe(0);
    expect(flow.projects.every(p => p.group.endsWith('（款）') && p.department === '所管不明')).toBe(true);
    expect(costFlowYears(dataset.projects, 5, 'actual')).toEqual([]);
  });
  it('filters budget year and categories, and validates classification metadata', () => {
    expect(parseEvaluationDataset(dataset)).toBe(dataset);
    const filters = { municipality:'20208', evaluationYear:'', fiscalYear:'2026', query:'民生費' };
    const found = filterEvaluations(dataset.projects, filters);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every(p => p.initialBudget?.category === '民生費')).toBe(true);
    expect(filterEvaluations(dataset.projects, {...filters, fiscalYear:'2025'})).toEqual([]);
    const broken = structuredClone(dataset); broken.projects[0].initialBudget!.category = 123 as unknown as string;
    expect(() => parseEvaluationDataset(broken)).toThrow();
  });
});
