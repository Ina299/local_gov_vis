import { expect, it } from 'vitest';
import type { LocalGovBudget } from '@/types/budget';
import { budgetYearChanges, yearChange } from '../budgetYearChanges';

const budget = (year: number, entries: Array<[string, number]>): LocalGovBudget => ({
  code: '20208', name: '小諸市', prefecture: '長野県', fiscalYear: year,
  totalRevenue: 0, totalExpenditure: 0, revenues: [],
  expenditures: entries.map(([name, amount]) => ({ name, amount, category: 'other' })),
});

it('aligns labels, sums repeated labels, and orders by absolute change', () => {
  const result = budgetYearChanges(budget(2024, [['教育費', 20], ['民生費', 150], ['教育費', 10]]), budget(2023, [['民生費', 100], ['教育費', 100]]), 'expenditures');
  expect(result.map(r => r.name)).toEqual(['教育費', '民生費']);
  expect(result[0]).toMatchObject({current:30, previous:100, difference:-70, rate:-70});
  expect(result[1].rate).toBe(50);
});

it('distinguishes missing categories and zero denominators', () => {
  expect(yearChange('零', 20, 0)).toMatchObject({difference:20, rate:null});
  expect(yearChange('零', 0, 0)).toMatchObject({difference:0, rate:null});
  const rows = budgetYearChanges(budget(2024, [['新項目', 20]]), budget(2023, [['旧項目', 10]]), 'expenditures');
  expect(rows.every(r => r.difference === null && r.rate === null)).toBe(true);
  expect(rows.find(r => r.name === '旧項目')?.current).toBeNull();
});

it('does not compare different municipalities or reverse the selected years', () => {
  const current = budget(2024, [['費用', 20]]), previous = budget(2023, [['費用', 10]]);
  expect(budgetYearChanges(current, {...previous, code:'20209'}, 'expenditures')).toEqual([]);
  expect(budgetYearChanges(previous, current, 'expenditures')).toEqual([]);
});
