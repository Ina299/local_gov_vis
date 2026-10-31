/**
 * 事業コストの流れ（収録できた事業の決算額または予算額 → 部局 → 事業）の集計とレイアウト。
 * 評価の事業別金額は決算書の款・項・目と結びつかないため、収支図とは独立した図にする。
 * 合計は「収録できた事業の決算額（予算額）」であり、歳出総額ではない。決算額と予算額は別の図として切り替える（混ぜない）。
 */
import type { ProjectEvaluation } from '@/types/evaluation';

/** 図にする金額の区分。決算額を正とし、予算額は計画として別に見る */
export type FlowKind = 'actual' | 'budget';
export const FLOW_KIND_LABEL: Record<FlowKind, string> = { actual: '決算額', budget: '予算額' };

export interface FlowProject { key: string; name: string; department: string; group: string; amount: number; records: number }
export interface CostFlowYear {
  kind: FlowKind;
  fiscalYear: number;
  projects: FlowProject[];
  total: number;
  /** 同じ事業の再掲で金額が食い違い、集計から外した事業数 */
  conflicting: number;
  /** 1 つの記録に同じ年度・同じ区分の金額が複数あり、どれか決められず外した記録数 */
  ambiguous: number;
}

const norm = (v: string) => v.normalize('NFKC').replace(/\s+/g, '');

/** 所管名の最上位の単位（局・部・委員会など）。区切りのない名称はそのまま、所管なしは「所管不明」 */
export function departmentGroup(department: string | null): string {
  const d = department?.normalize('NFKC').trim();
  if (!d) return '所管不明';
  // 「・」は局名の一部（例: 脱炭素・GREEN×EXPO推進局）なので区切りにしない
  const first = d.split(/[\s　/／]+/).filter(Boolean)[0] ?? d;
  const m = first.match(/^(.+?(?:局|部|委員会))(?=.)/);
  return m ? m[1] : first;
}

/** 決算額（actual）または予算額（budget）が年度ごとに 1 つに決まる事業だけを、事業名＋所管で重複なく集計する */
export function costFlowYears(projects: ProjectEvaluation[], minimumProjects = 5, kind: FlowKind = 'actual'): CostFlowYear[] {
  const byYear = new Map<number, Map<string, { name: string; department: string; amounts: Set<number>; records: number }>>();
  const ambiguous = new Map<number, number>();
  for (const p of projects) {
    const perYear = new Map<number, Set<number>>();
    for (const a of p.amounts) {
      if (a.kind !== kind || a.fiscalYear === null || a.amountYen === null || a.amountYen <= 0) continue;
      perYear.set(a.fiscalYear, (perYear.get(a.fiscalYear) ?? new Set()).add(a.amountYen));
    }
    for (const [year, values] of Array.from(perYear)) {
      if (values.size > 1) { ambiguous.set(year, (ambiguous.get(year) ?? 0) + 1); continue; }
      const department = p.department?.trim() || '';
      const key = `${norm(p.projectName)}\u0000${norm(department)}`;
      const year_ = byYear.get(year) ?? new Map();
      const entry = year_.get(key) ?? { name: p.projectName, department, amounts: new Set<number>(), records: 0 };
      entry.amounts.add(Array.from(values)[0]); entry.records += 1;
      year_.set(key, entry); byYear.set(year, year_);
    }
  }
  const years: CostFlowYear[] = [];
  for (const [fiscalYear, entries] of Array.from(byYear)) {
    const flow: FlowProject[] = []; let conflicting = 0;
    for (const [key, e] of Array.from(entries)) {
      if (e.amounts.size > 1) { conflicting++; continue; }
      flow.push({ key, name: e.name, department: e.department || '所管不明', group: departmentGroup(e.department || null), amount: Array.from(e.amounts)[0], records: e.records });
    }
    if (flow.length < minimumProjects) continue;
    flow.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'ja'));
    years.push({ kind, fiscalYear, projects: flow, total: flow.reduce((s, p) => s + p.amount, 0), conflicting, ambiguous: ambiguous.get(fiscalYear) ?? 0 });
  }
  return years.sort((a, b) => b.fiscalYear - a.fiscalYear);
}

/** 図を出せる区分（決算額を優先）。どちらもなければ null */
export function defaultFlowKind(projects: ProjectEvaluation[]): FlowKind | null {
  if (costFlowYears(projects, 5, 'actual').length) return 'actual';
  return costFlowYears(projects, 5, 'budget').length ? 'budget' : null;
}

/** 事業数が最も多い年度（同数なら新しい年度） */
export function defaultFlowYear(years: CostFlowYear[]): number | null {
  if (!years.length) return null;
  return [...years].sort((a, b) => b.projects.length - a.projects.length || b.fiscalYear - a.fiscalYear)[0].fiscalYear;
}

export interface FlowNode { key: string; label: string; amount: number; count: number; column: 0 | 1 | 2; y: number; h: number; projectName?: string; department?: string }
export interface FlowRibbon { key: string; from: string; to: string; amount: number; y0: number; y1: number; h: number }
export interface FlowLayout { nodes: FlowNode[]; ribbons: FlowRibbon[]; height: number }

/** budgetX: 左端の「歳出総額（決算）」の棒。そこから収録できた事業（x[0]）へ拡大表示の扇でつなぐ */
export const FLOW = { width: 960, top: 16, plot: 440, gap: 4, nodeW: 12, budgetX: 24, x: [210, 480, 710] as const };

/** 歳出総額のうち収録できた事業の割合。比べられない（未収録・収録額が上回る）ときは null */
export function budgetContext(recordedTotal: number, totalExpenditure: number | undefined): { total: number; ratio: number } | null {
  if (!totalExpenditure || totalExpenditure <= 0 || recordedTotal > totalExpenditure) return null;
  return { total: totalExpenditure, ratio: recordedTotal / totalExpenditure };
}

/** 上位の部局・事業だけを個別に出し、残りは「その他」にまとめた 3 列のサンキー配置 */
export function costFlowLayout(year: CostFlowYear, maxGroups = 10, maxProjects = 15): FlowLayout {
  const groupTotals = new Map<string, { amount: number; count: number }>();
  for (const p of year.projects) {
    const g = groupTotals.get(p.group) ?? { amount: 0, count: 0 };
    g.amount += p.amount; g.count++; groupTotals.set(p.group, g);
  }
  const rankedGroups = Array.from(groupTotals).sort((a, b) => b[1].amount - a[1].amount || a[0].localeCompare(b[0], 'ja'));
  const shownGroups = new Set(rankedGroups.slice(0, maxGroups).map(([g]) => g));
  const groupOf = (p: FlowProject) => shownGroups.has(p.group) ? p.group : 'その他の部局';
  const shownProjects = new Set(year.projects.slice(0, maxProjects).map(p => p.key));

  // 右列: 上位事業（個別）＋ 部局ごとの「その他の事業」
  const right = new Map<string, FlowNode>(); const links = new Map<string, number>();
  for (const p of year.projects) {
    const g = groupOf(p);
    const key = shownProjects.has(p.key) ? `p:${p.key}` : `rest:${g}`;
    const node = right.get(key) ?? { key, label: shownProjects.has(p.key) ? p.name : `${g}のその他の事業`, amount: 0, count: 0, column: 2 as const, y: 0, h: 0,
      ...(shownProjects.has(p.key) ? { projectName: p.name, department: p.department } : {}) };
    node.amount += p.amount; node.count++; right.set(key, node);
    links.set(`${g}\u0000${key}`, (links.get(`${g}\u0000${key}`) ?? 0) + p.amount);
  }
  const middle = new Map<string, FlowNode>();
  for (const p of year.projects) {
    const g = groupOf(p);
    const node = middle.get(g) ?? { key: `g:${g}`, label: g, amount: 0, count: 0, column: 1 as const, y: 0, h: 0 };
    node.amount += p.amount; node.count++; middle.set(g, node);
  }
  const mids = Array.from(middle.values()).sort((a, b) => (a.label === 'その他の部局' ? 1 : 0) - (b.label === 'その他の部局' ? 1 : 0) || b.amount - a.amount);
  // 右列は部局の並びに沿って、部局内では金額順（「その他の事業」は各部局の末尾）
  const order = new Map(mids.map((m, i) => [m.label, i]));
  const rights = Array.from(right.values()).sort((a, b) => {
    const ga = a.key.startsWith('rest:') ? a.key.slice(5) : groupOf(year.projects.find(p => `p:${p.key}` === a.key)!);
    const gb = b.key.startsWith('rest:') ? b.key.slice(5) : groupOf(year.projects.find(p => `p:${p.key}` === b.key)!);
    return (order.get(ga)! - order.get(gb)!) || (a.key.startsWith('rest:') ? 1 : 0) - (b.key.startsWith('rest:') ? 1 : 0) || b.amount - a.amount;
  });
  // One scale for every column, so a ribbon has the same thickness at both ends.
  const unit = (FLOW.plot - FLOW.gap * Math.max(0, Math.max(mids.length, rights.length) - 1)) / year.total;
  const place = (column: FlowNode[]) => {
    let y = FLOW.top;
    for (const n of column) { n.h = n.amount * unit; n.y = y; y += n.h + FLOW.gap; }
    return y - FLOW.gap;
  };
  const root: FlowNode = { key: 'root', label: `収録できた事業の${FLOW_KIND_LABEL[year.kind]}`, amount: year.total, count: year.projects.length, column: 0, y: FLOW.top, h: year.total * unit };
  const bottom = Math.max(place(mids), place(rights), root.y + root.h);
  const ribbons: FlowRibbon[] = [];
  let ry = root.y;
  for (const m of mids) { ribbons.push({ key: `root>${m.key}`, from: 'root', to: m.key, amount: m.amount, y0: ry, y1: m.y, h: m.h }); ry += m.h; }
  const outY = new Map(mids.map(m => [m.label, m.y])); const inY = new Map(rights.map(r => [r.key, r.y]));
  for (const r of rights) for (const m of mids) {
    const amount = links.get(`${m.label} ${r.key}`); if (!amount) continue;
    const h = amount * unit;
    ribbons.push({ key: `${m.key}>${r.key}`, from: m.key, to: r.key, amount, y0: outY.get(m.label)!, y1: inY.get(r.key)!, h });
    outY.set(m.label, outY.get(m.label)! + h); inY.set(r.key, inY.get(r.key)! + h);
  }
  return { nodes: [root, ...mids, ...rights], ribbons, height: bottom + FLOW.top };
}
