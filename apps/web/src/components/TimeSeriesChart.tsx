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
const MARGIN = { top: 24, right: 16, bottom: 22, left: 16 };

/** 選択指標の年度推移を折れ線で表示する（各点に値ラベル付き） */
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
      // 平坦な系列は中央に描く
      min -= 1;
      max += 1;
    }

    const plotW = WIDTH - MARGIN.left - MARGIN.right;
    const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
    return valid.map((p) => ({
      ...p,
      x: MARGIN.left + ((p.year - minYear) / (maxYear - minYear)) * plotW,
      y: MARGIN.top + (1 - (p.value - min) / (max - min)) * plotH,
    }));
  }, [series]);

  if (!points) return null;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: '100%', height: 'auto' }}
      role="img"
      aria-label="年度別推移"
    >
      <path d={path} fill="none" stroke="#2a78d6" strokeWidth={2} />
      {points.map((p) => (
        <g key={p.year}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#2a78d6" />
          <text
            x={p.x}
            y={p.y - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#52514e"
          >
            {formatMetricValue(p.value, metricKey)}
          </text>
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
