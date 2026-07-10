import type { BudgetItem, LocalGovBudget } from '@/types/budget';
import { GENERAL_SOURCES, prepareItems, type SankeyItem } from './sankey';

export interface FlowMosaicItem extends SankeyItem {
  generalAmount: number;
  specificAmount: number;
}

export interface FlowMosaicData {
  revenues: SankeyItem[];
  expenditures: FlowMosaicItem[];
  generalAmount: number;
  specificAmount: number;
  balance: number;
  estimated: boolean;
}

/** モバイル収支図とPCサンキーで同じ財源区分の考え方を使う。 */
export function buildFlowMosaicData(budget: LocalGovBudget): FlowMosaicData {
  const revenues = prepareItems(budget.revenues, budget.totalRevenue);
  const expenditures = prepareItems(budget.expenditures, budget.totalExpenditure);
  const generalRevenue = revenues
    .filter((item) => GENERAL_SOURCES.has(item.name))
    .reduce((sum, item) => sum + item.amount, 0);
  const estimated = !expenditures.some((item) => item.generalFunds !== undefined);
  const fallbackRatio = Math.min(1, generalRevenue / budget.totalExpenditure);

  const withFunding = expenditures.map((item): FlowMosaicItem => {
    const generalAmount = Math.min(
      item.amount,
      item.generalFunds ?? item.amount * fallbackRatio
    );
    return {
      ...item,
      generalAmount,
      specificAmount: Math.max(0, item.amount - generalAmount),
    };
  });
  const generalAmount = withFunding.reduce((sum, item) => sum + item.generalAmount, 0);

  return {
    revenues,
    expenditures: withFunding,
    generalAmount,
    specificAmount: Math.max(0, budget.totalExpenditure - generalAmount),
    balance: budget.totalRevenue - budget.totalExpenditure,
    estimated,
  };
}

export interface MosaicRect<T> {
  item: T;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 値の合計が長方形の面積になるよう二分割を繰り返す簡易treemap。
 * 横長の領域は左右、縦長の領域は上下に割り、細長いタイルを抑える。
 */
export function layoutMosaic<T>(
  items: T[],
  valueOf: (item: T) => number,
  width = 100,
  height = 100
): MosaicRect<T>[] {
  const positive = items.filter((item) => valueOf(item) > 0);
  const result: MosaicRect<T>[] = [];

  const visit = (group: T[], x: number, y: number, w: number, h: number): void => {
    if (group.length === 0) return;
    if (group.length === 1) {
      result.push({ item: group[0], x, y, width: w, height: h });
      return;
    }

    const total = group.reduce((sum, item) => sum + valueOf(item), 0);
    let split = 1;
    let before = valueOf(group[0]);
    while (
      split < group.length - 1 &&
      Math.abs(before + valueOf(group[split]) - total / 2) < Math.abs(before - total / 2)
    ) {
      before += valueOf(group[split]);
      split++;
    }
    const ratio = before / total;
    if (w >= h) {
      const firstW = w * ratio;
      visit(group.slice(0, split), x, y, firstW, h);
      visit(group.slice(split), x + firstW, y, w - firstW, h);
    } else {
      const firstH = h * ratio;
      visit(group.slice(0, split), x, y, w, firstH);
      visit(group.slice(split), x, y + firstH, w, h - firstH);
    }
  };

  visit(positive, 0, 0, width, height);
  return result;
}

export function detailItems(item: SankeyItem): BudgetItem[] {
  return [...(item.children ?? [])]
    .filter((child) => child.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}
