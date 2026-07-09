/**
 * Japan Dashboard（デジタル庁）の地方財政CSVから予算データを生成する。
 *
 * データソース: https://www.digital.go.jp/resources/japandashboard/prefectural-finance
 * 出典: Japan Dashboard 地方財政（都道府県ごと）／デジタル庁・総務省
 * 元データは総務省「地方財政状況調査」（決算）。金額はCSV上は千円単位、円に変換して保存する。
 *
 * 実行: npm run -w @local-gov/crawler import:dashboard
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import type { LocalGovBudget, BudgetItem, BudgetCategory, FiscalIndicator } from './types/budget.js';
import { PREFECTURE_POPULATIONS } from './data/populations.js';

const SOURCE_PAGE = 'https://www.digital.go.jp/resources/japandashboard/prefectural-finance';
const ZIP_URL =
  'https://www.digital.go.jp/assets/contents/node/basic_page/field_ref_resources/3a0aed62-9b75-414d-a33b-d6c65b3c7b30/bc10d2b5/20260526_resourcesprefectural-finance.zip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');

/** 目的別歳出の大項目 → カテゴリ */
const PURPOSE_CATEGORIES: Record<string, BudgetCategory> = {
  総務費: 'general_affairs',
  民生費: 'welfare',
  衛生費: 'health',
  労働費: 'labor',
  農林水産業費: 'agriculture',
  商工費: 'commerce',
  土木費: 'civil_engineering',
  消防費: 'fire_police',
  警察費: 'police',
  教育費: 'education',
  公債費: 'public_debt',
  議会費: 'assembly',
};

interface FinanceRow {
  年度: string;
  都道府県コード: string;
  都道府県名: string;
  分類: string;
  大項目: string;
  項目: string;
  '値【千円】': string;
}

interface IndicatorRow {
  年度: string;
  都道府県コード: string;
  都道府県名: string;
  指標名: string;
  値: string;
  単位: string;
}

/** ZIP内のCSVをヘッダー内容で識別してパースする（ファイル名はcp932で文字化けするため使わない） */
function extractCsvTables(zip: AdmZip): { finance: FinanceRow[]; indicators: IndicatorRow[] } {
  let finance: FinanceRow[] = [];
  let indicators: IndicatorRow[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !entry.entryName.toLowerCase().endsWith('.csv')) continue;
    // 先頭のBOMを除去（CSVはUTF-8 BOM付き）
    const text = entry.getData().toString('utf-8').replace(/^﻿/, '');
    const headerLine = text.slice(0, text.indexOf('\n'));

    if (headerLine.includes('分類') && headerLine.includes('大項目')) {
      const rows: FinanceRow[] = parse(text, { columns: true, skip_empty_lines: true });
      // 積立金・地方債のCSVも同じヘッダーを持つため、分類の値で財政CSVを識別する
      if (rows.some((r) => r['分類'] === '歳入')) {
        finance = rows;
      }
    } else if (headerLine.includes('指標名') && headerLine.includes('都道府県コード')) {
      indicators = parse(text, { columns: true, skip_empty_lines: true });
    }
  }

  if (finance.length === 0) throw new Error('歳入・歳出CSVがZIP内に見つかりません');
  return { finance, indicators };
}

/** 千円単位の値文字列 → 円 */
function parseAmountYen(value: string): number {
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n * 1000 : 0;
}

/** 大項目ごとに集計してBudgetItemツリーを作る */
function buildItems(
  rows: FinanceRow[],
  categoryOf: (daikomoku: string) => BudgetCategory
): BudgetItem[] {
  const groups = new Map<string, FinanceRow[]>();
  for (const row of rows) {
    const list = groups.get(row['大項目']) ?? [];
    list.push(row);
    groups.set(row['大項目'], list);
  }

  const items: BudgetItem[] = [];
  for (const [name, groupRows] of groups) {
    const category = categoryOf(name);
    const amount = groupRows.reduce((sum, r) => sum + parseAmountYen(r['値【千円】']), 0);
    const children = groupRows
      .filter((r) => r['項目'] !== '')
      .map((r) => ({
        name: r['項目'],
        amount: parseAmountYen(r['値【千円】']),
        category,
      }));
    items.push({
      name,
      amount,
      category,
      ...(children.length > 1 ? { children } : {}),
    });
  }
  return items;
}

async function main() {
  console.log(`ダウンロード中: ${ZIP_URL}`);
  const res = await fetch(ZIP_URL);
  if (!res.ok) throw new Error(`ダウンロード失敗: HTTP ${res.status}`);
  const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));

  const { finance, indicators } = extractCsvTables(zip);
  console.log(`歳入・歳出: ${finance.length}行 / 財政指標: ${indicators.length}行`);

  // (年度, 都道府県) ごとにグループ化
  const byYearPref = new Map<string, FinanceRow[]>();
  for (const row of finance) {
    const key = `${row['年度']}:${row['都道府県コード']}`;
    const list = byYearPref.get(key) ?? [];
    list.push(row);
    byYearPref.set(key, list);
  }

  const indicatorsByYearPref = new Map<string, FiscalIndicator[]>();
  for (const row of indicators) {
    const value = Number(row['値']);
    if (!Number.isFinite(value)) continue;
    const key = `${row['年度']}:${row['都道府県コード']}`;
    const list = indicatorsByYearPref.get(key) ?? [];
    list.push({ name: row['指標名'], value, unit: row['単位'] === "'-" ? '' : row['単位'] });
    indicatorsByYearPref.set(key, list);
  }

  const crawledAt = new Date().toISOString();
  const budgets: LocalGovBudget[] = [];

  for (const [key, rows] of byYearPref) {
    const [year, code] = key.split(':');
    const name = rows[0]['都道府県名'];

    const revenues = buildItems(
      rows.filter((r) => r['分類'] === '歳入'),
      () => 'other'
    );
    const expenditures = buildItems(
      rows.filter((r) => r['分類'] === '歳出 (目的)'),
      (d) => PURPOSE_CATEGORIES[d] ?? 'other'
    );
    const expendituresByNature = buildItems(
      rows.filter((r) => r['分類'] === '歳出 (性質)'),
      () => 'other'
    );

    const totalRevenue = revenues.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenditure = expenditures.reduce((sum, item) => sum + item.amount, 0);
    const population = PREFECTURE_POPULATIONS[code];

    budgets.push({
      code,
      name,
      prefecture: name,
      fiscalYear: Number(year),
      budgetType: 'final',
      totalRevenue,
      totalExpenditure,
      expenditures,
      revenues,
      expendituresByNature,
      fiscalIndicators: indicatorsByYearPref.get(key),
      population,
      perCapitaExpenditure: population ? Math.round(totalExpenditure / population) : undefined,
      sourceUrl: SOURCE_PAGE,
      crawledAt,
    });
  }

  budgets.sort((a, b) => a.fiscalYear - b.fiscalYear || a.code.localeCompare(b.code));

  const years = [...new Set(budgets.map((b) => b.fiscalYear))];
  console.log(`生成: ${budgets.length}件（${years.join(', ')}年度 × ${budgets.length / years.length}団体）`);

  const json = JSON.stringify(budgets, null, 2);
  const outputs = [
    join(REPO_ROOT, 'data', 'budgets', 'prefectures.json'),
    join(REPO_ROOT, 'apps', 'web', 'public', 'budgets.json'),
  ];
  for (const out of outputs) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, json);
    console.log(`書き込み: ${out}`);
  }

  console.warn(
    '\n⚠️  警告: 都道府県データを一から再生成しました。\n' +
      '   人口統計・目的別財源・就労・インフラ・安全・犯罪の付与フィールドはすべてリセットされています。\n' +
      '   `npm run -w @local-gov/crawler update:all` を実行してパイプライン全体を再適用してください。\n'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
