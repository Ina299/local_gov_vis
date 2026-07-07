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
const HEIGHT = 140;
const MARGIN = { top: 22, right: 10, bottom: 34, left: 10 };
// 中央揃えの値ラベルが両端でもはみ出さないだけの内側余白
const X_INSET = 26;

/** 選択指標の年度推移の折れ線。5点程度なので各点に値ラベルを直接表示する */
export function TimeSeriesChart({ series, metricKey }: TimeSeriesChartProps) {
  const points = useMemo(() => {
    const valid = series.filter((p): p is { year: number; value: number } => p.value !== null);
    if (valid.length < 2) return null;

    const years = valid.map((p) => p.year);
    const values = valid.map((p) => p.value);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= Math.abs(min) * 0.05 || 1;
      max += Math.abs(max) * 0.05 || 1;
    }

    const plotW = WIDTH - MARGIN.left - MARGIN.right - X_INSET * 2;
    const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
    return valid.map((p) => ({
      ...p,
      x: MARGIN.left + X_INSET + ((p.year - minYear) / (maxYear - minYear)) * plotW,
      y: MARGIN.top + (1 - (p.value - min) / (max - min)) * plotH,
    }));
  }, [series]);

  if (!points) return null;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // ラベルを下に逃がすのは「両隣より低い局所的な谷」だけ。
  // 中点比較だと単調でもカーブの凹みで反転してしまうため、厳密な谷に限定する
  const labelBelow = (i: number) => {
    if (i === 0 || i === points.length - 1) return false;
    const prev = points[i - 1];
    const next = points[i + 1];
    return points[i].y > prev.y && points[i].y > next.y;
  };

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: '100%', height: 'auto' }}
      role="img"
      aria-label="年度別推移"
    >
      <path d={path} fill="none" stroke="#2a78d6" strokeWidth={2} />
      {points.map((p, i) => (
        <g key={p.year}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#2a78d6" />
          <text
            x={p.x}
            y={labelBelow(i) ? p.y + 16 : p.y - 9}
            textAnchor="middle"
            fontSize={10}
            fill="#52514e"
          >
            {formatMetricValue(p.value, metricKey)}
          </text>
          <text
            x={p.x}
            y={HEIGHT - 8}
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
