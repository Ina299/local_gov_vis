'use client';

import type { LocalGovBudget, BudgetCategory } from '@/types/budget';
import { CATEGORY_LABELS } from '@/types/budget';

interface SidebarProps {
  selectedRegion: LocalGovBudget | null;
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000_000_000) {
    return `${(amount / 1_000_000_000_000).toFixed(2)}兆円`;
  }
  if (amount >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(0)}億円`;
  }
  if (amount >= 10_000) {
    return `${(amount / 10_000).toFixed(0)}万円`;
  }
  return `${amount}円`;
}

export function Sidebar({ selectedRegion }: SidebarProps) {
  if (!selectedRegion) {
    return (
      <aside className="sidebar">
        <div className="budget-card">
          <h3>地域を選択</h3>
          <p>地図上の都道府県をクリックすると予算データが表示されます</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="budget-card">
        <h3>{selectedRegion.name}</h3>
        <p>{selectedRegion.fiscalYear}年度 {selectedRegion.budgetType === 'initial' ? '当初予算' : '決算'}</p>
      </div>

      <div className="budget-card">
        <h3>歳出総額</h3>
        <div className="budget-amount">{formatAmount(selectedRegion.totalExpenditure)}</div>
        {selectedRegion.population && (
          <p>人口: {selectedRegion.population.toLocaleString()}人</p>
        )}
        {selectedRegion.perCapitaExpenditure && (
          <p>一人当たり: {formatAmount(selectedRegion.perCapitaExpenditure)}</p>
        )}
      </div>

      {selectedRegion.expenditures.length > 0 && (
        <div className="budget-card">
          <h3>歳出内訳</h3>
          <div className="budget-list">
            {selectedRegion.expenditures.map((item, index) => (
              <div key={index} className="budget-item">
                <span>{CATEGORY_LABELS[item.category as BudgetCategory] || item.name}</span>
                <span>{formatAmount(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedRegion.sourceUrl && (
        <div className="budget-card">
          <h3>データソース</h3>
          <a href={selectedRegion.sourceUrl} target="_blank" rel="noopener noreferrer">
            元データを見る
          </a>
        </div>
      )}
    </aside>
  );
}
