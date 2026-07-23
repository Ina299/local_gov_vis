'use client';

import { useState, useRef, useEffect } from 'react';
import { metricCategory, type MapMetricKey, type MetricCategory } from '@/lib/metrics';

const CATEGORY_LABELS: Record<MetricCategory, string> = {
  money: '歳入・歳出',
  population: '人口',
  fiscal: '財政指標',
  labor: '就労',
  infra: 'インフラ',
  safety: '安全',
};

interface MetricMenuProps {
  metricKey: MapMetricKey;
  comparisonActive?: boolean;
  onSelectCategory: (category: MetricCategory) => void;
  onSelectComparison: () => void;
}

/** ハンバーガーメニューで地図の表示カテゴリ（歳入・歳出／人口／財政指標）を選択する */
export function MetricMenu({
  metricKey,
  comparisonActive = false,
  onSelectCategory,
  onSelectComparison,
}: MetricMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const current = metricCategory(metricKey);

  const select = (category: MetricCategory) => {
    onSelectCategory(category);
    setOpen(false);
  };

  const selectComparison = () => {
    onSelectComparison();
    setOpen(false);
  };

  return (
    <div className="metric-menu" ref={rootRef}>
      <button
        className="metric-menu-button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="metric-menu-icon">☰</span>
        {comparisonActive ? '指標比較' : CATEGORY_LABELS[current]}
      </button>
      {open && (
        <div className="metric-menu-panel" role="menu">
          {(Object.keys(CATEGORY_LABELS) as MetricCategory[]).map((category) => (
            <button
              key={category}
              className={`metric-menu-item ${
                !comparisonActive && current === category ? 'active' : ''
              }`}
              role="menuitemradio"
              aria-checked={!comparisonActive && current === category}
              onClick={() => select(category)}
            >
              <span className="metric-menu-check">
                {!comparisonActive && current === category ? '✓' : ''}
              </span>
              <span>{CATEGORY_LABELS[category]}</span>
            </button>
          ))}
          <div className="metric-menu-divider" />
          <button
            className={`metric-menu-item ${comparisonActive ? 'active' : ''}`}
            role="menuitemradio"
            aria-checked={comparisonActive}
            onClick={selectComparison}
          >
            <span className="metric-menu-check">{comparisonActive ? '✓' : ''}</span>
            <span>指標比較</span>
          </button>
        </div>
      )}
    </div>
  );
}
