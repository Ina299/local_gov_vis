'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LocalGovBudget, BudgetItem } from '@/types/budget';
import { formatAmount } from '@/lib/format';
import { dataUrl } from '@/lib/paths';

interface SankeyModalProps {
  budget: LocalGovBudget;
  onClose: () => void;
}

/** 全国平均構成比（build-averages.tsが生成）: レベル → 表 → 年度 → 項目名 → 構成比 */
type AverageTable = 'expenditure' | 'revenue' | 'expenditureDetail';
type BudgetAverages = Record<
  'pref' | 'muni',
  Record<AverageTable, Record<string, Record<string, number>>>
>;

let averagesPromise: Promise<BudgetAverages> | null = null;
function loadAverages(): Promise<BudgetAverages> {
  averagesPromise ??= fetch(dataUrl('/budget-averages.json')).then((res) => res.json());
  return averagesPromise;
}


const WIDTH = 1180;
const PLOT_H = 500;
const MARGIN_Y = 28;
const LABEL_W_LEFT = 210;
const LABEL_W_RIGHT = 240;
const NODE_W = 14;
const GAP = 6; // 項目ノード間の隙間
const LABEL_BLOCK = 26; // 2行ラベルの占有高さ

// 列のx座標: 歳入項目 → 財源区分 → 歳出（款） → 歳出（項）
const X_REV = LABEL_W_LEFT;
const X_SOURCE = 430;
const X_EXP = 700;
const X_LEAF = WIDTH - LABEL_W_RIGHT - NODE_W;

const GENERAL_COLOR = '#2a78d6'; // 一般財源
const SPECIFIC_COLOR = '#7fb3ee'; // 特定財源等
const EXP_COLOR = '#e06a4b';
const BALANCE_COLOR = '#898781';

/** 使途が特定されない一般財源に分類する歳入項目 */
const GENERAL_SOURCES = new Set(['地方税', '地方交付税', '地方譲与税', '地方特例交付金等']);

interface SankeyItem {
  name: string;
  amount: number;
  generalFunds?: number;
  children?: BudgetItem[];
}

/** 構成比2%未満の項目は「その他」にまとめる（ラベルが潰れるため） */
function prepareItems(items: BudgetItem[], total: number): SankeyItem[] {
  const sorted = [...items].filter((i) => i.amount > 0).sort((a, b) => b.amount - a.amount);
  const main: SankeyItem[] = [];
  let others = 0;
  let othersGeneral = 0;
  let hasGeneral = false;
  for (const item of sorted) {
    if (item.amount / total >= 0.02 && item.name !== 'その他') {
      main.push({
        name: item.name,
        amount: item.amount,
        generalFunds: item.generalFunds,
        children: item.children,
      });
      if (item.generalFunds !== undefined) hasGeneral = true;
    } else {
      others += item.amount;
      othersGeneral += item.generalFunds ?? 0;
    }
  }
  if (others > 0) {
    main.push({ name: 'その他', amount: others, generalFunds: hasGeneral ? othersGeneral : undefined });
  }
  return main;
}

/** 帯（リボン）のパス。(x0,y0) から (x1,y1) へ高さhでつなぐ */
function ribbonPath(x0: number, y0: number, x1: number, y1: number, h: number): string {
  const c = (x0 + x1) / 2;
  return [
    `M${x0},${y0}`,
    `C${c},${y0} ${c},${y1} ${x1},${y1}`,
    `L${x1},${y1 + h}`,
    `C${c},${y1 + h} ${c},${y0 + h} ${x0},${y0 + h}`,
    'Z',
  ].join(' ');
}

interface Node {
  key: string;
  name: string;
  amount: number;
  /** 構成比（歳入側は歳入総額、歳出側は歳出総額に対する比） */
  share: number;
  color: string;
  x: number;
  y: number;
  h: number;
  label: 'left' | 'right' | 'halo' | 'none';
  /** 全国平均構成比の参照先（比較しない集約ノード等はundefined） */
  avg?: { table: AverageTable; name: string };
}

interface Ribbon {
  key: string;
  name: string;
  amount: number;
  color: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  h: number;
}

interface Layout {
  nodes: Node[];
  ribbons: Ribbon[];
  bottom: number;
  estimated: boolean;
}

function buildLayout(budget: LocalGovBudget): Layout {
  const revTotal = budget.totalRevenue;
  const expTotal = budget.totalExpenditure;
  const scale = PLOT_H / Math.max(revTotal, expTotal);
  const diff = revTotal - expTotal;

  const nodes: Node[] = [];
  const ribbons: Ribbon[] = [];

  // ---- 歳出側の一般財源充当額（実データ。なければ歳入構成比から推計） ----
  const expItems = prepareItems(budget.expenditures, expTotal);
  const revItemsRaw = prepareItems(budget.revenues, revTotal);
  const generalRevSum = revItemsRaw
    .filter((i) => GENERAL_SOURCES.has(i.name))
    .reduce((sum, i) => sum + i.amount, 0);
  const estimated = !expItems.some((i) => i.generalFunds !== undefined);
  const fallbackRatio = Math.min(1, generalRevSum / expTotal);
  const generalOf = (item: SankeyItem) =>
    Math.min(item.amount, item.generalFunds ?? item.amount * fallbackRatio);

  const G = expItems.reduce((sum, i) => sum + generalOf(i), 0);
  const S = expTotal - G;
  const B = Math.max(0, diff); // 歳入超過（歳計剰余等）

  // ---- 歳入項目 → 財源区分の割当（一般財源→特定財源等→収支差引の順に充当） ----
  const generals = revItemsRaw.filter((i) => GENERAL_SOURCES.has(i.name));
  const specifics = revItemsRaw.filter((i) => !GENERAL_SOURCES.has(i.name));
  const leftItems: Array<SankeyItem & { gray?: boolean }> = [...generals, ...specifics];
  if (diff < 0) {
    // 歳出超過分は灰色の帯で補い、両側の総量を揃える
    leftItems.push({ name: '収支差引（歳出超過）', amount: -diff, gray: true });
  }
  const remaining = new Map(leftItems.map((i) => [i.name, i.amount]));
  const alloc = new Map(leftItems.map((i) => [i.name, { toG: 0, toS: 0, toB: 0 }]));
  const fill = (order: Array<SankeyItem & { gray?: boolean }>, target: number, key: 'toG' | 'toS') => {
    let rest = target;
    for (const item of order) {
      if (rest <= 0) break;
      const take = Math.min(remaining.get(item.name)!, rest);
      if (take <= 0) continue;
      alloc.get(item.name)![key] += take;
      remaining.set(item.name, remaining.get(item.name)! - take);
      rest -= take;
    }
  };
  const grays = leftItems.filter((i) => i.gray);
  fill([...generals, ...specifics, ...grays], G, 'toG');
  fill([...specifics, ...generals, ...grays], S, 'toS');
  for (const item of leftItems) alloc.get(item.name)!.toB = remaining.get(item.name)!;

  // ---- 左列（歳入項目）と財源区分ノードの配置 ----
  const sections: Array<{ name: string; total: number; color: string; label: boolean }> = [
    { name: '一般財源', total: G, color: GENERAL_COLOR, label: true },
    { name: '特定財源等', total: S, color: SPECIFIC_COLOR, label: true },
  ];
  if (B > 0) sections.push({ name: '収支差引（歳入超過）', total: B, color: BALANCE_COLOR, label: false });

  // 財源区分ノードのy座標と、流入・流出オフセット
  const secY = new Map<string, { y: number; inOffset: number; outOffset: number }>();
  {
    let y = MARGIN_Y;
    for (const sec of sections) {
      if (sec.total <= 0) continue;
      secY.set(sec.name, { y, inOffset: 0, outOffset: 0 });
      nodes.push({
        key: `sec-${sec.name}`,
        name: sec.name,
        amount: sec.total,
        // 一般・特定は「歳出に占める割合」、収支差引は歳入比
        share: sec.color === BALANCE_COLOR ? sec.total / revTotal : sec.total / expTotal,
        color: sec.color,
        x: X_SOURCE,
        y,
        h: sec.total * scale,
        label: sec.label ? 'halo' : 'none',
      });
      y += sec.total * scale + GAP;
    }
  }

  let revY = MARGIN_Y;
  for (const item of leftItems) {
    const h = item.amount * scale;
    const color = item.gray
      ? BALANCE_COLOR
      : GENERAL_SOURCES.has(item.name)
        ? GENERAL_COLOR
        : SPECIFIC_COLOR;
    nodes.push({
      key: `rev-${item.name}`,
      name: item.name,
      amount: item.amount,
      share: item.amount / revTotal,
      color,
      x: X_REV,
      y: revY,
      h,
      label: 'left',
      ...(item.gray || item.name === 'その他'
        ? {}
        : { avg: { table: 'revenue' as const, name: item.name } }),
    });
    // 各区分への帯（一般→特定→収支差引の順に上から）
    let srcOffset = 0;
    const parts: Array<[string, number]> = [
      ['一般財源', alloc.get(item.name)!.toG],
      ['特定財源等', alloc.get(item.name)!.toS],
      ['収支差引（歳入超過）', alloc.get(item.name)!.toB],
    ];
    for (const [secName, amount] of parts) {
      if (amount <= 0) continue;
      const sec = secY.get(secName);
      if (!sec) continue;
      const ph = amount * scale;
      ribbons.push({
        key: `rev-${item.name}-${secName}`,
        name: `${item.name} → ${secName}`,
        amount,
        color: item.gray ? BALANCE_COLOR : (secName === '一般財源' ? GENERAL_COLOR : secName === '特定財源等' ? SPECIFIC_COLOR : BALANCE_COLOR),
        x0: X_REV + NODE_W,
        y0: revY + srcOffset,
        x1: X_SOURCE,
        y1: sec.y + sec.inOffset,
        h: ph,
      });
      sec.inOffset += ph;
      srcOffset += ph;
    }
    revY += h + GAP;
  }

  // ---- 財源区分 → 款 → 項 ----
  let expY = MARGIN_Y;
  let leafY = MARGIN_Y;
  for (const item of expItems) {
    const h = item.amount * scale;
    const g = generalOf(item);
    const s = item.amount - g;

    nodes.push({
      key: `exp-${item.name}`,
      name: item.name,
      amount: item.amount,
      share: item.amount / expTotal,
      color: EXP_COLOR,
      x: X_EXP,
      y: expY,
      h,
      label: 'halo',
      ...(item.name === 'その他'
        ? {}
        : { avg: { table: 'expenditure' as const, name: item.name } }),
    });
    // 一般財源・特定財源からの帯（款側は一般が上、特定が下）
    let inOffset = 0;
    for (const [secName, amount, color] of [
      ['一般財源', g, GENERAL_COLOR],
      ['特定財源等', s, SPECIFIC_COLOR],
    ] as Array<[string, number, string]>) {
      if (amount <= 0) continue;
      const sec = secY.get(secName);
      if (!sec) continue;
      ribbons.push({
        key: `fund-${item.name}-${secName}`,
        name: `${secName} → ${item.name}`,
        amount,
        color,
        x0: X_SOURCE + NODE_W,
        y0: sec.y + sec.outOffset,
        x1: X_EXP,
        y1: expY + inOffset,
        h: amount * scale,
      });
      sec.outOffset += amount * scale;
      inOffset += amount * scale;
    }

    // 項レベル: children を2%（歳出総額比）で足切りし、残りは「その他」
    const bigChildren = (item.children ?? [])
      .filter((c) => c.amount > 0 && c.amount / expTotal >= 0.02 && c.name !== 'その他')
      .sort((a, b) => b.amount - a.amount);
    const residual = item.amount - bigChildren.reduce((sum, c) => sum + c.amount, 0);
    const leaves: SankeyItem[] =
      bigChildren.length > 0
        ? [
            ...bigChildren.map((c) => ({ name: c.name, amount: c.amount })),
            ...(residual > 0 ? [{ name: 'その他', amount: residual }] : []),
          ]
        : [{ name: item.name, amount: item.amount }];

    let offset = 0;
    for (const leaf of leaves) {
      const leafH = leaf.amount * scale;
      // 項レベルの平均参照。内訳のない款の通し表示は款の平均、集約「その他」は比較しない
      const leafAvg =
        leaf.name === 'その他'
          ? undefined
          : bigChildren.length > 0
            ? { table: 'expenditureDetail' as const, name: `${item.name}/${leaf.name}` }
            : item.name !== 'その他'
              ? { table: 'expenditure' as const, name: item.name }
              : undefined;
      nodes.push({
        key: `leaf-${item.name}-${leaf.name}`,
        name: leaf.name,
        amount: leaf.amount,
        share: leaf.amount / expTotal,
        color: EXP_COLOR,
        x: X_LEAF,
        y: leafY,
        h: leafH,
        label: 'right',
        ...(leafAvg ? { avg: leafAvg } : {}),
      });
      ribbons.push({
        key: `leaf-${item.name}-${leaf.name}`,
        name: bigChildren.length > 0 ? `${item.name}／${leaf.name}` : leaf.name,
        amount: leaf.amount,
        color: EXP_COLOR,
        x0: X_EXP + NODE_W,
        y0: expY + offset,
        x1: X_LEAF,
        y1: leafY,
        h: leafH,
      });
      leafY += leafH + GAP;
      offset += leafH;
    }
    expY += h + GAP;
  }

  // 歳入超過分は財源区分から右端まで灰色の帯で通す
  if (B > 0) {
    const sec = secY.get('収支差引（歳入超過）')!;
    const h = B * scale;
    nodes.push({
      key: 'leaf-balance',
      name: '収支差引（歳入超過）',
      amount: B,
      share: B / revTotal,
      color: BALANCE_COLOR,
      x: X_LEAF,
      y: leafY,
      h,
      label: 'right',
    });
    ribbons.push({
      key: 'balance',
      name: '収支差引（歳入超過）',
      amount: B,
      color: BALANCE_COLOR,
      x0: X_SOURCE + NODE_W,
      y0: sec.y,
      x1: X_LEAF,
      y1: leafY,
      h,
    });
    leafY += h + GAP;
  }

  return { nodes, ribbons, bottom: Math.max(revY, expY, leafY), estimated };
}

/**
 * ラベルが重ならないよう中心位置をずらす。
 * ノード中心を希望位置とし、上から順に最小間隔を確保して下へ押し出す
 */
function nudgeLabels(centers: number[], minY: number): number[] {
  const placed = centers.map((c) => Math.max(c, minY));
  for (let i = 1; i < placed.length; i++) {
    if (placed[i] < placed[i - 1] + LABEL_BLOCK) placed[i] = placed[i - 1] + LABEL_BLOCK;
  }
  return placed;
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
  const avgShare = (n: Node): number | null => {
    if (!averages || !n.avg) return null;
    return averages[level][n.avg.table][String(budget.fiscalYear)]?.[n.avg.name] ?? null;
  };
  /**
   * 平均乖離のラベル表記（多い=赤/少ない=青）。
   * 全国平均の構成比をこの団体の総額に換算した額との差で示す
   */
  const diffLabel = (n: Node): { text: string; color: string } | null => {
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
  const subLine = (n: Node) => {
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
        <svg viewBox={`0 0 ${WIDTH} ${height}`} style={{ width: '100%', height: 'auto' }}>
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
  );
}
