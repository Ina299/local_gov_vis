'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  METRICS,
  metricDisplayLabel,
  metricValue,
  type MapMetricKey,
} from '@/lib/metrics';
import { calculateCorrelation, correlationLabel } from '@/lib/correlation';
import type { LocalGovBudget, MapScale } from '@/types/budget';

interface CorrelationRankingModalProps {
  budgets: LocalGovBudget[];
  xKey: MapMetricKey;
  yKey: MapMetricKey;
  scale: MapScale;
  granularity: 'pref' | 'muni';
  onSelect: (key: MapMetricKey) => void;
  onClose: () => void;
}

export function CorrelationRankingModal({
  budgets,
  xKey,
  yKey,
  scale,
  granularity,
  onSelect,
  onClose,
}: CorrelationRankingModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const rows = useMemo(() => {
    return METRICS.filter(
      (metric) =>
        metric.key !== xKey && (granularity === 'pref' || !metric.prefOnly)
    )
      .map((metric) => {
        const pairs: Array<{ x: number; y: number }> = [];
        for (const budget of budgets) {
          const x = metricValue(budget, xKey, scale);
          const y = metricValue(budget, metric.key, scale);
          if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
          pairs.push({ x, y });
        }
        return {
          key: metric.key,
          label: metricDisplayLabel(metric.key, scale),
          count: pairs.length,
          coefficient: calculateCorrelation(pairs).coefficient,
        };
      })
      .filter(
        (
          row
        ): row is {
          key: MapMetricKey;
          label: string;
          count: number;
          coefficient: number;
        } => row.coefficient !== null
      )
      .sort((a, b) =>
        sortOrder === 'desc'
          ? b.coefficient - a.coefficient
          : a.coefficient - b.coefficient
      );
  }, [budgets, granularity, scale, sortOrder, xKey]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal correlation-ranking-modal"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${metricDisplayLabel(xKey, scale)}との相関係数ランキング`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3>{metricDisplayLabel(xKey, scale)}との相関係数ランキング</h3>
            <p>
              {sortOrder === 'desc'
                ? '相関係数が高い順（正の相関から表示）'
                : '相関係数が低い順（負の相関から表示）'}
            </p>
          </div>
          <div className="correlation-ranking-actions">
            <div className="comparison-segmented" role="group" aria-label="相関係数の並び順">
              <button
                className={sortOrder === 'desc' ? 'active' : ''}
                onClick={() => setSortOrder('desc')}
                aria-pressed={sortOrder === 'desc'}
              >
                降順
              </button>
              <button
                className={sortOrder === 'asc' ? 'active' : ''}
                onClick={() => setSortOrder('asc')}
                aria-pressed={sortOrder === 'asc'}
              >
                昇順
              </button>
            </div>
            <button className="modal-close" onClick={onClose} aria-label="閉じる">×</button>
          </div>
        </div>
        <div className="correlation-ranking-head" aria-hidden="true">
          <span>順位・指標</span>
          <span>相関係数</span>
        </div>
        <div className="correlation-ranking-list">
          {rows.map((row, index) => (
            <button
              key={row.key}
              className={`correlation-ranking-row ${row.key === yKey ? 'selected' : ''}`}
              onClick={() => onSelect(row.key)}
            >
              <span className="correlation-ranking-rank">{index + 1}</span>
              <span className="correlation-ranking-name">
                <strong>{row.label}</strong>
                <small>{correlationLabel(row.coefficient)}・{row.count}団体</small>
              </span>
              <span
                className={`correlation-ranking-value ${row.coefficient >= 0 ? 'positive' : 'negative'}`}
              >
                {row.coefficient >= 0 ? '+' : ''}{row.coefficient.toFixed(3)}
              </span>
            </button>
          ))}
        </div>
        <p className="correlation-ranking-note">
          欠損値は指標の組み合わせごとに除外しています。相関は因果関係を意味しません。
        </p>
      </div>
    </div>
  );
}
