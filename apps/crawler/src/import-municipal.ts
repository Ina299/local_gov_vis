/**
 * Japan Dashboard（デジタル庁）の市区町村財政CSVと、
 * smartnews-smri/japan-topography の市区町村境界GeoJSONから、
 * 都道府県別の遅延ロード用データを生成する。
 *
 * 出力:
 *   apps/web/public/budgets/municipal/{都道府県コード}.json  … 予算データ（全年度）
 *   apps/web/public/geo/municipal/{都道府県コード}.json      … 境界GeoJSON（政令市の区は市コードに解決）
 *
 * データソース:
 *   財政: https://www.digital.go.jp/resources/japandashboard/municipal-finance
 *         出典表記「Japan Dashboard 地方財政（市町村ごと）／デジタル庁・総務省」
 *   境界: 国土交通省 国土数値情報（行政区域） を smartnews-smri/japan-topography が1%簡略化したもの
 *
 * 実行: npm run -w @local-gov/crawler import:municipal
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import type { LocalGovBudget, BudgetItem, BudgetCategory, FiscalIndicator } from './types/budget.js';

const SOURCE_PAGE = 'https://www.digital.go.jp/resources/japandashboard/municipal-finance';
const ZIP_URL =
  'https://www.digital.go.jp/assets/contents/node/basic_page/field_ref_resources/be6dfce4-0c73-4296-b61f-eba37fc7284b/d40bb7e9/20260424_resources_municipal-finance.zip';
const GEO_URL_TEMPLATE =
  'https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/geojson/s0010/N03-21_{pref}_210101.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');

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

interface FlowRow {
  年度: string;
  都道府県コード: string;
  市区町村コード: string;
  市区町村名: string;
  分類: string;
  大項目: string;
  項目: string;
  値_千円: string;
}

interface MasterRow {
  年度: string;
  都道府県コード: string;
  都道府県名: string;
  市区町村コード: string;
  市区町村名: string;
  '人口数_人': string;
}

interface IndicatorRow {
  年度: string;
  市区町村コード: string;
  指標名: string;
  値: string;
  単位: string;
}

function parseAmountYen(value: string): number {
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n * 1000 : 0;
}

function buildItems(
  rows: FlowRow[],
  categoryOf: (daikomoku: string) => BudgetCategory
): BudgetItem[] {
  const groups = new Map<string, FlowRow[]>();
  for (const row of rows) {
    const list = groups.get(row['大項目']) ?? [];
    list.push(row);
    groups.set(row['大項目'], list);
  }

  const items: BudgetItem[] = [];
  for (const [name, groupRows] of groups) {
    const category = categoryOf(name);
    const amount = groupRows.reduce((sum, r) => sum + parseAmountYen(r['値_千円']), 0);
    const children = groupRows
      .filter((r) => r['項目'] !== '')
      .map((r) => ({
        name: r['項目'],
        amount: parseAmountYen(r['値_千円']),
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

function csvFromZip<T>(zip: AdmZip, entryName: string): T[] {
  const entry = zip.getEntry(entryName);
  if (!entry) throw new Error(`ZIPに ${entryName} が見つかりません`);
  const text = entry.getData().toString('utf-8').replace(/^﻿/, '');
  return parse(text, { columns: true, skip_empty_lines: true });
}

async function buildBudgets(): Promise<Map<string, LocalGovBudget[]>> {
  console.log(`財政データをダウンロード中: ${ZIP_URL}`);
  const res = await fetch(ZIP_URL);
  if (!res.ok) throw new Error(`ダウンロード失敗: HTTP ${res.status}`);
  const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
  const base = '20260424_resources_municipal-finance/';

  const master = csvFromZip<MasterRow>(zip, `${base}finance_data_table_master.csv`);
  const indicators = csvFromZip<IndicatorRow>(zip, `${base}finance_data_table_indicators.csv`);
  console.log('歳入・歳出CSVをパース中（47MB）...');
  const flow = csvFromZip<FlowRow>(zip, `${base}finance_local_finance_data_table_flow.csv`);
  console.log(`master: ${master.length}行 / indicators: ${indicators.length}行 / flow: ${flow.length}行`);

  const masterByKey = new Map<string, MasterRow>();
  for (const row of master) {
    masterByKey.set(`${row['年度']}:${row['市区町村コード']}`, row);
  }

  const indicatorsByKey = new Map<string, FiscalIndicator[]>();
  for (const row of indicators) {
    const value = Number(row['値']);
    if (!Number.isFinite(value)) continue;
    const key = `${row['年度']}:${row['市区町村コード']}`;
    const list = indicatorsByKey.get(key) ?? [];
    const unit = row['単位'];
    list.push({ name: row['指標名'], value, unit: unit === '-' || unit === "'-" ? '' : unit });
    indicatorsByKey.set(key, list);
  }

  const flowByKey = new Map<string, FlowRow[]>();
  for (const row of flow) {
    const key = `${row['年度']}:${row['市区町村コード']}`;
    const list = flowByKey.get(key) ?? [];
    list.push(row);
    flowByKey.set(key, list);
  }

  const crawledAt = new Date().toISOString();
  const byPref = new Map<string, LocalGovBudget[]>();

  for (const [key, rows] of flowByKey) {
    const [year, code] = key.split(':');
    const masterRow = masterByKey.get(key);
    const name = masterRow?.['市区町村名'] ?? rows[0]['市区町村名'];
    const prefCode = rows[0]['都道府県コード'];
    const population = masterRow ? Number(masterRow['人口数_人']) || undefined : undefined;

    const revenues = buildItems(rows.filter((r) => r['分類'] === '歳入'), () => 'other');
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

    const budget: LocalGovBudget = {
      code,
      name,
      prefecture: masterRow?.['都道府県名'] ?? '',
      fiscalYear: Number(year),
      budgetType: 'final',
      totalRevenue,
      totalExpenditure,
      expenditures,
      revenues,
      expendituresByNature,
      fiscalIndicators: indicatorsByKey.get(key),
      population,
      perCapitaExpenditure: population ? Math.round(totalExpenditure / population) : undefined,
      sourceUrl: SOURCE_PAGE,
      crawledAt,
    };

    const list = byPref.get(prefCode) ?? [];
    list.push(budget);
    byPref.set(prefCode, list);
  }

  for (const list of byPref.values()) {
    list.sort((a, b) => a.fiscalYear - b.fiscalYear || a.code.localeCompare(b.code));
  }
  return byPref;
}

interface N03Feature {
  type: 'Feature';
  properties: {
    N03_001: string; // 都道府県名
    N03_003: string | null; // 郡・政令市名
    N03_004: string | null; // 市区町村名
    N03_007: string | null; // 行政区域コード
  };
  geometry: unknown;
}

/** N03の行政区域コードを予算データの団体コードに解決する（政令市の区 → 市コード） */
function resolveCode(
  props: N03Feature['properties'],
  budgetCodes: Set<string>,
  nameToCode: Map<string, string>
): { code: string; name: string } | null {
  const rawCode = props.N03_007;
  if (!rawCode) return null; // 所属未定地など

  if (budgetCodes.has(rawCode)) {
    return { code: rawCode, name: props.N03_004 ?? '' };
  }
  // 政令市の区: N03_003 が市名（例: 札幌市）
  if (props.N03_003 && nameToCode.has(props.N03_003)) {
    return { code: nameToCode.get(props.N03_003)!, name: props.N03_003 };
  }
  return null;
}

async function buildGeo(prefCode: string, budgets: LocalGovBudget[]): Promise<object> {
  const url = GEO_URL_TEMPLATE.replace('{pref}', prefCode);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`境界データ取得失敗 (${prefCode}): HTTP ${res.status}`);
  const geo = (await res.json()) as { features: N03Feature[] };

  const budgetCodes = new Set(budgets.map((b) => b.code));
  const nameToCode = new Map(budgets.map((b) => [b.name, b.code]));

  const features = geo.features
    .map((feature) => {
      const resolved = resolveCode(feature.properties, budgetCodes, nameToCode);
      if (!resolved) return null;
      return {
        type: 'Feature',
        properties: resolved,
        geometry: feature.geometry,
      };
    })
    .filter(Boolean);

  return { type: 'FeatureCollection', features };
}

async function main() {
  const byPref = await buildBudgets();
  console.log(`予算データ: ${byPref.size}都道府県分`);

  const budgetsDir = join(WEB_PUBLIC, 'budgets', 'municipal');
  const geoDir = join(WEB_PUBLIC, 'geo', 'municipal');
  mkdirSync(budgetsDir, { recursive: true });
  mkdirSync(geoDir, { recursive: true });

  const prefCodes = Array.from(byPref.keys()).sort();
  for (const prefCode of prefCodes) {
    const budgets = byPref.get(prefCode)!;
    writeFileSync(join(budgetsDir, `${prefCode}.json`), JSON.stringify(budgets));

    const geo = await buildGeo(prefCode, budgets);
    writeFileSync(join(geoDir, `${prefCode}.json`), JSON.stringify(geo));

    const muniCount = new Set(budgets.map((b) => b.code)).size;
    console.log(`${prefCode}: ${muniCount}団体 / geo ${(geo as any).features.length}ポリゴン`);
    // GitHub raw への連続アクセスを抑える
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  console.log('完了');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
