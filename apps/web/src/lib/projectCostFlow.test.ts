import { describe, expect, it } from 'vitest';
import type { EvaluationEvidence, ProjectEvaluation } from '@/types/evaluation';
import { budgetContext, costFlowLayout, costFlowYears, defaultFlowYear, departmentGroup } from './projectCostFlow';

const ev: EvaluationEvidence = { sourceUrl: 'https://example.lg.jp/a.pdf', sourcePageUrl: 'https://example.lg.jp/a.pdf', format: 'pdf', fetchedAt: '2026-10-01T00:00:00Z',
  sha256: 'a'.repeat(64), rawText: 'x', page: null, sheet: null, cell: null };
let n = 0;
const record = (name: string, department: string | null, amounts: Array<[ 'actual' | 'budget', number, number ]>): ProjectEvaluation => ({
  id: `r${n++}`, municipalityCode: '27140', municipalityName: '堺市', projectCode: null, projectName: name, department, evaluationYear: 2026, evaluatedFiscalYear: null,
  purpose: null, activities: null, outcomes: null, ratings: [], indicators: [], evidence: [ev], extractionStatus: 'partial', warnings: [],
  amounts: amounts.map(([kind, fiscalYear, amountYen]) => ({ kind, fiscalYear, amountYen, rawValue: String(amountYen), rawUnit: '円', evidence: ev })),
});

describe('project cost flow', () => {
  it('groups departments by their top unit', () => {
    expect(departmentGroup('市民人権局 ダイバーシティ推進部 ダイバーシティ企画課')).toBe('市民人権局');
    expect(departmentGroup('健康福祉部高齢福祉課')).toBe('健康福祉部');
    expect(departmentGroup('教育委員会事務局学校管理課')).toBe('教育委員会');
    expect(departmentGroup('総務課')).toBe('総務課');
    expect(departmentGroup('脱炭素・GREEN×EXPO推進局 推進課')).toBe('脱炭素・GREEN×EXPO推進局');
    expect(departmentGroup('こども青少年局保育 対策課')).toBe('こども青少年局');
    expect(departmentGroup(null)).toBe('所管不明');
  });

  it('counts a reprinted business once, drops disagreeing reprints and ignores budgets', () => {
    const projects = [
      record('A事業', '総務部 総務課', [['actual', 2024, 100]]),
      record('A事業', '総務部 総務課', [['actual', 2024, 100], ['actual', 2023, 90]]),
      record('B事業', '総務部 総務課', [['actual', 2024, 50]]),
      record('B事業', '総務部 総務課', [['actual', 2024, 60]]),
      record('C事業', '建設部', [['budget', 2024, 999], ['actual', 2024, 30]]),
      record('D事業', null, [['actual', 2024, 10], ['actual', 2024, 11]]),
      record('E事業', '建設部', [['actual', 2024, 5]]), record('F事業', '建設部', [['actual', 2024, 5]]), record('G事業', '建設部', [['actual', 2024, 5]]),
    ];
    const [y2024] = costFlowYears(projects);
    expect(y2024.fiscalYear).toBe(2024);
    expect(y2024.projects.map((p) => p.name)).toEqual(['A事業', 'C事業', 'E事業', 'F事業', 'G事業']);
    expect(y2024.projects[0].records).toBe(2);
    expect(y2024.total).toBe(145);
    expect(y2024.conflicting).toBe(1);
    expect(y2024.ambiguous).toBe(1);
    expect(costFlowYears(projects).some((y) => y.fiscalYear === 2023)).toBe(false); // fewer than 5 businesses
    expect(defaultFlowYear(costFlowYears(projects))).toBe(2024);
  });

  it('keeps every amount: root equals departments equals the right column, and ribbons conserve flow', () => {
    const projects = Array.from({ length: 40 }, (_, i) => record(`事業${i}`, `部${i % 13} 課`, [['actual', 2024, 1000 - i * 10]]));
    const [year] = costFlowYears(projects);
    const layout = costFlowLayout(year, 10, 15);
    const sum = (col: number) => layout.nodes.filter((x) => x.column === col).reduce((s, x) => s + x.amount, 0);
    expect(sum(0)).toBe(year.total); expect(sum(1)).toBe(year.total); expect(sum(2)).toBe(year.total);
    expect(layout.nodes.filter((x) => x.column === 1)).toHaveLength(11); // 10 departments + その他の部局
    expect(layout.nodes.filter((x) => x.column === 2 && x.projectName)).toHaveLength(15);
    for (const node of layout.nodes.filter((x) => x.column > 0)) {
      const inflow = layout.ribbons.filter((r) => r.to === node.key).reduce((s, r) => s + r.amount, 0);
      expect(inflow).toBe(node.amount);
    }
    const root = layout.nodes[0];
    const mids = layout.nodes.filter((x) => x.column === 1);
    expect(mids.reduce((s, x) => s + x.h, 0)).toBeCloseTo(root.h, 6); // one scale for all columns
  });
});

describe('budget context', () => {
  it('compares with the whole expenditure only when it is known and larger', () => {
    expect(budgetContext(50, 1000)).toEqual({ total: 1000, ratio: 0.05 });
    expect(budgetContext(50, undefined)).toBeNull();
    expect(budgetContext(2000, 1000)).toBeNull();
  });
});
