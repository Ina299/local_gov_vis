/**
 * 収支図の「全国平均との比較」用に、歳出（款・項）・歳入項目の構成比の
 * 全国平均を年度別・レベル別（都道府県/市区町村）に事前計算する。
 * 平均は各団体の構成比の単純平均（規模による重み付けなし）。
 * 項目を持たない団体は構成比0として分母に含める（希少な項での偏り防止）。
 *
 * 入力: apps/web/public/budgets.json, apps/web/public/budgets/municipal/*.json
 * 出力: apps/web/public/budget-averages.json
 *   { pref|muni: { expenditure|revenue: { 年度: { 項目名: 構成比 } },
 *                  expenditureDetail: { 年度: { "款/項": 構成比 } } } }
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

function add(acc: Acc, year: number, name: string, share: number): void {
  let itemMap = acc.sums.get(year);
  if (!itemMap) {
    itemMap = new Map();
    acc.sums.set(year, itemMap);
  }
  itemMap.set(name, (itemMap.get(name) ?? 0) + share);
}

function accumulate(
  acc: { exp: Acc; rev: Acc; det: Acc },
  budgets: LocalGovBudget[]
): void {
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

function main() {
  const pref = { exp: newAcc(), rev: newAcc(), det: newAcc() };
  const muni = { exp: newAcc(), rev: newAcc(), det: newAcc() };

  accumulate(pref, JSON.parse(readFileSync(join(WEB_PUBLIC, 'budgets.json'), 'utf-8')));

  const muniDir = join(WEB_PUBLIC, 'budgets', 'municipal');
  for (const file of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f))) {
    accumulate(muni, JSON.parse(readFileSync(join(muniDir, file), 'utf-8')));
  }

  const out = {
    pref: {
      expenditure: toShares(pref.exp),
      revenue: toShares(pref.rev),
      expenditureDetail: toShares(pref.det),
    },
    muni: {
      expenditure: toShares(muni.exp),
      revenue: toShares(muni.rev),
      expenditureDetail: toShares(muni.det),
    },
  };
  const path = join(WEB_PUBLIC, 'budget-averages.json');
  writeFileSync(path, JSON.stringify(out));
  console.log(`書き込み: ${path}`);
}

main();
