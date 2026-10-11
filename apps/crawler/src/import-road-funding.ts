/**
 * 道路分の国費（配分）を自治体ごとに集計し、予算JSONに roadFunding フィールドとして付与する。
 *
 * 元データ: data/road-allocations/{年度}.json（import-road-allocations.ts。国交省 道路局の都道府県別 箇所表
 *   「社会資本整備総合交付金の配分（道路分）」別紙の、事業実施主体ごとの想定国費）。
 *   年度は配分年度（当初配分、4月公表）で、決算の年度とは段階が違う。決算データ（2020〜2024年度）より新しい
 *   2025・2026年度まであるので、年度によらず全年度分を同じ値として持たせ、地図では最新の配分年度を使う
 *   （metrics の yearIndependent）。
 *
 * 自治体の値 = その自治体が事業実施主体の工区の想定国費の合計。都道府県（2桁コード）は県が実施主体の分だけで、
 * 県内市町村の合算ではない（市町村の道路と県道は別の事業）。
 *
 * import:dashboard / import:municipal の後に実行する（既存JSONを上書き更新する）。
 * 実行: npm run -w @local-gov/crawler import:road-funding
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { LocalGovBudget, RoadFunding } from './types/budget.js';
import type { RoadAllocationFile } from './import-road-allocations.js';
import { scorePair, type AnomalyScore } from './road-allocation-score.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');
const DATA_DIR = join(REPO_ROOT, 'data', 'road-allocations');

/** コード → 年度 → 想定国費（円） */
function aggregate(): { byCode: Map<string, Record<string, number>>; years: number[]; source: string; anomaly: Map<string, AnomalyScore> } {
  const files = readdirSync(DATA_DIR).filter((f) => /^\d{4}\.json$/.test(f)).sort();
  if (!files.length) throw new Error(`道路配分データがありません: ${DATA_DIR}（先に import:road-allocations を実行）`);
  const byCode = new Map<string, Record<string, number>>();
  const years: number[] = [];
  let source = '';
  const loaded: RoadAllocationFile[] = [];
  for (const file of files) {
    const data: RoadAllocationFile = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf-8'));
    loaded.push(data);
    years.push(data.fiscalYear);
    source = data.source.name.replace(/令和\d+年度 /, '');
    for (const row of data.rows) {
      if (!row.code) continue; // 組合・公社など自治体コードを引けないもの
      const entry = byCode.get(row.code) ?? {};
      entry[String(data.fiscalYear)] = (entry[String(data.fiscalYear)] ?? 0) + row.amountYen;
      byCode.set(row.code, entry);
    }
  }
  // 最新の年度ペアの「説明の付きにくい減額」スコア
  const pair = scorePair(loaded[loaded.length - 2], loaded[loaded.length - 1]);
  const anomaly = new Map(pair.scores.map((s) => [s.code, s]));
  return { byCode, years, source, anomaly };
}

/** 予算JSONファイルに roadFunding を付与して書き戻す */
function patchFile(path: string, byCode: Map<string, Record<string, number>>, years: number[], source: string, anomaly: Map<string, AnomalyScore>): number {
  if (!existsSync(path)) {
    console.warn(`スキップ（未生成）: ${path}`);
    return 0;
  }
  const budgets: LocalGovBudget[] = JSON.parse(readFileSync(path, 'utf-8'));
  let patched = 0;
  for (const b of budgets) {
    const entry = byCode.get(b.code);
    if (!entry) {
      // 配分の記載が無い自治体は 0 ではなく「記載なし」。古い値が残らないよう消す
      delete b.roadFunding;
      continue;
    }
    // 記載の無い年度は 0 円（箇所表に載らない＝道路分の想定国費が無い）。全年度のうち 1 年でも記載があれば持たせる
    const byYear: Record<string, number> = {};
    for (const year of years) byYear[String(year)] = entry[String(year)] ?? 0;
    const a = anomaly.get(b.code);
    b.roadFunding = {
      byYear, latestYear: Math.max(...years), source,
      // 要確認度を作れない理由を残す（地図で「欠損」と「対象外」を分けるため）
      anomalyStatus: a ? (a.basis === 'all' ? 'scored-all-routes' : 'scored') : (byYear[String(Math.max(...years))] > 0 && byYear[String(Math.max(...years) - 1)] > 0 ? 'no-comparison' : 'single-year'),
      ...(a ? { anomaly: { score: Math.round(a.score * 100) / 100, rank: a.rank, residualPct: Math.round((Math.exp(a.logCont) - 1) * 100), expectedPct: Math.round((Math.exp(a.expected) - 1) * 100), routes: a.routes, decreased: a.decreased, basis: a.basis } } : {}),
    } satisfies RoadFunding;
    patched++;
  }
  writeFileSync(path, JSON.stringify(budgets));
  return patched;
}

function main() {
  const { byCode, years, source, anomaly } = aggregate();
  console.log(`道路分の想定国費: ${byCode.size} 自治体、年度 ${years.join('・')}、スコア対象 ${anomaly.size} 市区町村`);
  const muniDir = join(WEB_PUBLIC, 'budgets', 'municipal');
  for (const file of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f)).sort()) {
    const path = join(muniDir, file);
    console.log(`${file}: ${patchFile(path, byCode, years, source, anomaly)}件付与`);
  }
  for (const path of [join(WEB_PUBLIC, 'budgets.json'), join(REPO_ROOT, 'data', 'budgets', 'prefectures.json')]) {
    console.log(`${path}: ${patchFile(path, byCode, years, source, anomaly)}件付与`);
  }
}

main();
