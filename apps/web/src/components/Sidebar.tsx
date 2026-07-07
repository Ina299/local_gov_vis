'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import type { LocalGovBudget, BudgetItem, FiscalIndicator } from '@/types/budget';
import { formatAmount } from '@/lib/format';

interface SidebarProps {
  selectedRegion: LocalGovBudget | null;
  /** 同一団体の前年度データ（前年比表示用） */
  previousYearRegion?: LocalGovBudget | null;
}

const BUDGET_TYPE_LABELS: Record<LocalGovBudget['budgetType'], string> = {
  initial: '当初予算',
  supplementary: '補正予算',
  final: '決算',
};

function formatIndicator(indicator: FiscalIndicator): string {
  if (indicator.unit === '割合') return `${(indicator.value * 100).toFixed(1)}%`;
  if (indicator.unit === '千円') return formatAmount(indicator.value * 1000);
  return indicator.value.toFixed(2);
}

interface BudgetItemRowProps {
  item: BudgetItem;
  /** 構成比バーの基準額。0以下ならバー非表示 */
  total: number;
  level?: number;
}

function BudgetItemRow({ item, total, level = 0 }: BudgetItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const share = total > 0 ? (item.amount / total) * 100 : 0;
  const showBar = level === 0 && total > 0;

  return (
    <>
      <div
        className={`budget-item ${hasChildren ? 'expandable' : ''} ${expanded ? 'expanded' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div className="budget-item-head">
          <span>
            {hasChildren && <span className="expand-icon">{expanded ? '▼' : '▶'}</span>}
            {item.name}
          </span>
          <span className="budget-item-value">
            {formatAmount(item.amount)}
            {showBar && <span className="budget-item-share">{share.toFixed(1)}%</span>}
          </span>
        </div>
        {showBar && (
          <div className="budget-bar-track">
            <div className="budget-bar" style={{ width: `${Math.min(share, 100)}%` }} />
          </div>
        )}
      </div>
      {expanded && item.children?.map((child, index) => (
        <BudgetItemRow key={index} item={child} total={0} level={level + 1} />
      ))}
    </>
  );
}

interface BreakdownCardProps {
  title: string;
  items: BudgetItem[];
  total: number;
}

function BreakdownCard({ title, items, total }: BreakdownCardProps) {
  const sorted = useMemo(() => [...items].sort((a, b) => b.amount - a.amount), [items]);
  if (sorted.length === 0) return null;
  return (
    <div className="budget-card">
      <h3>{title}</h3>
      <div className="budget-list">
        {sorted.map((item, index) => (
          <BudgetItemRow key={index} item={item} total={total} />
        ))}
      </div>
    </div>
  );
}

export function Sidebar({ selectedRegion, previousYearRegion }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };

    sidebar.addEventListener('wheel', handleWheel, { passive: false });
    return () => sidebar.removeEventListener('wheel', handleWheel);
  }, []);

  if (!selectedRegion) {
    return (
      <aside className="sidebar" ref={sidebarRef}>
        <div className="budget-card">
          <h3>地域を選択</h3>
          <p>地図上の都道府県をクリックすると予算データが表示されます</p>
        </div>
      </aside>
    );
  }

  const perCapita =
    selectedRegion.perCapitaExpenditure ??
    (selectedRegion.population
      ? selectedRegion.totalExpenditure / selectedRegion.population
      : undefined);

  const yoy = previousYearRegion
    ? ((selectedRegion.totalExpenditure - previousYearRegion.totalExpenditure) /
        previousYearRegion.totalExpenditure) *
      100
    : null;

  return (
    <aside className="sidebar" ref={sidebarRef}>
      <div className="budget-card">
        <h3>{selectedRegion.name}</h3>
        <p>{selectedRegion.fiscalYear}年度 {BUDGET_TYPE_LABELS[selectedRegion.budgetType]}</p>
      </div>

      <div className="budget-card">
        <h3>歳出総額</h3>
        <div className="budget-amount">{formatAmount(selectedRegion.totalExpenditure)}</div>
        {yoy !== null && (
          <p>前年度比: {yoy >= 0 ? '+' : ''}{yoy.toFixed(1)}%</p>
        )}
        <p>歳入総額: {formatAmount(selectedRegion.totalRevenue)}</p>
        {selectedRegion.population && (
          <p>人口: {selectedRegion.population.toLocaleString()}人</p>
        )}
        {perCapita !== undefined && (
          <p>一人当たり歳出: {formatAmount(perCapita)}</p>
        )}
      </div>

      <BreakdownCard
        title="歳出内訳（目的別）"
        items={selectedRegion.expenditures}
        total={selectedRegion.totalExpenditure}
      />

      {selectedRegion.expendituresByNature && (
        <BreakdownCard
          title="歳出内訳（性質別）"
          items={selectedRegion.expendituresByNature}
          total={selectedRegion.totalExpenditure}
        />
      )}

      <BreakdownCard
        title="歳入内訳"
        items={selectedRegion.revenues}
        total={selectedRegion.totalRevenue}
      />

      {selectedRegion.fiscalIndicators && selectedRegion.fiscalIndicators.length > 0 && (
        <div className="budget-card">
          <h3>財政指標</h3>
          <div className="budget-list">
            {selectedRegion.fiscalIndicators.map((indicator) => (
              <div className="budget-item" key={indicator.name}>
                <div className="budget-item-head">
                  <span>{indicator.name}</span>
                  <span className="budget-item-value">{formatIndicator(indicator)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="budget-card">
        <h3>データソース</h3>
        <p className="attribution">
          出典: Japan Dashboard 地方財政（都道府県ごと・市町村ごと）／デジタル庁・総務省
          <br />
          人口統計: 住民基本台帳に基づく人口（総務省・令和7年1月1日）／全国都道府県市区町村別面積調（国土地理院）
          <br />
          市区町村境界: 国土交通省 国土数値情報（行政区域）
        </p>
        {selectedRegion.sourceUrl && (
          <a href={selectedRegion.sourceUrl} target="_blank" rel="noopener noreferrer">
            元データを見る
          </a>
        )}
      </div>
    </aside>
  );
}
