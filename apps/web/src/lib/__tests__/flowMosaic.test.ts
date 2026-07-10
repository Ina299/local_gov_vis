import { describe, expect, it } from 'vitest';
import type { LocalGovBudget } from '@/types/budget';
import { buildFlowMosaicData, layoutMosaic } from '../flowMosaic';

const budget: LocalGovBudget = {
  code: '13',
  name: '東京都',
  prefecture: '東京都',
  fiscalYear: 2024,
  totalRevenue: 1_100,
  totalExpenditure: 1_000,
  revenues: [
    { name: '地方税', amount: 700, category: 'other' },
    { name: '国庫支出金', amount: 300, category: 'other' },
    { name: 'その他', amount: 100, category: 'other' },
  ],
  expenditures: [
    { name: '民生費', amount: 600, generalFunds: 400, category: 'welfare' },
    { name: '教育費', amount: 400, generalFunds: 100, category: 'education' },
  ],
};

describe('buildFlowMosaicData', () => {
  it('歳出を一般財源と特定財源に保存的に分割する', () => {
    const data = buildFlowMosaicData(budget);
    expect(data.estimated).toBe(false);
    expect(data.generalAmount).toBe(500);
    expect(data.specificAmount).toBe(500);
    expect(data.balance).toBe(100);
    expect(data.expenditures[0].generalAmount + data.expenditures[0].specificAmount).toBe(600);
  });

  it('充当実績がなければ歳入構成比から推計する', () => {
    const input = {
      ...budget,
      expenditures: budget.expenditures.map(({ generalFunds: _generalFunds, ...item }) => item),
    };
    const data = buildFlowMosaicData(input);
    expect(data.estimated).toBe(true);
    expect(data.generalAmount).toBeCloseTo(700);
  });
});

describe('layoutMosaic', () => {
  it('領域を重複なく全体へ配分する', () => {
    const rects = layoutMosaic([6, 3, 1], (value) => value);
    const area = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
    expect(rects).toHaveLength(3);
    expect(area).toBeCloseTo(10_000);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(100);
      expect(rect.y + rect.height).toBeLessThanOrEqual(100);
    }
  });
});
