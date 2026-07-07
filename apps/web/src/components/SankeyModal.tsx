'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LocalGovBudget } from '@/types/budget';
import { formatAmount } from '@/lib/format';
import { dataUrl } from '@/lib/paths';
import {
  WIDTH,
  MARGIN_Y,
  NODE_W,
  LABEL_BLOCK,
  buildLayout,
  nudgeLabels,
  ribbonPath,
  type AverageTable,
  type SankeyNode,
} from '@/lib/sankey';

interface SankeyModalProps {
  budget: LocalGovBudget;
  onClose: () => void;
}

/** 全国平均構成比（build-averages.tsが生成）: レベル → 表 → 年度 → 項目名 → 構成比 */
type BudgetAverages = Record<
  'pref' | 'muni',
  Record<AverageTable, Record<string, Record<string, number>>>
>;

let averagesPromise: Promise<BudgetAverages> | null = null;
function loadAverages(): Promise<BudgetAverages> {
  averagesPromise ??= fetch(dataUrl('/budget-averages.json')).then((res) => res.json());
  return averagesPromise;
}


/** 歳入内訳 → 財源区分（一般・特定） → 歳出（款） → 歳出（項）の資金フロー図 */
export function SankeyModal({ budget, onClose }: SankeyModalProps) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const { nodes, ribbons, bottom, estimated } = useMemo(() => buildLayout(budget), [budget]);

  // 全国平均構成比（同レベル間の単純平均）との比較
  const [averages, setAverages] = useState<BudgetAverages | null>(null);
  useEffect(() => {
    let active = true;
    loadAverages()
      .then((a) => active && setAverages(a))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const level = budget.code.length === 2 ? 'pref' : 'muni';
  /** ノードに対応する全国平均構成比（歳出は歳出総額比、歳入は歳入総額比） */
  const avgShare = (n: SankeyNode): number | null => {
    if (!averages || !n.avg) return null;
    return averages[level][n.avg.table][String(budget.fiscalYear)]?.[n.avg.name] ?? null;
  };
  /**
   * 平均乖離のラベル表記（多い=赤/少ない=青）。
   * 全国平均の構成比をこの団体の総額に換算した額との差で示す
   */
  const diffLabel = (n: SankeyNode): { text: string; color: string } | null => {
    const avg = avgShare(n);
    if (avg === null || !n.avg) return null;
    const total = n.avg.table === 'revenue' ? budget.totalRevenue : budget.totalExpenditure;
    const diff = n.amount - avg * total;
    // 1人当たりの額で示す（人口がない団体は総額で示す）
    const text = population
      ? `平均${diff >= 0 ? '+' : '−'}${perCapita(Math.abs(diff))}/人`
      : `平均${diff >= 0 ? '+' : '−'}${formatAmount(Math.abs(diff))}`;
    return { text, color: diff >= 0 ? '#c0392b' : '#1e6bb8' };
  };

  /** ラベル2行目: 1人あたり年額＋平均乖離 */
  const subLine = (n: SankeyNode) => {
    const pc = perCapita(n.amount);
    const d = diffLabel(n);
    if (!pc && !d) return null;
    return (
      <>
        {pc ? `年${pc}/人` : ''}
        {d && (
          <tspan dx={pc ? 5 : 0} fill={d.color} fontWeight={600}>
            {d.text}
          </tspan>
        )}
      </>
    );
  };

  // 左右端のラベル位置（全ノードにラベルを付け、重なりはずらして解消する）
  const labelYs = useMemo(() => {
    const map = new Map<string, number>();
    for (const side of ['left', 'right'] as const) {
      const sideNodes = nodes.filter((n) => n.label === side).sort((a, b) => a.y - b.y);
      const ys = nudgeLabels(
        sideNodes.map((n) => n.y + n.h / 2),
        MARGIN_Y
      );
      sideNodes.forEach((n, i) => map.set(n.key, ys[i]));
    }
    return map;
  }, [nodes]);

  const height = Math.max(bottom, Math.max(...Array.from(labelYs.values()), 0) + LABEL_BLOCK / 2) + MARGIN_Y;
  const pct = (share: number) => `${(share * 100).toFixed(1)}%`;

  // 「自分ごと」への翻訳: 住民1人あたりの年額
  const population = budget.population;
  const perCapita = (amount: number): string | null => {
    if (!population) return null;
    const v = amount / population;
    if (v >= 10_000) return `${(v / 10_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}万円`;
    return `${Math.round(v).toLocaleString()}円`;
  };
  const tooltip = (name: string, amount: number, share?: number, avg?: number | null): string => {
    const pc = perCapita(amount);
    const parts = [
      share !== undefined ? pct(share) : null,
      pc ? `1人あたり 年${pc}` : null,
      avg !== undefined && avg !== null
        ? `全国平均${pct(avg)}（${level === 'pref' ? '都道府県' : '市区町村'}間の単純平均）`
        : null,
    ]
      .filter(Boolean)
      .join('・');
    return `${name}: ${formatAmount(amount)}${parts ? `（${parts}）` : ''}`;
  };

  const evaluationSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${budget.name} 事務事業評価`
  )}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            {budget.name} 収支図（{budget.fiscalYear}年度 決算）
          </h3>
          <div className="modal-head-actions">
            <a
              className="text-button"
              href={evaluationSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="この自治体の事務事業評価（事業ごとの成果・コストの評価シート）を検索します"
            >
              事務事業評価を探す ↗
            </a>
            <button className="modal-close" onClick={onClose} aria-label="閉じる">
              ×
            </button>
          </div>
        </div>
        <p className="attribution">
          歳入 {formatAmount(budget.totalRevenue)} → 歳出 {formatAmount(budget.totalExpenditure)}
          {population
            ? `（住民1人あたり 年${perCapita(budget.totalExpenditure)}の支出）`
            : ''}
          。帯の太さは金額に比例。2%未満の項目は「その他」に集約。
          歳出への財源充当は総務省「地方財政状況調査」の目的別財源内訳による
          {estimated && '（この団体はデータがないため歳入構成比から推計）'}。
          一般財源 = 地方税・地方交付税・地方譲与税・地方特例交付金等。歳入項目から財源区分への割当は推計。
          「平均±」は全国の{level === 'pref' ? '都道府県' : '市区町村'}の平均的な構成比（単純平均）をこの団体の規模に換算した額との差（赤=平均より多い・青=少ない）。
        </p>
        {/* スマホではSVGを縮めず横スクロールで見せる（min-widthで文字サイズを確保） */}
        <div style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          style={{ width: '100%', minWidth: 860, height: 'auto', display: 'block' }}
        >
          {ribbons.map((r) => (
            <path
              key={`ribbon-${r.key}`}
              d={ribbonPath(r.x0, r.y0, r.x1, r.y1, r.h)}
              fill={r.color}
              opacity={0.3}
            >
              <title>{tooltip(r.name, r.amount)}</title>
            </path>
          ))}
          {nodes.map((n) => {
            const labelY = labelYs.get(n.key);
            const displaced = labelY !== undefined && Math.abs(labelY - (n.y + n.h / 2)) > n.h / 2 + 2;
            return (
              <g key={`node-${n.key}`}>
                <rect x={n.x} y={n.y} width={NODE_W} height={n.h} fill={n.color}>
                  <title>{tooltip(n.name, n.amount, n.share, avgShare(n))}</title>
                </rect>
                {n.label === 'left' && labelY !== undefined && (
                  <>
                    {displaced && (
                      <path
                        d={`M${n.x - 2},${n.y + n.h / 2} L${n.x - 6},${labelY}`}
                        stroke="#b0aea6"
                        strokeWidth={0.8}
                        fill="none"
                      />
                    )}
                    <text x={n.x - 9} y={labelY - 1} textAnchor="end" fontSize={11} fill="#1a1a2e">
                      {n.name} {formatAmount(n.amount)}（{pct(n.share)}）
                    </text>
                    <text x={n.x - 9} y={labelY + 11} textAnchor="end" fontSize={10} fill="#898781">
                      {subLine(n)}
                    </text>
                  </>
                )}
                {n.label === 'right' && labelY !== undefined && (
                  <>
                    {displaced && (
                      <path
                        d={`M${n.x + NODE_W + 2},${n.y + n.h / 2} L${n.x + NODE_W + 6},${labelY}`}
                        stroke="#b0aea6"
                        strokeWidth={0.8}
                        fill="none"
                      />
                    )}
                    <text x={n.x + NODE_W + 9} y={labelY - 1} fontSize={11} fill="#1a1a2e">
                      {n.name} {formatAmount(n.amount)}（{pct(n.share)}）
                    </text>
                    <text x={n.x + NODE_W + 9} y={labelY + 11} fontSize={10} fill="#898781">
                      {subLine(n)}
                    </text>
                  </>
                )}
                {n.label === 'halo' &&
                  (n.h >= 30 ? (
                    <>
                      <text
                        x={n.x + NODE_W / 2}
                        y={n.y + n.h / 2 - 2}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={600}
                        fill="#1a1a2e"
                        stroke="#ffffff"
                        strokeWidth={3.5}
                        paintOrder="stroke"
                      >
                        {n.name} {formatAmount(n.amount)}（{pct(n.share)}）
                      </text>
                      <text
                        x={n.x + NODE_W / 2}
                        y={n.y + n.h / 2 + 12}
                        textAnchor="middle"
                        fontSize={10}
                        fill="#52514e"
                        stroke="#ffffff"
                        strokeWidth={3}
                        paintOrder="stroke"
                      >
                        {subLine(n)}
                      </text>
                    </>
                  ) : (
                    <text
                      x={n.x + NODE_W / 2}
                      y={n.y + n.h / 2 + 4}
                      textAnchor="middle"
                      fontSize={10.5}
                      fontWeight={600}
                      fill="#1a1a2e"
                      stroke="#ffffff"
                      strokeWidth={3}
                      paintOrder="stroke"
                    >
                      {n.name} {formatAmount(n.amount)}（{pct(n.share)}）
                      {(() => {
                        const d = diffLabel(n);
                        return d ? (
                          <tspan dx={4} fill={d.color}>
                            {d.text}
                          </tspan>
                        ) : null;
                      })()}
                    </text>
                  ))}
              </g>
            );
          })}
        </svg>
        </div>
      </div>
    </div>
  );
}
