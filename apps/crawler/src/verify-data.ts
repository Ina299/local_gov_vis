/**
 * 生成済みデータにenrichmentフィールド（人口統計・財源・就労・インフラ・安全・犯罪）が
 * 付与されているかを検証する。欠落していれば日本語メッセージを出して exit 1 で失敗する。
 *
 * ベースのインポーター（import-dashboard / import-municipal）はJSONを一から再生成して
 * enrichmentを消すため、update:all で全ステップを流し直したあと、この検証で取りこぼしを検出する。
 *
 * 実行: npm run -w @local-gov/crawler verify:data
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { LocalGovBudget } from './types/budget.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');
const MUNI_DIR = join(WEB_PUBLIC, 'budgets', 'municipal');

/** 市区町村の各フィールドで許容する最小の付与率（一括ワイプなら0%になり必ず検出できる） */
const MUNI_MIN_RATIO = 0.9;
/** 都道府県（47団体）で最新年度に付与を要求する最小件数 */
const PREF_MIN_COUNT = 45;

interface Result {
  category: string;
  check: string;
  detail: string;
  ok: boolean;
}

const results: Result[] = [];

function record(category: string, check: string, ok: boolean, detail: string): void {
  results.push({ category, check, ok, detail });
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function latestYearRecords(budgets: LocalGovBudget[]): LocalGovBudget[] {
  const latest = Math.max(...budgets.map((b) => b.fiscalYear));
  return budgets.filter((b) => b.fiscalYear === latest);
}

const hasGeneralFunds = (b: LocalGovBudget): boolean =>
  b.expenditures.some((e) => e.generalFunds != null);

// ---- 1. 都道府県 budgets.json ----
function verifyPrefectures(): void {
  const path = join(WEB_PUBLIC, 'budgets.json');
  if (!existsSync(path)) {
    record('都道府県', 'budgets.json 存在', false, 'ファイルがありません');
    return;
  }
  let budgets: LocalGovBudget[];
  try {
    budgets = readJson<LocalGovBudget[]>(path);
  } catch (e) {
    record('都道府県', 'budgets.json パース', false, String(e));
    return;
  }
  const latest = latestYearRecords(budgets);
  const year = latest[0]?.fiscalYear;
  record('都道府県', 'budgets.json パース', true, `${budgets.length}件 / 最新年度${year} ${latest.length}団体`);

  const checks: Array<[string, (b: LocalGovBudget) => boolean]> = [
    ['人口統計 (demographics)', (b) => b.demographics?.elderlyRatio != null],
    ['就労 (employment.avgIncome)', (b) => b.employment?.avgIncome != null],
    ['財源 (generalFunds)', hasGeneralFunds],
    ['交通事故 (safety.accidents)', (b) => b.safety?.accidents != null],
    ['犯罪 (safety.penalCodeOffenses)', (b) => b.safety?.penalCodeOffenses != null],
    ['インフラ (infrastructure)', (b) => b.infrastructure != null],
  ];
  for (const [label, pred] of checks) {
    const n = latest.filter(pred).length;
    record('都道府県', label, n >= PREF_MIN_COUNT, `${n}/${latest.length}団体（下限${PREF_MIN_COUNT}）`);
  }
}

// ---- 2. 都道府県別 市区町村ファイル ----
function verifyMunicipalFiles(): void {
  if (!existsSync(MUNI_DIR)) {
    record('市区町村', 'municipal/ ディレクトリ', false, 'ディレクトリがありません');
    return;
  }
  const files = readdirSync(MUNI_DIR)
    .filter((f) => /^\d{2}\.json$/.test(f))
    .sort();
  record('市区町村', '都道府県別ファイル数', files.length === 47, `${files.length}/47ファイル`);
  if (files.length === 0) return;

  let total = 0;
  let demo = 0;
  let emp = 0;
  let infra = 0;
  let safety = 0;
  const badFiles: string[] = [];

  for (const file of files) {
    let budgets: LocalGovBudget[];
    try {
      budgets = readJson<LocalGovBudget[]>(join(MUNI_DIR, file));
    } catch {
      badFiles.push(file);
      continue;
    }
    for (const b of latestYearRecords(budgets)) {
      total++;
      if (b.demographics != null) demo++;
      if (b.employment != null) emp++;
      if (b.infrastructure != null) infra++;
      if (b.safety != null) safety++;
    }
  }

  if (badFiles.length > 0) {
    record('市区町村', 'ファイルのパース', false, `パース失敗: ${badFiles.join(', ')}`);
  }
  if (total === 0) {
    record('市区町村', '最新年度レコード', false, '最新年度の市区町村レコードが0件');
    return;
  }

  const ratioChecks: Array<[string, number]> = [
    ['人口統計 (demographics)', demo],
    ['就労 (employment)', emp],
    ['インフラ (infrastructure)', infra],
    ['交通事故 (safety)', safety],
  ];
  for (const [label, n] of ratioChecks) {
    const ratio = n / total;
    record(
      '市区町村',
      label,
      ratio >= MUNI_MIN_RATIO,
      `${n}/${total}団体 ${(ratio * 100).toFixed(1)}%（下限${MUNI_MIN_RATIO * 100}%）`
    );
  }
}

// ---- 3. municipal-all/{年度}.json（年度別分割） ----
function verifyMunicipalAll(): void {
  const dir = join(WEB_PUBLIC, 'budgets', 'municipal-all');
  if (!existsSync(dir)) {
    record('全国結合', 'municipal-all/ 存在', false, 'ディレクトリがありません');
    return;
  }
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort();
  if (files.length === 0) {
    record('全国結合', '年度別ファイル数', false, '年度別ファイルがありません');
    return;
  }
  let budgets: LocalGovBudget[] = [];
  const badFiles: string[] = [];
  for (const file of files) {
    try {
      budgets = budgets.concat(readJson<LocalGovBudget[]>(join(dir, file)));
    } catch {
      badFiles.push(file);
    }
  }
  if (badFiles.length > 0) {
    record('全国結合', 'ファイルのパース', false, `パース失敗: ${badFiles.join(', ')}`);
    return;
  }
  const latest = latestYearRecords(budgets);
  record(
    '全国結合',
    '年度別ファイルのパース',
    true,
    `${files.length}年度 ${budgets.length}件 / 最新年度 ${latest.length}団体`
  );
  if (latest.length === 0) return;

  const demo = latest.filter((b) => b.demographics != null).length;
  const emp = latest.filter((b) => b.employment != null).length;
  for (const [label, n] of [
    ['人口統計 (demographics)', demo],
    ['就労 (employment)', emp],
  ] as Array<[string, number]>) {
    const ratio = n / latest.length;
    record(
      '全国結合',
      label,
      ratio >= MUNI_MIN_RATIO,
      `${n}/${latest.length}団体 ${(ratio * 100).toFixed(1)}%（下限${MUNI_MIN_RATIO * 100}%）`
    );
  }
}

// ---- 4. budget-averages.json ----
function verifyAverages(): void {
  const path = join(WEB_PUBLIC, 'budget-averages.json');
  if (!existsSync(path)) {
    record('全国平均', 'budget-averages.json 存在', false, 'ファイルがありません');
    return;
  }
  try {
    const avg = readJson<{ pref?: unknown; muni?: unknown }>(path);
    const ok = avg.pref != null && avg.muni != null;
    record('全国平均', 'budget-averages.json パース', ok, ok ? 'pref / muni あり' : 'pref または muni がありません');
  } catch (e) {
    record('全国平均', 'budget-averages.json パース', false, String(e));
  }
}

function printSummary(): void {
  const pad = (s: string, n: number): string => {
    // 全角文字を2幅として概算しつつ最低限そろえる
    const width = [...s].reduce((w, c) => w + (c.charCodeAt(0) > 0xff ? 2 : 1), 0);
    return s + ' '.repeat(Math.max(0, n - width));
  };
  console.log('\nデータ検証サマリー');
  console.log('─'.repeat(78));
  console.log(`${pad('区分', 12)}${pad('項目', 40)}結果  詳細`);
  console.log('─'.repeat(78));
  for (const r of results) {
    console.log(`${pad(r.category, 12)}${pad(r.check, 40)}${r.ok ? ' OK ' : 'NG! '}  ${r.detail}`);
  }
  console.log('─'.repeat(78));
}

function main(): void {
  verifyPrefectures();
  verifyMunicipalFiles();
  verifyMunicipalAll();
  verifyAverages();
  printSummary();

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(
      `\n✗ 検証失敗: ${failed.length}件の問題があります。\n` +
        '   enrichmentデータが欠落している可能性があります。\n' +
        '   `npm run -w @local-gov/crawler update:all` を実行してパイプライン全体を再適用してください。'
    );
    process.exit(1);
  }
  console.log(`\n✓ 検証成功: ${results.length}項目すべて問題ありません。`);
}

main();
