import { describe, expect, it } from 'vitest';
import type { LocalGovBudget } from '@/types/budget';
import {
  buildBudgetComparisonRows,
  closestPopulationBudget,
} from '@/lib/budgetComparison';

function budget(
  code: string,
  population: number | undefined,
  expenditures: Array<[string, number]>,
  revenues: Array<[string, number]> = []
): LocalGovBudget {
  return {
    code,
    name: code,
    prefecture: 'テスト県',
    fiscalYear: 2024,
    totalRevenue: revenues.reduce((sum, [, amount]) => sum + amount, 0),
    totalExpenditure: expenditures.reduce((sum, [, amount]) => sum + amount, 0),
    population,
    expenditures: expenditures.map(([name, amount]) => ({
      name,
      amount,
      category: 'other',
    })),
    revenues: revenues.map(([name, amount]) => ({
      name,
      amount,
      category: 'other',
    })),
  };
}

describe('buildBudgetComparisonRows', () => {
  const primary = budget('01', 100, [
    ['民生費', 1_000],
    ['教育費', 500],
  ]);
  const comparison = budget('02', 200, [
    ['民生費', 1_600],
    ['土木費', 600],
  ]);

  it('項目を揃え、存在しない項目を0円として総額比較する', () => {
    expect(buildBudgetComparisonRows(primary, comparison, 'expenditure', 'total')).toEqual([
      { name: '民生費', primaryValue: 1_000, comparisonValue: 1_600, maxValue: 1_600 },
      { name: '土木費', primaryValue: 0, comparisonValue: 600, maxValue: 600 },
      { name: '教育費', primaryValue: 500, comparisonValue: 0, maxValue: 500 },
    ]);
  });

  it('人口で割った一人当たり額を返す', () => {
    const rows = buildBudgetComparisonRows(primary, comparison, 'expenditure', 'perCapita');
    expect(rows.find((row) => row.name === '民生費')).toMatchObject({
      primaryValue: 10,
      comparisonValue: 8,
    });
  });

  it('人口がない団体の一人当たり額はnullにする', () => {
    const missingPopulation = budget('03', undefined, [['民生費', 300]]);
    const [row] = buildBudgetComparisonRows(
      primary,
      missingPopulation,
      'expenditure',
      'perCapita'
    );
    expect(row.comparisonValue).toBeNull();
  });
});

describe('closestPopulationBudget', () => {
  it('同年度・同じ階層から人口比が最も近い団体を選ぶ', () => {
    const primary = budget('01001', 10_000, []);
    const candidates = [
      budget('02', 10_000, []),
      budget('01002', 6_000, []),
      budget('01003', 11_000, []),
      { ...budget('01004', 10_100, []), fiscalYear: 2023 },
    ];
    expect(closestPopulationBudget(primary, candidates)?.code).toBe('01003');
  });
});
