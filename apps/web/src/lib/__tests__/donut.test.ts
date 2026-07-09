import { describe, it, expect } from 'vitest';
import { buildDonutData, lighten, EXPENDITURE_COLORS } from '../donut';
import type { BudgetItem } from '@/types/budget';

const item = (name: string, amount: number, children?: BudgetItem[]): BudgetItem => ({
  name,
  amount,
  category: 'other',
  ...(children ? { children } : {}),
});

describe('lighten', () => {
  it('白に向けて混ぜる', () => {
    expect(lighten('#000000', 0.5)).toBe('#808080');
    expect(lighten('#2a78d6', 0)).toBe('#2a78d6');
    expect(lighten('#2a78d6', 1)).toBe('#ffffff');
  });
});

describe('buildDonutData', () => {
  const total = 1000;

  it('内側は全周をぴったり埋め、金額の大きい順に並ぶ', () => {
    const { inner } = buildDonutData(
      [item('民生費', 300), item('教育費', 500), item('土木費', 200)],
      total,
      EXPENDITURE_COLORS
    );
    expect(inner.map((s) => s.name)).toEqual(['教育費', '民生費', '土木費']);
    expect(inner[0].a0).toBe(0);
    expect(inner[inner.length - 1].a1).toBeCloseTo(2 * Math.PI, 6);
  });

  it('構成比2%未満の大分類はその他に畳まれる', () => {
    const { inner } = buildDonutData(
      [item('民生費', 980), item('議会費', 15), item('労働費', 5)],
      total,
      EXPENDITURE_COLORS
    );
    expect(inner.map((s) => s.name)).toEqual(['民生費', 'その他']);
    expect(inner[1].amount).toBe(20);
  });

  it('外側の項は親の区間と一致し、2%未満は親内のその他に畳まれる', () => {
    const { inner, outer } = buildDonutData(
      [
        item('民生費', 600, [
          item('社会福祉費', 300),
          item('児童福祉費', 250),
          item('災害救助費', 50), // 5% → 残す
        ]),
        item('教育費', 400, [item('小学校費', 390), item('大学費', 10)]), // 大学費1% → その他
      ],
      total,
      EXPENDITURE_COLORS
    );
    const minsei = inner.find((s) => s.name === '民生費')!;
    const minseiLeaves = outer.filter((s) => s.parent === '民生費');
    expect(minseiLeaves[0].a0).toBeCloseTo(minsei.a0, 6);
    expect(minseiLeaves[minseiLeaves.length - 1].a1).toBeCloseTo(minsei.a1, 6);
    expect(minseiLeaves.map((s) => s.name)).toEqual(['社会福祉費', '児童福祉費', '災害救助費']);
    expect(outer.filter((s) => s.parent === '教育費').map((s) => s.name)).toEqual([
      '小学校費',
      'その他',
    ]);
  });

  it('内訳のない大分類は外側にも同じ区間で通し表示する', () => {
    const { inner, outer } = buildDonutData([item('公債費', 1000)], total, EXPENDITURE_COLORS);
    expect(outer).toHaveLength(1);
    expect(outer[0].name).toBe('公債費');
    expect(outer[0].parent).toBeUndefined();
    expect(outer[0].a0).toBeCloseTo(inner[0].a0, 6);
    expect(outer[0].a1).toBeCloseTo(inner[0].a1, 6);
  });

  it('色は項目名の固定色（団体・順位によらない）', () => {
    const a = buildDonutData([item('民生費', 900), item('教育費', 100)], total, EXPENDITURE_COLORS);
    const b = buildDonutData([item('教育費', 900), item('民生費', 100)], total, EXPENDITURE_COLORS);
    const colorOf = (d: typeof a, name: string) => d.inner.find((s) => s.name === name)!.color;
    expect(colorOf(a, '民生費')).toBe(colorOf(b, '民生費'));
    expect(colorOf(a, '民生費')).toBe(EXPENDITURE_COLORS['民生費']);
  });

  it('中央値参照は歳出の款・項に付き、その他と歳入の内訳には付かない', () => {
    const exp = buildDonutData(
      [
        item('民生費', 600, [item('社会福祉費', 550), item('その他小項', 50)]),
        item('議会費', 10), // →その他に畳まれる
        item('公債費', 390),
      ],
      total,
      EXPENDITURE_COLORS,
      'expenditure'
    );
    expect(exp.inner.find((s) => s.name === '民生費')!.avg).toEqual({
      table: 'expenditure',
      name: '民生費',
    });
    expect(exp.inner.find((s) => s.name === 'その他')!.avg).toBeUndefined();
    expect(exp.outer.find((s) => s.name === '社会福祉費')!.avg).toEqual({
      table: 'expenditureDetail',
      name: '民生費/社会福祉費',
    });
    // 内訳のない款の通し表示は款の中央値を参照
    expect(exp.outer.find((s) => s.name === '公債費')!.avg).toEqual({
      table: 'expenditure',
      name: '公債費',
    });

    const rev = buildDonutData(
      [item('地方税', 900, [item('市町村民税', 880), item('その他税', 20)]), item('地方債', 100)],
      total,
      EXPENDITURE_COLORS,
      'revenue'
    );
    expect(rev.inner.find((s) => s.name === '地方税')!.avg).toEqual({
      table: 'revenue',
      name: '地方税',
    });
    expect(rev.outer.find((s) => s.name === '市町村民税')!.avg).toBeUndefined();
  });

  it('同一親内で隣り合う項の濃さが異なる', () => {
    const { outer } = buildDonutData(
      [
        item('民生費', 1000, [
          item('A', 400),
          item('B', 300),
          item('C', 200),
          item('D', 100),
        ]),
      ],
      total,
      EXPENDITURE_COLORS
    );
    for (let i = 1; i < outer.length; i++) {
      expect(outer[i].color).not.toBe(outer[i - 1].color);
    }
  });
});
