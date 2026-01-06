'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/Sidebar';
import type { LocalGovBudget } from '@/types/budget';

// Leafletはクライアントサイドでのみ動作
const BudgetMap = dynamic(() => import('@/components/BudgetMap'), {
  ssr: false,
  loading: () => <div className="map-container">地図を読み込み中...</div>,
});

export default function Home() {
  const [selectedRegion, setSelectedRegion] = useState<LocalGovBudget | null>(null);

  return (
    <div className="container">
      <header className="header">
        <h1>地方自治体予算マップ</h1>
      </header>
      <main className="main">
        <div className="map-container">
          <BudgetMap onSelectRegion={setSelectedRegion} />
        </div>
        <Sidebar selectedRegion={selectedRegion} />
      </main>
    </div>
  );
}
