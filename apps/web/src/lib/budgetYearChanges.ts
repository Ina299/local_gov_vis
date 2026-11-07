import type { BudgetItem, LocalGovBudget } from '@/types/budget';

export interface YearChangeRow {
  name: string;
  current: number | null;
  previous: number | null;
  difference: number | null;
  rate: number | null;
}

export function yearChange(name: string, current: number | null, previous: number | null): YearChangeRow {
  const difference = current === null || previous === null ? null : current - previous;
  return { name, current, previous, difference,
    rate: difference === null || previous === null || previous === 0 ? null : difference / Math.abs(previous) * 100 };
}

/** Compare matching top-level labels only; absent categories are unknown, not zero. */
export function budgetYearChanges(current: LocalGovBudget, previous: LocalGovBudget, side: 'expenditures' | 'revenues'): YearChangeRow[] {
  if (current.code !== previous.code || current.fiscalYear <= previous.fiscalYear) return [];
  const amounts = (items: BudgetItem[]) => {
    const map = new Map<string, number>();
    for (const item of items) if (Number.isFinite(item.amount)) map.set(item.name, (map.get(item.name) ?? 0) + item.amount);
    return map;
  };
  const now = amounts(current[side]), before = amounts(previous[side]);
  return Array.from(new Set([...Array.from(now.keys()), ...Array.from(before.keys())]))
    .map(name => yearChange(name, now.get(name) ?? null, before.get(name) ?? null))
    .sort((a,b) => (b.difference === null ? -1 : Math.abs(b.difference)) - (a.difference === null ? -1 : Math.abs(a.difference)) || a.name.localeCompare(b.name, 'ja'));
}
