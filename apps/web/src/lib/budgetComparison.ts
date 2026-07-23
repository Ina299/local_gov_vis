import type { BudgetItem, LocalGovBudget, MapScale } from '@/types/budget';

export type BudgetComparisonSide = 'expenditure' | 'revenue';

export interface BudgetComparisonRow {
  name: string;
  primaryValue: number | null;
  comparisonValue: number | null;
  maxValue: number;
}

function itemAmounts(items: BudgetItem[]): Map<string, number> {
  const amounts = new Map<string, number>();
  for (const item of items) {
    amounts.set(item.name, (amounts.get(item.name) ?? 0) + item.amount);
  }
  return amounts;
}

function scaledValue(
  amount: number,
  budget: LocalGovBudget,
  scale: MapScale
): number | null {
  if (scale === 'total') return amount;
  return budget.population && budget.population > 0 ? amount / budget.population : null;
}

/**
 * 2団体の歳入または歳出の大分類を同じ行へ揃える。
 * 一方に存在しない項目は0円として比較し、両団体の大きい方の値で降順に並べる。
 */
export function buildBudgetComparisonRows(
  primary: LocalGovBudget,
  comparison: LocalGovBudget,
  side: BudgetComparisonSide,
  scale: MapScale
): BudgetComparisonRow[] {
  const primaryItems = side === 'expenditure' ? primary.expenditures : primary.revenues;
  const comparisonItems =
    side === 'expenditure' ? comparison.expenditures : comparison.revenues;
  const primaryAmounts = itemAmounts(primaryItems);
  const comparisonAmounts = itemAmounts(comparisonItems);
  const names = new Set([
    ...Array.from(primaryAmounts.keys()),
    ...Array.from(comparisonAmounts.keys()),
  ]);

  return Array.from(names)
    .map((name) => {
      const primaryValue = scaledValue(primaryAmounts.get(name) ?? 0, primary, scale);
      const comparisonValue = scaledValue(
        comparisonAmounts.get(name) ?? 0,
        comparison,
        scale
      );
      return {
        name,
        primaryValue,
        comparisonValue,
        maxValue: Math.max(primaryValue ?? 0, comparisonValue ?? 0),
      };
    })
    .sort((a, b) => b.maxValue - a.maxValue || a.name.localeCompare(b.name, 'ja'));
}

export function closestPopulationBudget(
  primary: LocalGovBudget,
  candidates: LocalGovBudget[]
): LocalGovBudget | null {
  const eligible = candidates.filter(
    (candidate) =>
      candidate.code !== primary.code &&
      candidate.code.length === primary.code.length &&
      candidate.fiscalYear === primary.fiscalYear
  );
  if (eligible.length === 0) return null;
  if (!primary.population || primary.population <= 0) return eligible[0];

  return eligible.reduce((closest, candidate) => {
    const distance = candidate.population
      ? Math.abs(Math.log(candidate.population / primary.population!))
      : Number.POSITIVE_INFINITY;
    const closestDistance = closest.population
      ? Math.abs(Math.log(closest.population / primary.population!))
      : Number.POSITIVE_INFINITY;
    return distance < closestDistance ? candidate : closest;
  });
}
