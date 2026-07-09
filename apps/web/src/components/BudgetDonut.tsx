'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BudgetItem } from '@/types/budget';
import { formatAmount, formatPerPerson } from '@/lib/format';
import { loadAverages, type BudgetAverages } from '@/lib/averages';
import {
  buildDonutData,
  donutSegmentPath,
  type DonutSegment,
} from '@/lib/donut';

interface BudgetDonutProps {
  /** 見出し（歳出・歳入） */
  title: string;
  items: BudgetItem[];
  total: number;
  /** 項目名→固定色（EXPENDITURE_COLORS / REVENUE_COLORS） */
  colors: Record<string, string>;
  /** 全国中央値の参照表（歳出/歳入） */
  avgTable: 'expenditure' | 'revenue';
  /** 中央値比較のレベル（都道府県間/市区町村間） */
  level: 'pref' | 'muni';
  fiscalYear: number;
  population?: number;
}

/** 詳細行のスタイル。折り返さず省略し、高さを完全固定する（選択でDOMが動かないように） */
const detailLineStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  height: '1.4em',
  lineHeight: '1.4em',
};

/**
 * 収支サマリーの二重ドーナツ。内側が大分類、外側が項目（項レベル）。
 * セグメントのタップ／ホバーで下の固定2行に名称・金額と
 * 住民1人あたり額の全国中央値との差を表示する
 */
export function BudgetDonut({
  title,
  items,
  total,
  colors,
  avgTable,
  level,
  fiscalYear,
  population,
}: BudgetDonutProps) {
  const data = useMemo(
    () => buildDonutData(items, total, colors, avgTable),
    [items, total, colors, avgTable]
  );
  const [active, setActive] = useState<DonutSegment | null>(null);

  const [averages, setAverages] = useState<BudgetAverages | null>(null);
  useEffect(() => {
    let mounted = true;
    loadAverages()
      .then((a) => mounted && setAverages(a))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  if (data.inner.length === 0) return null;

  const segmentProps = (seg: DonutSegment) => ({
    stroke: '#ffffff',
    strokeWidth: 1.5,
    opacity: active === null || active === seg ? 1 : 0.45,
    onMouseEnter: () => setActive(seg),
    onClick: () => setActive(seg),
    style: { cursor: 'pointer' as const },
  });
  const segmentLabel = (seg: DonutSegment) =>
    `${seg.parent ? `${seg.parent}／` : ''}${seg.name}: ${formatAmount(seg.amount)}（${(
      seg.share * 100
    ).toFixed(1)}%）`;

  /** 詳細2行目: 1人あたり額と全国中央値との差（収支図の「中央値±」と同じ表記） */
  const perCapitaLine = (seg: DonutSegment) => {
    if (!population) return null;
    const pc = seg.amount / population;
    const median = seg.avg
      ? (averages?.[level].perCapita[seg.avg.table][String(fiscalYear)]?.[seg.avg.name] ?? null)
      : null;
    return (
      <>
        1人あたり 年{formatPerPerson(pc)}
        {median !== null && (
          <span style={{ color: pc - median >= 0 ? '#c0392b' : '#1e6bb8', fontWeight: 600 }}>
            {' '}
            中央値{pc - median >= 0 ? '+' : '−'}
            {formatPerPerson(Math.abs(pc - median))}/人
          </span>
        )}
      </>
    );
  };

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{title}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg
          viewBox="0 0 120 120"
          style={{ width: 130, height: 130, flexShrink: 0 }}
          onMouseLeave={() => setActive(null)}
          role="img"
          aria-label={`${title}の内訳（内側: 大分類、外側: 項目）`}
        >
          {data.inner.map((seg) => (
            <path
              key={`i-${seg.name}`}
              d={donutSegmentPath(seg.a0, seg.a1, 22, 38)}
              fill={seg.color}
              {...segmentProps(seg)}
            >
              <title>{segmentLabel(seg)}</title>
            </path>
          ))}
          {data.outer.map((seg) => (
            <path
              key={`o-${seg.parent ?? ''}-${seg.name}`}
              d={donutSegmentPath(seg.a0, seg.a1, 40, 56)}
              fill={seg.color}
              {...segmentProps(seg)}
            >
              <title>{segmentLabel(seg)}</title>
            </path>
          ))}
        </svg>
        <div style={{ fontSize: 12, lineHeight: 1.6, minWidth: 0, flex: 1 }}>
          {data.inner.map((seg) => (
            <div
              key={seg.name}
              style={{ display: 'flex', alignItems: 'baseline', gap: 6, cursor: 'pointer' }}
              onMouseEnter={() => setActive(seg)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(seg)}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  flexShrink: 0,
                  background: seg.color,
                  alignSelf: 'center',
                }}
              />
              <span
                style={{
                  flex: '1 1 auto',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={seg.name}
              >
                {seg.name}
              </span>
              <span style={{ color: '#52514e', flexShrink: 0 }}>
                {(seg.share * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      {/* 選択中セグメントの詳細。常に2行分の高さを確保し、選択でDOMが動かないようにする */}
      <div className="attribution" style={{ marginTop: 4 }}>
        <div style={detailLineStyle}>{active ? segmentLabel(active) : ''}</div>
        <div style={detailLineStyle}>{active ? perCapitaLine(active) : ''}</div>
      </div>
    </div>
  );
}
