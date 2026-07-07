'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/Sidebar';
import type { LocalGovBudget, MapMetric } from '@/types/budget';

// Leafletはクライアントサイドでのみ動作
const BudgetMap = dynamic(() => import('@/components/BudgetMap'), {
  ssr: false,
  loading: () => <div className="map-container">地図を読み込み中...</div>,
});

const METRIC_LABELS: Record<MapMetric, string> = {
  total: '歳出総額',
  perCapita: '一人当たり歳出',
};

export default function Home() {
  const [budgets, setBudgets] = useState<LocalGovBudget[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [metric, setMetric] = useState<MapMetric>('total');
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
          <div className="metric-toggle" role="group" aria-label="表示指標">
            {(Object.keys(METRIC_LABELS) as MapMetric[]).map((m) => (
              <button
                key={m}
                className={`metric-toggle-button ${metric === m ? 'active' : ''}`}
                onClick={() => setMetric(m)}
                aria-pressed={metric === m}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="main">
        <div className="map-container">
          <BudgetMap
            budgetsByCode={budgetsByCode}
            metric={metric}
            onSelectCode={setSelectedCode}
          />
        </div>
        <Sidebar selectedRegion={selectedRegion} previousYearRegion={previousYearRegion} />
      </main>
    </div>
  );
}
