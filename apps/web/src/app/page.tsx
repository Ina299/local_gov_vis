'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/Sidebar';
import type { LocalGovBudget, BudgetBasis, MapScale } from '@/types/budget';

// Leafletはクライアントサイドでのみ動作
const BudgetMap = dynamic(() => import('@/components/BudgetMap'), {
  ssr: false,
  loading: () => <div className="map-container">地図を読み込み中...</div>,
});

const BASIS_LABELS: Record<BudgetBasis, string> = {
  expenditure: '歳出',
  revenue: '歳入',
};

const SCALE_LABELS: Record<MapScale, string> = {
  total: '総額',
  perCapita: '一人当たり',
};

export default function Home() {
  const [budgets, setBudgets] = useState<LocalGovBudget[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [basis, setBasis] = useState<BudgetBasis>('expenditure');
  const [scale, setScale] = useState<MapScale>('total');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    fetch('/budgets.json')
      .then((res) => res.json())
      .then((data: LocalGovBudget[]) => {
        setBudgets(data);
        setYear(Math.max(...data.map((b) => b.fiscalYear)));
      })
      .catch((err) => console.error('予算データ読み込みエラー:', err));
  }, []);

  const years = useMemo(
    () => Array.from(new Set(budgets.map((b) => b.fiscalYear))).sort(),
    [budgets]
  );

  // 選択年度の 自治体コード → 予算データ
  const budgetsByCode = useMemo(() => {
    const map = new Map<string, LocalGovBudget>();
    for (const b of budgets) {
      if (b.fiscalYear === year) map.set(b.code, b);
    }
    return map;
  }, [budgets, year]);

  const selectedRegion = selectedCode ? budgetsByCode.get(selectedCode) ?? null : null;

  // 前年度の同一団体データ（前年比表示用）
  const previousYearRegion = useMemo(() => {
    if (!selectedCode || year === null) return null;
    return (
      budgets.find((b) => b.code === selectedCode && b.fiscalYear === year - 1) ?? null
    );
  }, [budgets, selectedCode, year]);

  return (
    <div className="container">
      <header className="header">
        <h1>地方自治体予算マップ</h1>
        <div className="header-controls">
          <div className="metric-toggle" role="group" aria-label="年度">
            {years.map((y) => (
              <button
                key={y}
                className={`metric-toggle-button ${year === y ? 'active' : ''}`}
                onClick={() => setYear(y)}
                aria-pressed={year === y}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="metric-toggle" role="group" aria-label="集計対象">
            {(Object.keys(BASIS_LABELS) as BudgetBasis[]).map((b) => (
              <button
                key={b}
                className={`metric-toggle-button ${basis === b ? 'active' : ''}`}
                onClick={() => setBasis(b)}
                aria-pressed={basis === b}
              >
                {BASIS_LABELS[b]}
              </button>
            ))}
          </div>
          <div className="metric-toggle" role="group" aria-label="表示スケール">
            {(Object.keys(SCALE_LABELS) as MapScale[]).map((s) => (
              <button
                key={s}
                className={`metric-toggle-button ${scale === s ? 'active' : ''}`}
                onClick={() => setScale(s)}
                aria-pressed={scale === s}
              >
                {SCALE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="main">
        <div className="map-container">
          <BudgetMap
            budgetsByCode={budgetsByCode}
            basis={basis}
            scale={scale}
            onSelectCode={setSelectedCode}
          />
        </div>
        <Sidebar selectedRegion={selectedRegion} previousYearRegion={previousYearRegion} />
      </main>
    </div>
  );
}
