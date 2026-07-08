import { describe, it, expect } from 'vitest';
import { buildLayout, prepareItems, nudgeLabels, LABEL_BLOCK, BALANCE_COLOR } from '../sankey';
import type { LocalGovBudget, BudgetItem } from '@/types/budget';

/** テスト用の予算データを組み立てる */
function makeBudget(over: Partial<LocalGovBudget>): LocalGovBudget {
  return {
    code: '08220',
    name: 'テスト市',
    prefecture: '茨城県',
    fiscalYear: 2024,
    budgetType: 'final',
    totalRevenue: 1000,
    totalExpenditure: 1000,
    expenditures: [],
    revenues: [],
    sourceUrl: '',
    crawledAt: '',
    ...over,
  };
}

const item = (name: string, amount: number, extra?: Partial<BudgetItem>): BudgetItem => ({
  name,
  amount,
  category: 'other',
  ...extra,
});

/** 歳出超過（歳入 < 歳出）の典型ケース */
const deficitBudget = makeBudget({
  totalRevenue: 900,
  totalExpenditure: 1000,
  revenues: [item('地方税', 500), item('国庫支出金', 300), item('繰入金', 100)],
  expenditures: [
    item('民生費', 400, {
      generalFunds: 200,
      children: [item('児童福祉費', 300), item('社会福祉費', 80)],
    }),
    item('教育費', 350, { generalFunds: 100 }),
    item('公債費', 250, { generalFunds: 240 }),
  ],
});

/** 歳入超過（歳入 > 歳出）の典型ケース */
const surplusBudget = makeBudget({
  totalRevenue: 1200,
  totalExpenditure: 1000,
  revenues: [item('地方税', 800), item('地方交付税', 200), item('国庫支出金', 200)],
  expenditures: [
    item('民生費', 600, { generalFunds: 300 }),
    item('土木費', 400, { generalFunds: 100 }),
  ],
});

describe('prepareItems', () => {
  it('2%未満の項目と「その他」を集約する', () => {
    const items = prepareItems(
      [item('大きい', 900), item('小さい', 10), item('その他', 90)],
      1000
    );
    expect(items.map((i) => i.name)).toEqual(['大きい', 'その他']);
    expect(items[1].amount).toBe(100);
  });

  it('generalFundsも集約される', () => {
    const items = prepareItems(
      [item('大きい', 900, { generalFunds: 500 }), item('小さい', 10, { generalFunds: 5 })],
      1000
    );
    expect(items.find((i) => i.name === 'その他')?.generalFunds).toBe(5);
  });

  it('金額0の項目は除外される', () => {
    expect(prepareItems([item('ゼロ', 0), item('正', 100)], 100)).toHaveLength(1);
  });

  it('性質別内訳（natures）を引き継ぐ', () => {
    const natures = [{ name: '人件費', share: 59 }];
    const items = prepareItems([item('教育費', 900, { natures }), item('小さい', 10)], 1000);
    expect(items.find((i) => i.name === '教育費')?.natures).toEqual(natures);
  });
});

describe('buildLayout 性質別内訳', () => {
  it('款ノードにnaturesが載る', () => {
    const budget = makeBudget({
      revenues: [item('地方税', 1000)],
      expenditures: [item('教育費', 1000, { natures: [{ name: '人件費', share: 59 }] })],
    });
    const node = buildLayout(budget).nodes.find((n) => n.key === 'exp-教育費');
    expect(node?.natures).toEqual([{ name: '人件費', share: 59 }]);
  });

  it('項ノードにもnaturesが載る', () => {
    const natures = [{ name: '扶助費', share: 40 }];
    const budget = makeBudget({
      revenues: [item('地方税', 1000)],
      expenditures: [
        item('民生費', 1000, { children: [item('児童福祉費', 800, { natures })] }),
      ],
    });
    const node = buildLayout(budget).nodes.find((n) => n.key === 'leaf-民生費-児童福祉費');
    expect(node?.natures).toEqual(natures);
  });
});

describe('buildLayout 不変条件', () => {
  for (const [label, budget] of [
    ['歳出超過', deficitBudget],
    ['歳入超過', surplusBudget],
  ] as const) {
    describe(label, () => {
      const layout = buildLayout(budget);

      it('実データがあるので推計フラグは立たない', () => {
        expect(layout.estimated).toBe(false);
      });

      it('左列（歳入＋補填）の合計が max(歳入, 歳出) と一致する', () => {
        const left = layout.nodes.filter((n) => n.label === 'left');
        const sum = left.reduce((s, n) => s + n.amount, 0);
        expect(sum).toBeCloseTo(Math.max(budget.totalRevenue, budget.totalExpenditure), 6);
      });

      it('財源区分の合計が max(歳入, 歳出) と一致する', () => {
        const secs = layout.nodes.filter((n) => n.key.startsWith('sec-'));
        const sum = secs.reduce((s, n) => s + n.amount, 0);
        expect(sum).toBeCloseTo(Math.max(budget.totalRevenue, budget.totalExpenditure), 6);
      });

      it('歳入項目→財源区分のリボン合計が各項目の金額と一致する', () => {
        for (const n of layout.nodes.filter((x) => x.label === 'left')) {
          const out = layout.ribbons
            .filter((r) => r.key.startsWith(`rev-${n.name}-`))
            .reduce((s, r) => s + r.amount, 0);
          expect(out).toBeCloseTo(n.amount, 6);
        }
      });

      it('財源区分→款のリボン合計が各款の金額と一致する', () => {
        for (const n of layout.nodes.filter((x) => x.key.startsWith('exp-'))) {
          const inflow = layout.ribbons
            .filter((r) => r.key.startsWith(`fund-${n.name}-`))
            .reduce((s, r) => s + r.amount, 0);
          expect(inflow).toBeCloseTo(n.amount, 6);
        }
      });

      it('款→項のリボン合計が各款の金額と一致する', () => {
        for (const n of layout.nodes.filter((x) => x.key.startsWith('exp-'))) {
          const leaves = layout.ribbons
            .filter((r) => r.key.startsWith(`leaf-${n.name}-`))
            .reduce((s, r) => s + r.amount, 0);
          expect(leaves).toBeCloseTo(n.amount, 6);
        }
      });

      it('款への一般財源の充当額はgeneralFunds（金額以下にクランプ）と一致する', () => {
        for (const e of budget.expenditures) {
          const g = layout.ribbons.find((r) => r.key === `fund-${e.name}-一般財源`);
          const expected = Math.min(e.amount, e.generalFunds ?? 0);
          expect(g?.amount ?? 0).toBeCloseTo(expected, 6);
        }
      });
    });
  }

  it('歳出超過では灰色の補填ノードが左列に出る', () => {
    const layout = buildLayout(deficitBudget);
    const gray = layout.nodes.find((n) => n.name === '収支差引（歳出超過）');
    expect(gray).toBeDefined();
    expect(gray!.amount).toBe(100);
    expect(gray!.color).toBe(BALANCE_COLOR);
    // 補填ノードは平均比較の対象外
    expect(gray!.avg).toBeUndefined();
  });

  it('歳入超過では右端に収支差引レーフが出る', () => {
    const layout = buildLayout(surplusBudget);
    const leaf = layout.nodes.find((n) => n.key === 'leaf-balance');
    expect(leaf).toBeDefined();
    expect(leaf!.amount).toBe(200);
    // 財源区分にも収支差引が立つ
    expect(layout.nodes.find((n) => n.key === 'sec-収支差引（歳入超過）')).toBeDefined();
  });

  it('項レベルのノードは款/項キーで平均を参照する', () => {
    const layout = buildLayout(deficitBudget);
    const leaf = layout.nodes.find((n) => n.key === 'leaf-民生費-児童福祉費');
    expect(leaf?.avg).toEqual({ table: 'expenditureDetail', name: '民生費/児童福祉費' });
    // 内訳のない款の通し表示は款の平均を使う
    const passThrough = layout.nodes.find((n) => n.key === 'leaf-教育費-教育費');
    expect(passThrough?.avg).toEqual({ table: 'expenditure', name: '教育費' });
    // 款内の残余「その他」は比較しない
    const others = layout.nodes.find((n) => n.key === 'leaf-民生費-その他');
    expect(others?.avg).toBeUndefined();
  });

  it('generalFundsがない場合は推計フラグが立ち、歳入の一般財源比率で按分する', () => {
    const budget = makeBudget({
      totalRevenue: 1000,
      totalExpenditure: 1000,
      revenues: [item('地方税', 600), item('国庫支出金', 400)],
      expenditures: [item('民生費', 500), item('土木費', 500)],
    });
    const layout = buildLayout(budget);
    expect(layout.estimated).toBe(true);
    // 一般財源 = 歳入の一般財源(600) / 歳出(1000) = 60% を各款に按分
    const g = layout.ribbons.find((r) => r.key === 'fund-民生費-一般財源');
    expect(g?.amount).toBeCloseTo(300, 6);
  });
});

describe('nudgeLabels', () => {
  it('重ならない場合はそのまま', () => {
    expect(nudgeLabels([10, 100, 200], 0)).toEqual([10, 100, 200]);
  });

  it('近すぎるラベルは最小間隔まで押し下げる', () => {
    const ys = nudgeLabels([50, 55, 60], 0);
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(LABEL_BLOCK);
    expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(LABEL_BLOCK);
  });

  it('上端より上には出ない', () => {
    const ys = nudgeLabels([-10, 5], 20);
    expect(ys[0]).toBeGreaterThanOrEqual(20);
  });
});
