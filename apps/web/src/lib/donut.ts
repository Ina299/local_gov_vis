/**
 * 収支サマリーの二重ドーナツ（内側: 大分類、外側: 項目＝項レベル）のデータ整形。
 * 色は業種色（industry.ts）と同様に項目名→固定色で、どの団体・年度でも
 * 同じ項目は同じ色になる。外側の項は親の色の濃淡で表す。
 * パレットはdatavizバリデータ検証済み（白背景・隣接CVD分離はフロア帯のため
 * セグメント間の白い区切り線と凡例・内訳リストを併用する）
 */
import type { BudgetItem } from '@/types/budget';
import { prepareItems, type AverageTable } from './sankey';

/** 歳出（款）の固定色 */
export const EXPENDITURE_COLORS: Record<string, string> = {
  民生費: '#2a78d6',
  総務費: '#eda100',
  教育費: '#1baf7a',
  土木費: '#eb6834',
  衛生費: '#008300',
  公債費: '#4a3aa7',
  農林水産業費: '#b1651f',
  消防費: '#0c87ab',
  商工費: '#e87ba4',
  警察費: '#e34948',
  労働費: '#8f9a1b',
  議会費: '#8a6ddf',
  その他: '#b0aea6',
};

/** 歳入項目の固定色 */
export const REVENUE_COLORS: Record<string, string> = {
  地方税: '#2a78d6',
  地方交付税: '#1baf7a',
  国庫支出金: '#eda100',
  都道府県支出金: '#eb6834',
  地方債: '#4a3aa7',
  繰入金: '#e87ba4',
  地方譲与税: '#008300',
  地方特例交付金等: '#e34948',
  その他: '#b0aea6',
};

const FALLBACK_COLOR = '#8f8d86';

/** ドーナツの1セグメント（12時起点・時計回り、角度ラジアン）のパス。中心(60,60) */
export function donutSegmentPath(a0: number, a1: number, r0: number, r1: number): string {
  const cx = 60;
  const cy = 60;
  const pt = (r: number, a: number) => `${cx + r * Math.sin(a)},${cy - r * Math.cos(a)}`;
  const largeArc = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M${pt(r1, a0)}`,
    `A${r1},${r1} 0 ${largeArc} 1 ${pt(r1, a1)}`,
    `L${pt(r0, a1)}`,
    `A${r0},${r0} 0 ${largeArc} 0 ${pt(r0, a0)}`,
    'Z',
  ].join(' ');
}

/** 親の色を白に向けてt(0〜1)だけ混ぜる（外側リングの濃淡） */
export function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * t);
  const [r, g, b] = [n >> 16, (n >> 8) & 0xff, n & 0xff].map(mix);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** 同一親内で隣り合う項が同じ濃さにならないよう循環させる係数 */
const CHILD_SHADES = [0.12, 0.4, 0.24, 0.52];
/** 項レベルの「その他」（2%未満の集約）の濃さ */
const CHILD_REST_SHADE = 0.64;

export interface DonutSegment {
  name: string;
  /** 外側リングの親項目名（ツールチップ用。内側リングはundefined） */
  parent?: string;
  amount: number;
  /** 総額に対する構成比（0〜1） */
  share: number;
  color: string;
  /** 12時起点・時計回りの角度（ラジアン） */
  a0: number;
  a1: number;
  /** 全国中央値（budget-averages.json）の参照先。集約「その他」等はundefined */
  avg?: { table: AverageTable; name: string };
}

export interface DonutData {
  inner: DonutSegment[];
  outer: DonutSegment[];
}

/**
 * 内側（大分類）と外側（項目）のセグメントを組み立てる。
 * 大分類は構成比2%未満を「その他」に畳み（sankeyのprepareItemsと同じ基準）、
 * 項も総額比2%未満を親内の「その他」に畳む。内訳のない大分類は
 * 外側にも同じ区間を通し表示する。
 * avgTableは全国中央値の参照表（歳出: expenditure＋項はexpenditureDetail、
 * 歳入: revenue。歳入の内訳（税目）には中央値表がないため参照を付けない）
 */
export function buildDonutData(
  items: BudgetItem[],
  total: number,
  colors: Record<string, string>,
  avgTable?: 'expenditure' | 'revenue'
): DonutData {
  const prepared = prepareItems(items, total);
  const shownTotal = prepared.reduce((sum, i) => sum + i.amount, 0);
  if (shownTotal <= 0) return { inner: [], outer: [] };

  const inner: DonutSegment[] = [];
  const outer: DonutSegment[] = [];
  let angle = 0;
  for (const item of prepared) {
    const color = colors[item.name] ?? FALLBACK_COLOR;
    const a0 = angle;
    // 全周1セグメント（100%）のときにパスが消えないよう僅かに切る（IndustryDonutと同様）
    const a1 = Math.min(angle + (item.amount / shownTotal) * 2 * Math.PI, a0 + 2 * Math.PI - 1e-4);
    const itemAvg =
      avgTable && item.name !== 'その他' ? { table: avgTable, name: item.name } : undefined;
    inner.push({
      name: item.name,
      amount: item.amount,
      share: item.amount / total,
      color,
      a0,
      a1,
      ...(itemAvg ? { avg: itemAvg } : {}),
    });

    // 項レベル: 総額比2%以上を残し、残余は親内の「その他」
    const bigChildren = (item.children ?? [])
      .filter((c) => c.amount > 0 && c.amount / total >= 0.02 && c.name !== 'その他')
      .sort((a, b) => b.amount - a.amount);
    const residual = item.amount - bigChildren.reduce((sum, c) => sum + c.amount, 0);
    const leaves =
      bigChildren.length > 0
        ? [
            ...bigChildren.map((c, i) => ({
              name: c.name,
              amount: c.amount,
              color: lighten(color, CHILD_SHADES[i % CHILD_SHADES.length]),
              // 項レベルの中央値表があるのは歳出のみ（sankeyと同じ「款/項」キー）
              avg:
                avgTable === 'expenditure'
                  ? { table: 'expenditureDetail' as const, name: `${item.name}/${c.name}` }
                  : undefined,
            })),
            ...(residual > 0
              ? [{ name: 'その他', amount: residual, color: lighten(color, CHILD_REST_SHADE), avg: undefined }]
              : []),
          ]
        : [{ name: item.name, amount: item.amount, color: lighten(color, 0.12), avg: itemAvg }];

    let childAngle = a0;
    for (const leaf of leaves) {
      const c0 = childAngle;
      const c1 = Math.min(childAngle + (leaf.amount / shownTotal) * 2 * Math.PI, c0 + 2 * Math.PI - 1e-4);
      outer.push({
        name: leaf.name,
        parent: leaf.name === item.name ? undefined : item.name,
        amount: leaf.amount,
        share: leaf.amount / total,
        color: leaf.color,
        a0: c0,
        a1: c1,
        ...(leaf.avg ? { avg: leaf.avg } : {}),
      });
      childAngle = c1;
    }
    angle = a1;
  }
  return { inner, outer };
}
