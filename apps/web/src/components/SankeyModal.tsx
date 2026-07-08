'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LocalGovBudget } from '@/types/budget';
import { formatAmount } from '@/lib/format';
import { dataUrl } from '@/lib/paths';
import { GLOSSARY } from '@/lib/glossary';
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

/**
 * 全国平均（build-averages.tsが生成）: レベル → 表 → 年度 → 項目名 → 値。
 * 直下は構成比（単純平均）、perCapita配下は1人あたり額（全国計÷全国人口、円/人）
 */
type AverageTables = Record<AverageTable, Record<string, Record<string, number>>>;
type BudgetAverages = Record<'pref' | 'muni', AverageTables & { perCapita: AverageTables }>;

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
  /** ノードに対応する全国中央値の1人あたり額（円/人。全団体の1人あたり額の中央値） */
  const medianPerCapita = (n: SankeyNode): number | null => {
    if (!averages || !n.avg) return null;
    return averages[level].perCapita[n.avg.table][String(budget.fiscalYear)]?.[n.avg.name] ?? null;
  };
  /**
   * 中央値乖離のラベル表記（多い=赤/少ない=青）。
   * この団体の1人あたり額と全国中央値の1人あたり額の差で示す。
   * 人口のない団体は平均構成比を総額換算した額との差（フォールバック）
   */
  const diffLabel = (n: SankeyNode): { text: string; color: string } | null => {
    if (!n.avg) return null;
    const pcMedian = medianPerCapita(n);
    if (population && pcMedian !== null) {
      const diff = n.amount / population - pcMedian;
      return {
        text: `中央値${diff >= 0 ? '+' : '−'}${fmtPerPerson(Math.abs(diff))}/人`,
        color: diff >= 0 ? '#c0392b' : '#1e6bb8',
      };
    }
    const avg = avgShare(n);
    if (avg === null) return null;
    const total = n.avg.table === 'revenue' ? budget.totalRevenue : budget.totalExpenditure;
    const diff = n.amount - avg * total;
    return {
      text: `平均${diff >= 0 ? '+' : '−'}${formatAmount(Math.abs(diff))}`,
      color: diff >= 0 ? '#c0392b' : '#1e6bb8',
    };
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
  const fmtPerPerson = (v: number): string =>
    v >= 10_000
      ? `${(v / 10_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}万円`
      : `${Math.round(v).toLocaleString()}円`;
  const perCapita = (amount: number): string | null =>
    population ? fmtPerPerson(amount / population) : null;
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

  // ノードの解説カード（ホバー・タップで表示。SVGネイティブのtitleと違いスマホでも出る）
  const [tip, setTip] = useState<{ x: number; y: number; node: SankeyNode } | null>(null);
  const showTip = (e: { clientX: number; clientY: number }, node: SankeyNode) =>
    setTip({ x: e.clientX, y: e.clientY, node });

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
          項目に触れる（タップする）と、そのお金が何に使われるかの解説を表示。
          歳出への財源充当は総務省「地方財政状況調査」の目的別財源内訳による
          {estimated && '（この団体はデータがないため歳入構成比から推計）'}。
          一般財源 = 地方税・地方交付税・地方譲与税・地方特例交付金等。歳入項目から財源区分への割当は推計。
          「中央値±」は住民1人あたり額の全国中央値（全国の{level === 'pref' ? '都道府県' : '市区町村'}を1人あたり額で並べたときの真ん中）との差（赤=中央値より多い・青=少ない）。
          都道府県と市区町村では役割分担が異なり、政令指定都市では教職員給与や保健所などが市側に計上されるため、同じ費目でも団体により計上先が異なることがある。
        </p>
        {/* スマホではSVGを縮めず横スクロールで見せる（min-widthで文字サイズを確保） */}
        <div style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          style={{ width: '100%', minWidth: 860, height: 'auto', display: 'block' }}
          onPointerDown={() => setTip(null)}
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
              <g
                key={`node-${n.key}`}
                onPointerEnter={(e) => showTip(e, n)}
                onPointerMove={(e) => showTip(e, n)}
                onPointerLeave={() => setTip(null)}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  showTip(e, n);
                }}
              >
                <rect x={n.x} y={n.y} width={NODE_W} height={n.h} fill={n.color} />
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
                        const pc = perCapita(n.amount);
                        const d = diffLabel(n);
                        return (
                          <>
                            {pc && (
                              <tspan dx={4} fill="#52514e" fontWeight={400}>
                                年{pc}/人
                              </tspan>
                            )}
                            {d && (
                              <tspan dx={4} fill={d.color}>
                                {d.text}
                              </tspan>
                            )}
                          </>
                        );
                      })()}
                    </text>
                  ))}
              </g>
            );
          })}
        </svg>
        </div>
        {tip &&
          (() => {
            const n = tip.node;
            const avg = avgShare(n);
            const pcMedian = medianPerCapita(n);
            const d = diffLabel(n);
            const pc = perCapita(n.amount);
            const desc = GLOSSARY[n.name];
            const W = 280;
            return (
              <div
                role="tooltip"
                style={{
                  position: 'fixed',
                  left: Math.max(8, Math.min(tip.x + 14, window.innerWidth - W - 12)),
                  top: Math.min(tip.y + 18, window.innerHeight - 180),
                  width: W,
                  background: '#fff',
                  border: '1px solid #d8d6cf',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.18)',
                  padding: '8px 10px',
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: '#1a1a2e',
                  pointerEvents: 'none',
                  zIndex: 1000,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {n.name} {formatAmount(n.amount)}（{pct(n.share)}）
                </div>
                {(pc || d) && (
                  <div style={{ color: '#52514e' }}>
                    {pc ? `1人あたり 年${pc}` : ''}
                    {d && (
                      <span style={{ color: d.color, fontWeight: 600, marginLeft: pc ? 6 : 0 }}>
                        {d.text}
                        {population && pcMedian !== null
                          ? `（全国中央値 年${fmtPerPerson(pcMedian)}/人）`
                          : avg !== null
                            ? `（全国平均${pct(avg)}）`
                            : ''}
                      </span>
                    )}
                  </div>
                )}
                {desc && <div style={{ marginTop: 4, color: '#52514e' }}>{desc}</div>}
                {n.natures &&
                  // 款名と同じ区分1件だけの自明な内訳（公債費→公債費100%）は出さない
                  !(n.natures.length === 1 && n.natures[0].name === n.name) && (
                    <div style={{ marginTop: 4, color: '#52514e' }}>
                      内訳:{' '}
                      <span style={{ fontWeight: 600 }}>
                        {n.natures.map((x) => `${x.name} ${x.share}%`).join('・')}
                      </span>
                    </div>
                  )}
              </div>
            );
          })()}
      </div>
    </div>
  );
}
