/**
 * 全国市区町村ビュー用の軽量データを生成する。
 * import:municipal の出力（都道府県別JSON）を結合・圧縮するだけなので
 * ネットワークアクセスは不要。import:municipal の後に実行する。
 *
 * 出力:
 *   apps/web/public/budgets/municipal-all/{年度}.json … 地図の塗り分けに必要な項目のみ
 *     （総額・人口・4財政指標。内訳はドリルダウン時に都道府県別JSONから遅延ロード。
 *       初回ロードを軽くするため年度別に分割し、webは表示年度のぶんだけ取得する）
 *   data/geo/municipal-all.json                … 全都道府県の市区町村境界を結合
 *     （webへは build:topo がTopoJSONに変換して配置する）
 *
 * 実行: npm run -w @local-gov/crawler build:municipal-all
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { LocalGovBudget } from './types/budget.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');
const BUDGETS_DIR = join(WEB_PUBLIC, 'budgets', 'municipal');
const GEO_DIR = join(REPO_ROOT, 'data', 'geo', 'municipal');

/** 地図で使う財政指標のみ残す */
const MAP_INDICATORS = new Set([
  '財政力指数',
  '経常収支比率',
  '実質公債費比率',
  '将来負担比率',
]);

/** 地図指標に使う歳入項目のみ残す（他の内訳はドリルダウン時に遅延ロード） */
const MAP_REVENUES = new Set(['地方税', '地方交付税', '国庫支出金']);

/** 地図指標に使う歳出の款のみ残す */
const MAP_EXPENDITURES = new Set(['教育費', '民生費', '衛生費', '土木費', '農林水産業費']);

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
      // 全レコード同一のメタ情報（budgetType/sourceUrl/crawledAt）は省いてサイズを削る
      compact.push({
        code: b.code,
        name: b.name,
        prefecture: b.prefecture,
        fiscalYear: b.fiscalYear,
        totalRevenue: b.totalRevenue,
        totalExpenditure: b.totalExpenditure,
        expenditures: b.expenditures
          .filter((e) => MAP_EXPENDITURES.has(e.name))
          .map(({ name, amount, category }) => ({ name, amount, category })),
        revenues: b.revenues
          .filter((r) => MAP_REVENUES.has(r.name))
          .map(({ name, amount, category }) => ({ name, amount, category })),
        fiscalIndicators: b.fiscalIndicators?.filter((i) => MAP_INDICATORS.has(i.name)),
        population: b.population,
        demographics: b.demographics,
        employment: b.employment,
        infrastructure: b.infrastructure,
        safety: b.safety,
      });
    }

    const geo = JSON.parse(readFileSync(join(GEO_DIR, file), 'utf-8'));
    features.push(...geo.features);
  }

  // 年度別に分割して書き出す（古い年度ファイル・旧一枚岩ファイルは作り直す）
  const allDir = join(WEB_PUBLIC, 'budgets', 'municipal-all');
  rmSync(allDir, { recursive: true, force: true });
  mkdirSync(allDir, { recursive: true });
  const legacyPath = join(WEB_PUBLIC, 'budgets', 'municipal-all.json');
  if (existsSync(legacyPath)) rmSync(legacyPath);

  const byYear = new Map<number, LocalGovBudget[]>();
  for (const b of compact) {
    const list = byYear.get(b.fiscalYear) ?? [];
    list.push(b);
    byYear.set(b.fiscalYear, list);
  }
  for (const [year, list] of Array.from(byYear.entries()).sort((a, b) => a[0] - b[0])) {
    writeFileSync(join(allDir, `${year}.json`), JSON.stringify(list));
    console.log(`budgets: ${list.length}件 → municipal-all/${year}.json`);
  }

  const geoPath = join(REPO_ROOT, 'data', 'geo', 'municipal-all.json');
  writeFileSync(geoPath, JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`geo: ${features.length}ポリゴン → municipal-all.json`);
}

main();
