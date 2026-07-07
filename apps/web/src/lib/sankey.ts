/**
 * 収支図（サンキー図）のレイアウト計算。
 * 歳入内訳 → 財源区分（一般・特定） → 歳出（款） → 歳出（項）の
 * ノード・リボン座標を組み立てる。描画はSankeyModalが担当
 */
import type { LocalGovBudget, BudgetItem } from '@/types/budget';

export const WIDTH = 1180;
export const PLOT_H = 500;
export const MARGIN_Y = 28;
export const LABEL_W_LEFT = 210;
export const LABEL_W_RIGHT = 240;
export const NODE_W = 14;
export const GAP = 6; // 項目ノード間の隙間
export const LABEL_BLOCK = 26; // 2行ラベルの占有高さ

// 列のx座標: 歳入項目 → 財源区分 → 歳出（款） → 歳出（項）
export const X_REV = LABEL_W_LEFT;
export const X_SOURCE = 430;
export const X_EXP = 700;
export const X_LEAF = WIDTH - LABEL_W_RIGHT - NODE_W;

export const GENERAL_COLOR = '#2a78d6'; // 一般財源
export const SPECIFIC_COLOR = '#7fb3ee'; // 特定財源等
export const EXP_COLOR = '#e06a4b';
export const BALANCE_COLOR = '#898781';

/** 使途が特定されない一般財源に分類する歳入項目 */
export const GENERAL_SOURCES = new Set([
  '地方税',
  '地方交付税',
  '地方譲与税',
  '地方特例交付金等',
]);

/** 全国平均構成比（build-averages.tsが生成）の表の種類 */
export type AverageTable = 'expenditure' | 'revenue' | 'expenditureDetail';

export interface SankeyItem {
  name: string;
  amount: number;
  generalFunds?: number;
  children?: BudgetItem[];
}

/** 構成比2%未満の項目は「その他」にまとめる（ラベルが潰れるため） */
export function prepareItems(items: BudgetItem[], total: number): SankeyItem[] {
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
export function ribbonPath(x0: number, y0: number, x1: number, y1: number, h: number): string {
  const c = (x0 + x1) / 2;
  return [
    `M${x0},${y0}`,
    `C${c},${y0} ${c},${y1} ${x1},${y1}`,
    `L${x1},${y1 + h}`,
    `C${c},${y1 + h} ${c},${y0 + h} ${x0},${y0 + h}`,
    'Z',
  ].join(' ');
}

export interface SankeyNode {
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

export interface SankeyRibbon {
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

export interface SankeyLayout {
  nodes: SankeyNode[];
  ribbons: SankeyRibbon[];
  bottom: number;
  /** 財源充当が実データでなく歳入構成比からの推計かどうか */
  estimated: boolean;
}

export function buildLayout(budget: LocalGovBudget): SankeyLayout {
  const revTotal = budget.totalRevenue;
  const expTotal = budget.totalExpenditure;
  const scale = PLOT_H / Math.max(revTotal, expTotal);
  const diff = revTotal - expTotal;

  const nodes: SankeyNode[] = [];
  const ribbons: SankeyRibbon[] = [];

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
  const fill = (
    order: Array<SankeyItem & { gray?: boolean }>,
    target: number,
    key: 'toG' | 'toS'
  ) => {
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
        color: item.gray
          ? BALANCE_COLOR
          : secName === '一般財源'
            ? GENERAL_COLOR
            : secName === '特定財源等'
              ? SPECIFIC_COLOR
              : BALANCE_COLOR,
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
export function nudgeLabels(centers: number[], minY: number): number[] {
  const placed = centers.map((c) => Math.max(c, minY));
  for (let i = 1; i < placed.length; i++) {
    if (placed[i] < placed[i - 1] + LABEL_BLOCK) placed[i] = placed[i - 1] + LABEL_BLOCK;
  }
  return placed;
}
