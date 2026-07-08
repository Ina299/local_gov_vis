/**
 * 収支図の「全国平均との比較」用に、歳出（款・項）・歳入項目の
 * 全国平均を年度別・レベル別（都道府県/市区町村）に事前計算する。
 *   構成比: 各団体の構成比の単純平均（規模による重み付けなし）。
 *           項目を持たない団体は構成比0として分母に含める（希少な項での偏り防止）
 *   1人あたり額: 全団体の1人あたり額（円/人）の中央値。項目を持たない団体は0円として算入。
 *           加重平均は人口の多い団体（政令市移譲等のアーティファクト持ち）に支配され、
 *           単純平均は極小自治体に引きずられるため、団体分布の真ん中=中央値で比較する
 *
 * 入力: apps/web/public/budgets.json, apps/web/public/budgets/municipal/*.json
 * 出力: apps/web/public/budget-averages.json
 *   { pref|muni: { expenditure|revenue: { 年度: { 項目名: 構成比 } },
 *                  expenditureDetail: { 年度: { "款/項": 構成比 } },
 *                  perCapita: { expenditure|revenue|expenditureDetail: { 年度: { 項目名: 円/人の中央値 } } } } }
 *
 * 実行: npm run -w @local-gov/crawler build:averages
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { LocalGovBudget } from './types/budget.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC = join(__dirname, '..', '..', '..', 'apps', 'web', 'public');

interface Acc {
  /** 年度 → 項目名 → 構成比の合計 */
  sums: Map<number, Map<string, number>>;
  /** 年度 → 団体数（構成比0の団体も分母に含めるため全数を数える） */
  counts: Map<number, number>;
}

function newAcc(): Acc {
  return { sums: new Map(), counts: new Map() };
}

interface PcAcc {
  /** 年度 → 項目名 → 各団体の1人あたり額（円/人）の配列 */
  values: Map<number, Map<string, number[]>>;
  /** 年度 → 人口のある団体数（項目を持たない団体を0円として中央値に含めるため） */
  counts: Map<number, number>;
}

function newPcAcc(): PcAcc {
  return { values: new Map(), counts: new Map() };
}

function addPc(acc: PcAcc, year: number, name: string, perCapita: number): void {
  let itemMap = acc.values.get(year);
  if (!itemMap) {
    itemMap = new Map();
    acc.values.set(year, itemMap);
  }
  let list = itemMap.get(name);
  if (!list) {
    list = [];
    itemMap.set(name, list);
  }
  list.push(perCapita);
}

function add(acc: Acc, year: number, name: string, share: number): void {
  let itemMap = acc.sums.get(year);
  if (!itemMap) {
    itemMap = new Map();
    acc.sums.set(year, itemMap);
  }
  itemMap.set(name, (itemMap.get(name) ?? 0) + share);
}

interface AccSet {
  exp: Acc;
  rev: Acc;
  det: Acc;
  pc: PcAcc;
}

function accumulate(acc: AccSet, budgets: LocalGovBudget[]): void {
  for (const b of budgets) {
    // 歳出（款）と項レベル
    if (b.totalExpenditure > 0) {
      acc.exp.counts.set(b.fiscalYear, (acc.exp.counts.get(b.fiscalYear) ?? 0) + 1);
      acc.det.counts.set(b.fiscalYear, (acc.det.counts.get(b.fiscalYear) ?? 0) + 1);
      for (const item of b.expenditures) {
        add(acc.exp, b.fiscalYear, item.name, item.amount / b.totalExpenditure);
        for (const child of item.children ?? []) {
          add(acc.det, b.fiscalYear, `${item.name}/${child.name}`, child.amount / b.totalExpenditure);
        }
      }
    }
    // 歳入項目
    if (b.totalRevenue > 0) {
      acc.rev.counts.set(b.fiscalYear, (acc.rev.counts.get(b.fiscalYear) ?? 0) + 1);
      for (const item of b.revenues) {
        add(acc.rev, b.fiscalYear, item.name, item.amount / b.totalRevenue);
      }
    }
    // 1人あたり額（人口のある団体のみ。中央値算出用に団体ごとの値を集める）
    if (b.population && b.population > 0) {
      acc.pc.counts.set(b.fiscalYear, (acc.pc.counts.get(b.fiscalYear) ?? 0) + 1);
      for (const item of b.expenditures) {
        addPc(acc.pc, b.fiscalYear, `exp:${item.name}`, item.amount / b.population);
        for (const child of item.children ?? []) {
          addPc(acc.pc, b.fiscalYear, `det:${item.name}/${child.name}`, child.amount / b.population);
        }
      }
      for (const item of b.revenues) {
        addPc(acc.pc, b.fiscalYear, `rev:${item.name}`, item.amount / b.population);
      }
    }
  }
}

function toShares(acc: Acc): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [year, itemMap] of acc.sums) {
    const n = acc.counts.get(year) ?? 0;
    if (n === 0) continue;
    const shares: Record<string, number> = {};
    for (const [name, sum] of itemMap) {
      shares[name] = Number((sum / n).toFixed(5));
    }
    out[String(year)] = shares;
  }
  return out;
}

/**
 * 1人あたり額（円/人）の中央値テーブルへ変換。prefix（exp:/rev:/det:）で表を分ける。
 * 項目を持たない団体は0円として算入する（n団体分のうち不足分を0で埋める）
 */
function toPerCapita(acc: PcAcc, prefix: string): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [year, itemMap] of acc.values) {
    const n = acc.counts.get(year) ?? 0;
    if (n === 0) continue;
    const medians: Record<string, number> = {};
    for (const [name, list] of itemMap) {
      if (!name.startsWith(prefix)) continue;
      const sorted = [...list].sort((a, b) => a - b);
      const zeros = n - sorted.length; // 項目を持たない団体（先頭に0が並ぶ扱い）
      const at = (i: number) => (i < zeros ? 0 : sorted[i - zeros]);
      const median = n % 2 === 1 ? at((n - 1) / 2) : (at(n / 2 - 1) + at(n / 2)) / 2;
      medians[name.slice(prefix.length)] = Math.round(median);
    }
    out[String(year)] = medians;
  }
  return out;
}

function main() {
  const pref: AccSet = { exp: newAcc(), rev: newAcc(), det: newAcc(), pc: newPcAcc() };
  const muni: AccSet = { exp: newAcc(), rev: newAcc(), det: newAcc(), pc: newPcAcc() };

  accumulate(pref, JSON.parse(readFileSync(join(WEB_PUBLIC, 'budgets.json'), 'utf-8')));

  const muniDir = join(WEB_PUBLIC, 'budgets', 'municipal');
  for (const file of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f))) {
    accumulate(muni, JSON.parse(readFileSync(join(muniDir, file), 'utf-8')));
  }

  const tables = (acc: AccSet) => ({
    expenditure: toShares(acc.exp),
    revenue: toShares(acc.rev),
    expenditureDetail: toShares(acc.det),
    perCapita: {
      expenditure: toPerCapita(acc.pc, 'exp:'),
      revenue: toPerCapita(acc.pc, 'rev:'),
      expenditureDetail: toPerCapita(acc.pc, 'det:'),
    },
  });
  const out = { pref: tables(pref), muni: tables(muni) };
  const path = join(WEB_PUBLIC, 'budget-averages.json');
  writeFileSync(path, JSON.stringify(out));
  console.log(`書き込み: ${path}`);
}

main();
