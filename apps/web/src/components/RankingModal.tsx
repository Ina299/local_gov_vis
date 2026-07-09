'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { LocalGovBudget, MapScale } from '@/types/budget';
import {
  metricValue,
  formatMetricValue,
  metricDisplayLabel,
  type MapMetricKey,
} from '@/lib/metrics';

interface RankingModalProps {
  /** 表示中の階層・年度の全団体 */
  budgets: LocalGovBudget[];
  metricKey: MapMetricKey;
  scale: MapScale;
  year: number | null;
  selectedCode: string | null;
  /** 表示階層（地図と連動。切り替えると地図側も切り替わる） */
  granularity: 'pref' | 'muni';
  onGranularityChange: (granularity: 'pref' | 'muni') => void;
  /** 都道府県限定の指標では市区町村切替を出さない */
  prefOnly: boolean;
  /** 全国市区町村データの読み込み中 */
  loading: boolean;
  /** 行タップでその団体を地図で選択する */
  onSelect: (code: string) => void;
  onClose: () => void;
}

/** 現在の指標のランキング（高い順・同値は同順位）。選択中の団体をハイライトする */
export function RankingModal({
  budgets,
  metricKey,
  scale,
  year,
  selectedCode,
  granularity,
  onGranularityChange,
  prefOnly,
  loading,
  onSelect,
  onClose,
}: RankingModalProps) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const rows = useMemo(() => {
    const valued = budgets
      .map((b) => ({ b, value: metricValue(b, metricKey, scale) }))
      .filter((r): r is { b: LocalGovBudget; value: number } => r.value !== null)
      .sort((a, b) => b.value - a.value);
    // 同値は同順位（1,1,3…方式）
    let rank = 0;
    let prev: number | null = null;
    return valued.map((r, i) => {
      if (prev === null || r.value < prev) rank = i + 1;
      prev = r.value;
      return { ...r, rank };
    });
  }, [budgets, metricKey, scale]);

  // 選択中の団体が見える位置までスクロール（階層切替でリストが変わったときも）
  const selectedRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedRef.current) selectedRef.current.scrollIntoView({ block: 'center' });
    else if (listRef.current) listRef.current.scrollTop = 0;
  }, [rows]);

  const showPrefecture = rows[0]?.b.code.length === 5;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ranking-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            {metricDisplayLabel(metricKey, scale)}のランキング
            {year !== null ? `（${year}年度・高い順）` : '（高い順）'}
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="ranking-controls">
          <p className="attribution" style={{ marginBottom: 0 }}>
            {loading
              ? '市区町村データを読み込み中...'
              : `${rows.length.toLocaleString()}団体。行を選ぶと地図でその団体に移動します`}
          </p>
          {!prefOnly && (
            <div className="ranking-granularity" role="group" aria-label="ランキングの表示単位">
              <button
                className={`granularity-button ${granularity === 'pref' ? 'active' : ''}`}
                onClick={() => onGranularityChange('pref')}
                aria-pressed={granularity === 'pref'}
              >
                都道府県
              </button>
              <button
                className={`granularity-button ${granularity === 'muni' ? 'active' : ''}`}
                onClick={() => onGranularityChange('muni')}
                aria-pressed={granularity === 'muni'}
              >
                市区町村
              </button>
            </div>
          )}
        </div>
        <div className="ranking-list" ref={listRef}>
          {rows.map(({ b, value, rank }) => {
            const selected = b.code === selectedCode;
            return (
              <button
                key={b.code}
                ref={selected ? selectedRef : undefined}
                className={`ranking-row ${selected ? 'selected' : ''}`}
                onClick={() => onSelect(b.code)}
              >
                <span className="ranking-rank">{rank.toLocaleString()}</span>
                <span className="ranking-name">
                  {b.name}
                  {showPrefecture && <span className="ranking-pref">{b.prefecture}</span>}
                </span>
                <span className="ranking-value">{formatMetricValue(value, metricKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
