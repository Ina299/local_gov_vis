'use client';

import { useMemo } from 'react';
import { formatMetricValue, type MapMetricKey } from '@/lib/metrics';

export interface SeriesPoint {
  year: number;
  value: number | null;
}

interface TimeSeriesChartProps {
  series: SeriesPoint[];
  metricKey: MapMetricKey;
}

const WIDTH = 320;
const HEIGHT = 130;
const MARGIN = { top: 10, right: 14, bottom: 22, left: 60 };
// 両端の点がプロット枠に張り付かないための内側余白
const X_INSET = 14;

/**
 * 選択指標の年度推移の折れ線。
 * 値はY軸目盛＋グリッド線で読み、正確な値は点のホバーで表示する
 */
export function TimeSeriesChart({ series, metricKey }: TimeSeriesChartProps) {
  const chart = useMemo(() => {
    const valid = series.filter((p): p is { year: number; value: number } => p.value !== null);
    if (valid.length < 2) return null;

    const years = valid.map((p) => p.year);
    const values = valid.map((p) => p.value);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      // 平坦な系列は中央に描く
      min -= Math.abs(min) * 0.05 || 1;
      max += Math.abs(max) * 0.05 || 1;
    } else {
      // 上下に5%の余白
      const pad = (max - min) * 0.05;
      min -= pad;
      max += pad;
    }

    const plotW = WIDTH - MARGIN.left - MARGIN.right;
    const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
    const y = (v: number) => MARGIN.top + (1 - (v - min) / (max - min)) * plotH;

    const points = valid.map((p) => ({
      ...p,
      x:
        MARGIN.left +
        X_INSET +
        ((p.year - minYear) / (maxYear - minYear)) * (plotW - X_INSET * 2),
      y: y(p.value),
    }));

    // Y軸目盛は下端・中央・上端の3本
    const ticks = [min, (min + max) / 2, max].map((v) => ({ value: v, y: y(v) }));

    return { points, ticks };
  }, [series]);

  if (!chart) return null;

  const { points, ticks } = chart;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: '100%', height: 'auto' }}
      role="img"
      aria-label="年度別推移"
    >
      {ticks.map((t) => (
        <g key={t.y}>
          <line
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={t.y}
            y2={t.y}
            stroke="#e1e0d9"
            strokeWidth={1}
          />
          <text
            x={MARGIN.left - 6}
            y={t.y + 3}
            textAnchor="end"
            fontSize={9}
            fill="#898781"
          >
            {formatMetricValue(t.value, metricKey)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#2a78d6" strokeWidth={2} />
      {points.map((p) => (
        <g key={p.year}>
          <circle cx={p.x} cy={p.y} r={3} fill="#2a78d6">
            <title>{`${p.year}年度: ${formatMetricValue(p.value, metricKey)}`}</title>
          </circle>
          <text
            x={p.x}
            y={HEIGHT - 6}
            textAnchor="middle"
            fontSize={10}
            fill="#898781"
          >
            {p.year}
          </text>
        </g>
      ))}
    </svg>
  );
}
