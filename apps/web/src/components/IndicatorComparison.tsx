'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  METRICS,
  formatMetricValue,
  metricDisplayLabel,
  metricValue,
  type MapMetricKey,
  type MetricCategory,
} from '@/lib/metrics';
import { calculateCorrelation, correlationLabel } from '@/lib/correlation';
import type { LocalGovBudget, MapScale } from '@/types/budget';
import { CorrelationRankingModal } from '@/components/CorrelationRankingModal';

const CATEGORY_LABELS: Record<MetricCategory, string> = {
  money: '歳入・歳出',
  population: '人口',
  fiscal: '財政指標',
  labor: '就労',
  infra: 'インフラ',
  safety: '安全',
};

const WIDTH = 900;
const HEIGHT = 520;
const MARGIN = { top: 24, right: 28, bottom: 76, left: 100 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

interface IndicatorComparisonProps {
  budgets: LocalGovBudget[];
  years: number[];
  year: number | null;
  xKey: MapMetricKey;
  yKey: MapMetricKey;
  scale: MapScale;
  granularity: 'pref' | 'muni';
  loading: boolean;
  onYearChange: (year: number) => void;
  onXKeyChange: (key: MapMetricKey) => void;
  onYKeyChange: (key: MapMetricKey) => void;
  onScaleChange: (scale: MapScale) => void;
  onGranularityChange: (granularity: 'pref' | 'muni') => void;
}

interface ScatterPoint {
  code: string;
  name: string;
  prefecture: string;
  prefectureCode: string;
  x: number;
  y: number;
}

function paddedDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const padding = Math.abs(min) * 0.05 || 1;
    return [min - padding, max + padding];
  }
  const padding = (max - min) * 0.06;
  return [min - padding, max + padding];
}

function position(value: number, domain: [number, number], length: number): number {
  return ((value - domain[0]) / (domain[1] - domain[0])) * length;
}

/** 47都道府県に、近いコード同士でも見分けやすい色相を割り当てる。 */
function prefectureColor(code: string): string {
  const number = Number(code) || 1;
  const hue = Math.round((number * 137.508) % 360);
  return `hsl(${hue} 62% 45%)`;
}

export function IndicatorComparison({
  budgets,
  years,
  year,
  xKey,
  yKey,
  scale,
  granularity,
  loading,
  onYearChange,
  onXKeyChange,
  onYKeyChange,
  onScaleChange,
  onGranularityChange,
}: IndicatorComparisonProps) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [rankingOpen, setRankingOpen] = useState(false);

  const availableMetrics = useMemo(
    () => METRICS.filter((metric) => granularity === 'pref' || !metric.prefOnly),
    [granularity]
  );

  // 市区町村へ切り替えた直後に都道府県限定の指標が残っていた場合の表示用キー。
  const safeXKey =
    granularity === 'muni' && METRICS.find((metric) => metric.key === xKey)?.prefOnly
      ? 'populationDensity'
      : xKey;
  const safeYKey =
    granularity === 'muni' && METRICS.find((metric) => metric.key === yKey)?.prefOnly
      ? 'avgIncome'
      : yKey;

  // URLから復元した都道府県限定指標が市区町村表示では使えない場合、
  // 表示上のフォールバックだけでなく共有URLの状態も有効な指標へ揃える
  useEffect(() => {
    if (safeXKey !== xKey) onXKeyChange(safeXKey);
    if (safeYKey !== yKey) onYKeyChange(safeYKey);
  }, [onXKeyChange, onYKeyChange, safeXKey, safeYKey, xKey, yKey]);

  const points = useMemo<ScatterPoint[]>(() => {
    const result: ScatterPoint[] = [];
    for (const budget of budgets) {
      const x = metricValue(budget, safeXKey, scale);
      const y = metricValue(budget, safeYKey, scale);
      if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      result.push({
        code: budget.code,
        name: budget.name,
        prefecture: budget.prefecture,
        prefectureCode: budget.code.slice(0, 2),
        x,
        y,
      });
    }
    return result;
  }, [budgets, safeXKey, safeYKey, scale]);

  const result = useMemo(() => calculateCorrelation(points), [points]);
  const xDomain = useMemo<[number, number]>(
    () => (points.length ? paddedDomain(points.map((point) => point.x)) : [0, 1]),
    [points]
  );
  const yDomain = useMemo<[number, number]>(
    () => (points.length ? paddedDomain(points.map((point) => point.y)) : [0, 1]),
    [points]
  );
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const hovered = points.find((point) => point.code === hoveredCode) ?? null;
  const hasMoneyAxis = [safeXKey, safeYKey].some(
    (key) => METRICS.find((metric) => metric.key === key)?.kind === 'money'
  );

  const selectOptions = (Object.keys(CATEGORY_LABELS) as MetricCategory[]).map((category) => (
    <optgroup key={category} label={CATEGORY_LABELS[category]}>
      {availableMetrics
        .filter((metric) => metric.category === category)
        .map((metric) => (
          <option key={metric.key} value={metric.key}>{metric.label}</option>
        ))}
    </optgroup>
  ));

  return (
    <main className="comparison-main">
      <section className="comparison-heading">
        <div>
          <p className="comparison-eyebrow">指標比較</p>
          <h2>自治体の指標同士を比べる</h2>
          <p>
            各点が1自治体です。点にカーソルを合わせると値を確認できます。
            {granularity === 'muni' && ' 色は都道府県を表します。'}
          </p>
        </div>
        <div className="comparison-stat-actions">
          <div className="comparison-stat" aria-live="polite">
            <span>相関係数（Pearson）</span>
            <strong>{result.coefficient === null ? '—' : result.coefficient.toFixed(3)}</strong>
            <small>{correlationLabel(result.coefficient)}・{points.length}団体</small>
          </div>
          <button className="correlation-ranking-open" onClick={() => setRankingOpen(true)}>
            相関ランキング
          </button>
        </div>
      </section>

      <section className="comparison-controls" aria-label="比較条件">
        <label>
          <span>X軸</span>
          <select
            value={safeXKey}
            onChange={(event) => onXKeyChange(event.target.value as MapMetricKey)}
          >
            {selectOptions}
          </select>
        </label>
        <button
          className="comparison-swap"
          type="button"
          aria-label="X軸とY軸を入れ替える"
          title="X軸とY軸を入れ替える"
          onClick={() => {
            onXKeyChange(safeYKey);
            onYKeyChange(safeXKey);
          }}
        >
          ⇄
        </button>
        <label>
          <span>Y軸</span>
          <select
            value={safeYKey}
            onChange={(event) => onYKeyChange(event.target.value as MapMetricKey)}
          >
            {selectOptions}
          </select>
        </label>
        <label>
          <span>年度</span>
          <select
            value={year ?? ''}
            onChange={(event) => onYearChange(Number(event.target.value))}
          >
            {years.map((item) => (
              <option key={item} value={item}>{item}年度</option>
            ))}
          </select>
        </label>
        <div className="comparison-field">
          <span>表示単位</span>
          <div className="comparison-segmented" role="group" aria-label="表示単位">
            <button
              className={granularity === 'pref' ? 'active' : ''}
              onClick={() => onGranularityChange('pref')}
              aria-pressed={granularity === 'pref'}
            >
              都道府県
            </button>
            <button
              className={granularity === 'muni' ? 'active' : ''}
              onClick={() => onGranularityChange('muni')}
              aria-pressed={granularity === 'muni'}
            >
              市区町村
            </button>
          </div>
        </div>
        {hasMoneyAxis && (
          <div className="comparison-field">
            <span>金額</span>
            <div className="comparison-segmented" role="group" aria-label="金額の集計">
              <button
                className={scale === 'perCapita' ? 'active' : ''}
                onClick={() => onScaleChange('perCapita')}
                aria-pressed={scale === 'perCapita'}
              >
                一人当たり
              </button>
              <button
                className={scale === 'total' ? 'active' : ''}
                onClick={() => onScaleChange('total')}
                aria-pressed={scale === 'total'}
              >
                総額
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="comparison-chart-card">
        {loading && <div className="comparison-loading">市区町村データを読み込み中...</div>}
        {hovered && (
          <div className="comparison-tooltip" aria-live="polite">
            <strong>{hovered.name}</strong>
            {granularity === 'muni' && <span>{hovered.prefecture}</span>}
            <span>{metricDisplayLabel(safeXKey, scale)}: {formatMetricValue(hovered.x, safeXKey)}</span>
            <span>{metricDisplayLabel(safeYKey, scale)}: {formatMetricValue(hovered.y, safeYKey)}</span>
          </div>
        )}
        {points.length < 2 ? (
          <div className="comparison-empty">この条件で比較できるデータがありません。</div>
        ) : (
          <svg
            className="comparison-chart"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`${metricDisplayLabel(safeXKey, scale)}と${metricDisplayLabel(safeYKey, scale)}の散布図`}
          >
            {ticks.map((tick) => {
              const x = MARGIN.left + tick * PLOT_WIDTH;
              const y = MARGIN.top + (1 - tick) * PLOT_HEIGHT;
              const xValue = xDomain[0] + tick * (xDomain[1] - xDomain[0]);
              const yValue = yDomain[0] + tick * (yDomain[1] - yDomain[0]);
              return (
                <g key={tick}>
                  <line className="comparison-grid" x1={x} x2={x} y1={MARGIN.top} y2={MARGIN.top + PLOT_HEIGHT} />
                  <line className="comparison-grid" x1={MARGIN.left} x2={MARGIN.left + PLOT_WIDTH} y1={y} y2={y} />
                  <text className="comparison-axis-tick" x={x} y={MARGIN.top + PLOT_HEIGHT + 24} textAnchor="middle">
                    {formatMetricValue(xValue, safeXKey)}
                  </text>
                  <text className="comparison-axis-tick" x={MARGIN.left - 14} y={y + 4} textAnchor="end">
                    {formatMetricValue(yValue, safeYKey)}
                  </text>
                </g>
              );
            })}
            <line className="comparison-axis" x1={MARGIN.left} x2={MARGIN.left + PLOT_WIDTH} y1={MARGIN.top + PLOT_HEIGHT} y2={MARGIN.top + PLOT_HEIGHT} />
            <line className="comparison-axis" x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={MARGIN.top + PLOT_HEIGHT} />
            {result.slope !== null && result.intercept !== null && (
              <line
                className="comparison-trend"
                x1={MARGIN.left}
                y1={MARGIN.top + PLOT_HEIGHT - position(result.intercept + result.slope * xDomain[0], yDomain, PLOT_HEIGHT)}
                x2={MARGIN.left + PLOT_WIDTH}
                y2={MARGIN.top + PLOT_HEIGHT - position(result.intercept + result.slope * xDomain[1], yDomain, PLOT_HEIGHT)}
              />
            )}
            {points.map((point) => (
              <circle
                key={point.code}
                className={`comparison-point ${hoveredCode === point.code ? 'active' : ''}`}
                style={
                  {
                    '--point-color':
                      granularity === 'muni' ? prefectureColor(point.prefectureCode) : '#2a78d6',
                  } as CSSProperties
                }
                cx={MARGIN.left + position(point.x, xDomain, PLOT_WIDTH)}
                cy={MARGIN.top + PLOT_HEIGHT - position(point.y, yDomain, PLOT_HEIGHT)}
                r={granularity === 'muni' ? 3.5 : 5}
                tabIndex={0}
                onMouseEnter={() => setHoveredCode(point.code)}
                onMouseLeave={() => setHoveredCode(null)}
                onFocus={() => setHoveredCode(point.code)}
                onBlur={() => setHoveredCode(null)}
              >
                <title>{point.name}: {formatMetricValue(point.x, safeXKey)} / {formatMetricValue(point.y, safeYKey)}</title>
              </circle>
            ))}
            {granularity === 'pref' &&
              points.map((point) => (
                <text
                  key={`label-${point.code}`}
                  className="comparison-point-label"
                  x={MARGIN.left + position(point.x, xDomain, PLOT_WIDTH) + 7}
                  y={MARGIN.top + PLOT_HEIGHT - position(point.y, yDomain, PLOT_HEIGHT) + 4}
                >
                  {point.name}
                </text>
              ))}
            <text className="comparison-axis-label" x={MARGIN.left + PLOT_WIDTH / 2} y={HEIGHT - 16} textAnchor="middle">
              {metricDisplayLabel(safeXKey, scale)}
            </text>
            <text
              className="comparison-axis-label"
              x={18}
              y={MARGIN.top + PLOT_HEIGHT / 2}
              textAnchor="middle"
              transform={`rotate(-90 18 ${MARGIN.top + PLOT_HEIGHT / 2})`}
            >
              {metricDisplayLabel(safeYKey, scale)}
            </text>
          </svg>
        )}
      </section>
      <p className="comparison-note">
        相関は因果関係を意味しません。欠損値のある団体は集計から除外しています。
        出典: Japan Dashboard 地方財政（都道府県ごと・市町村ごと）／デジタル庁・総務省
      </p>
      {rankingOpen && (
        <CorrelationRankingModal
          budgets={budgets}
          xKey={safeXKey}
          yKey={safeYKey}
          scale={scale}
          granularity={granularity}
          onSelect={(key) => {
            onYKeyChange(key);
            setRankingOpen(false);
          }}
          onClose={() => setRankingOpen(false)}
        />
      )}
    </main>
  );
}
