/**
 * 全国市区町村ビュー用の軽量データを生成する。
 * import:municipal の出力（都道府県別JSON）を結合・圧縮するだけなので
 * ネットワークアクセスは不要。import:municipal の後に実行する。
 *
 * 出力:
 *   apps/web/public/budgets/municipal-all.json … 地図の塗り分けに必要な項目のみ
 *     （総額・人口・4財政指標。内訳はドリルダウン時に都道府県別JSONから遅延ロード）
 *   apps/web/public/geo/municipal-all.json     … 全都道府県の市区町村境界を結合
 *
 * 実行: npm run -w @local-gov/crawler build:municipal-all
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { LocalGovBudget } from './types/budget.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC = join(__dirname, '..', '..', '..', 'apps', 'web', 'public');
const BUDGETS_DIR = join(WEB_PUBLIC, 'budgets', 'municipal');
const GEO_DIR = join(WEB_PUBLIC, 'geo', 'municipal');

/** 地図で使う財政指標のみ残す */
const MAP_INDICATORS = new Set([
  '財政力指数',
  '経常収支比率',
  '実質公債費比率',
  '将来負担比率',
]);

function main() {
  const prefFiles = readdirSync(BUDGETS_DIR)
    .filter((f) => /^\d{2}\.json$/.test(f))
    .sort();

  const compact: LocalGovBudget[] = [];
  const features: unknown[] = [];

  for (const file of prefFiles) {
    const budgets: LocalGovBudget[] = JSON.parse(
      readFileSync(join(BUDGETS_DIR, file), 'utf-8')
    );
    for (const b of budgets) {
      compact.push({
        code: b.code,
        name: b.name,
        prefecture: b.prefecture,
        fiscalYear: b.fiscalYear,
        budgetType: b.budgetType,
        totalRevenue: b.totalRevenue,
        totalExpenditure: b.totalExpenditure,
        expenditures: [],
        revenues: [],
        fiscalIndicators: b.fiscalIndicators?.filter((i) => MAP_INDICATORS.has(i.name)),
        population: b.population,
        demographics: b.demographics,
        sourceUrl: b.sourceUrl,
        crawledAt: b.crawledAt,
      });
    }

    const geo = JSON.parse(readFileSync(join(GEO_DIR, file), 'utf-8'));
    features.push(...geo.features);
  }

  const budgetsPath = join(WEB_PUBLIC, 'budgets', 'municipal-all.json');
  const geoPath = join(WEB_PUBLIC, 'geo', 'municipal-all.json');
  writeFileSync(budgetsPath, JSON.stringify(compact));
  writeFileSync(geoPath, JSON.stringify({ type: 'FeatureCollection', features }));

  console.log(`budgets: ${compact.length}件 → municipal-all.json`);
  console.log(`geo: ${features.length}ポリゴン → municipal-all.json`);
}

main();
