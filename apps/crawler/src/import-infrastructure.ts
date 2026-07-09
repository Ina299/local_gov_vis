/**
 * インフラを予算JSONに infrastructure フィールドとして付与する。
 *
 * データソース:
 * 1) 総務省「公共施設状況調経年比較表」https://www.soumu.go.jp/iken/shisetsu/index.html
 *    道路・公園・公営住宅・下水道。**年度別**で、調査は年度末時点のストックのため
 *    「予算年度Y ← 調査年度Y-1（＝年度Yの期首時点）」と1年ずらして対応させる。
 *    これで最新調査（令和5年度末）が2024年度に載り、全予算年度が埋まる。
 *    都道府県は自団体分＋県内市町村の計（下水道は市町村のみ）
 * 2) 内閣府「経済・財政と暮らしの指標『見える化』データベース」
 *    https://www5.cao.go.jp/keizai-shimon/kaigi/special/reform/mieruka/db_top/index.html
 *    水道管の経年化率（地方公営企業決算。水道事業体→市区町村の対応付け済み）と
 *    病院数・病床数（医療施設調査）。**年度別**の値としてfiscalYearごとに付与する。
 *    都道府県は病院・病床が県内市区町村の合算、経年化率は単純平均（参考値）
 *
 * import:dashboard / import:municipal の後に実行する（既存JSONを上書き更新する）。
 * 実行: npm run -w @local-gov/crawler import:infrastructure
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import type { LocalGovBudget, Infrastructure } from './types/budget.js';

const MUNI_URL = 'https://www.soumu.go.jp/main_content/001068878.xlsx';
const PREF_URL = 'https://www.soumu.go.jp/main_content/000641019.xlsx';
/**
 * 経年比較表から取り込む調査年度（予算年度-1に対応。最新年度公表時に追加）。
 * 予算2020〜2024年度 ← 調査2019〜2023年度
 */
const SOUMU_YEARS = ['2019', '2020', '2021', '2022', '2023'];

/** 見える化DBのダウンロードエンドポイントと項目コード（市区町村収録データ説明表より） */
const MIERUKA_URL = 'https://wwwb.cao.go.jp/ittaikaikaku/mDownload/download_multi.php';
const MIERUKA_ITEMS: Array<{
  code: string;
  field: 'waterPipeAgingRatio' | 'hospitals' | 'hospitalBeds';
}> = [
  { code: '010906', field: 'waterPipeAgingRatio' }, // 管路経年化率（水道事業・末端給水事業）
  { code: '020101', field: 'hospitals' }, // 病院数
  { code: '020104', field: 'hospitalBeds' }, // 病院の病床数
];
/** 見える化DBから付与する年度（予算データの年度に合わせる） */
const MIERUKA_YEARS = [2020, 2021, 2022, 2023, 2024];

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchBuffer(url: string): Promise<Buffer> {
  console.log(`ダウンロード中: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ダウンロード失敗: HTTP ${res.status} (${url})`);
  return Buffer.from(await res.arrayBuffer());
}

/** セル値を数値として読む（'-'などの文字列はnull） */
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/**
 * 市町村分の経年比較表を読み、年度別に 5桁コード → インフラ値 と
 * 都道府県ごとの市町村計（表内の「計」行。2桁コード → 値）を返す。
 * 列位置は表の固定レイアウト:
 *   5: 道路実延長(m) / 12: 公園計面積・都市計画区域内(m²) / 19: 同・区域外 /
 *   26: 公営住宅等合計(戸) / 44: 公共下水道 現在処理区域内人口
 */
function parseMuni(buf: Buffer): {
  muni: Map<string, Map<string, Infrastructure>>;
  prefSums: Map<string, Map<string, Infrastructure>>;
} {
  const wb = XLSX.read(buf);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['AFAHO14H1030'], { header: 1 });
  const muni = new Map<string, Map<string, Infrastructure>>(SOUMU_YEARS.map((y) => [y, new Map()]));
  const prefSums = new Map<string, Map<string, Infrastructure>>(
    SOUMU_YEARS.map((y) => [y, new Map()])
  );
  for (const row of rows) {
    const year = String(row[0]);
    if (!SOUMU_YEARS.includes(year)) continue;
    const rawCode = String(row[2] ?? '');
    if (!/^\d{6}$/.test(rawCode)) continue;
    const d: Infrastructure = {};
    const road = num(row[5]);
    if (road !== null) d.roadLengthM = road;
    const park = (num(row[12]) ?? 0) + (num(row[19]) ?? 0);
    if (num(row[12]) !== null || num(row[19]) !== null) d.parkAreaM2 = park;
    const housing = num(row[26]);
    if (housing !== null) d.publicHousingUnits = housing;
    // 公共下水道がない団体は'-'（＝処理人口0）なので0として扱う
    d.seweragePopulation = num(row[44]) ?? 0;
    if (String(row[4] ?? '').trim() === '計') {
      // 都道府県ごとの市町村計の行（団体コードは都道府県コード+検査数字）
      prefSums.get(year)!.set(rawCode.slice(0, 2), d);
    } else {
      muni.get(year)!.set(rawCode.slice(0, 5), d);
    }
  }
  return { muni, prefSums };
}

/**
 * 都道府県分の経年比較表を読み、年度別に 2桁コード → 県自身のインフラ値 を返す。
 * 列位置: 6: 都道府県道実延長計(m) / 15: 都市公園等計面積(m²) /
 * 16〜18: 公営住宅・改良住宅・単独住宅(戸)
 */
function parsePref(buf: Buffer): Map<string, Map<string, Infrastructure>> {
  const wb = XLSX.read(buf);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['AFAHO14H1020'], { header: 1 });
  const result = new Map<string, Map<string, Infrastructure>>(
    SOUMU_YEARS.map((y) => [y, new Map()])
  );
  for (const row of rows) {
    const year = String(row[0]);
    if (!SOUMU_YEARS.includes(year)) continue;
    const rawCode = String(row[1] ?? '');
    if (!/^\d{6}$/.test(rawCode)) continue;
    const code = rawCode.slice(0, 2);
    const d: Infrastructure = {};
    const road = num(row[6]);
    if (road !== null) d.roadLengthM = road;
    const park = num(row[15]);
    if (park !== null) d.parkAreaM2 = park;
    const housing = (num(row[16]) ?? 0) + (num(row[17]) ?? 0) + (num(row[18]) ?? 0);
    d.publicHousingUnits = housing;
    result.get(year)!.set(code, d);
  }
  return result;
}

/** 都道府県の値 = 県自身の分 + 県内市町村の計（下水道は市町村のみ） */
function buildPrefTotals(
  pref: Map<string, Infrastructure>,
  prefSums: Map<string, Infrastructure>,
  year: string
): Map<string, Infrastructure> {
  const result = new Map<string, Infrastructure>();
  for (const [code, own] of pref) {
    const sums = prefSums.get(code);
    if (!sums) throw new Error(`市町村計の行が見つかりません: ${year}年度 ${code}`);
    result.set(code, {
      roadLengthM: (own.roadLengthM ?? 0) + (sums.roadLengthM ?? 0),
      parkAreaM2: (own.parkAreaM2 ?? 0) + (sums.parkAreaM2 ?? 0),
      publicHousingUnits: (own.publicHousingUnits ?? 0) + (sums.publicHousingUnits ?? 0),
      seweragePopulation: sums.seweragePopulation ?? 0,
    });
  }
  return result;
}

/** 見える化DBの1項目のCSVを取得し、5桁コード → 年 → 値 を返す */
async function fetchMieruka(code: string): Promise<Map<string, Map<number, number>>> {
  console.log(`ダウンロード中: 見える化DB 項目${code}`);
  const body = new URLSearchParams({
    queryType: 'download',
    koumokuCode: code,
    shubetsu: 'c',
    downloadType: 'csv',
    zipDirName: 'tmp',
  });
  for (const key of ['areaArr[]', 'prefArr[]', 'tokuchouArr[]']) body.append(key, '-1');
  const res = await fetch(MIERUKA_URL, { method: 'POST', body });
  if (!res.ok) throw new Error(`ダウンロード失敗: HTTP ${res.status} (見える化DB ${code})`);
  const text = (await res.text()).replace(/^﻿/, '');
  const rows: string[][] = parse(text, { relax_column_count: true });

  // 10行目が年ヘッダー（[,,1975,1976,…]）、以降が[コード, 団体名, 値…]の行
  const yearRow = rows[9] ?? [];
  if (!yearRow.some((c) => /^\d{4}$/.test(String(c)))) {
    throw new Error(`見える化DB ${code}: 年ヘッダーが見つかりません`);
  }
  const result = new Map<string, Map<number, number>>();
  for (const row of rows.slice(10)) {
    if (!/^\d{1,5}$/.test(String(row[0] ?? ''))) continue;
    const muniCode = String(row[0]).padStart(5, '0');
    const values = new Map<number, number>();
    for (let c = 2; c < yearRow.length; c++) {
      const year = Number(yearRow[c]);
      const v = Number(row[c]);
      // 「-」（データなし）や空欄は付与しない
      if (!MIERUKA_YEARS.includes(year) || row[c] === '' || row[c] === undefined) continue;
      if (!Number.isFinite(v)) continue;
      values.set(year, v);
    }
    result.set(muniCode, values);
  }
  return result;
}

/** 見える化DBの3項目から 年 → コード → 年度別フィールド を組み立てる（都道府県は合算・平均） */
function buildYearly(
  tables: Array<[keyof Infrastructure, Map<string, Map<number, number>>]>
): Map<number, Map<string, Partial<Infrastructure>>> {
  const byYear = new Map<number, Map<string, Partial<Infrastructure>>>(
    MIERUKA_YEARS.map((y) => [y, new Map()])
  );
  for (const [field, table] of tables) {
    for (const year of MIERUKA_YEARS) {
      const agg = byYear.get(year)!;
      // 都道府県集計: 病院・病床は合算、経年化率は単純平均（参考値）
      const prefSum = new Map<string, { sum: number; n: number }>();
      for (const [code, values] of table) {
        const v = values.get(year);
        if (v === undefined) continue;
        const d = agg.get(code) ?? {};
        (d as Record<string, number>)[field] = v;
        agg.set(code, d);
        const pref = code.slice(0, 2);
        const p = prefSum.get(pref) ?? { sum: 0, n: 0 };
        p.sum += v;
        p.n += 1;
        prefSum.set(pref, p);
      }
      for (const [pref, { sum, n }] of prefSum) {
        if (n === 0) continue;
        const d = agg.get(pref) ?? {};
        (d as Record<string, number>)[field] =
          field === 'waterPipeAgingRatio' ? sum / n : sum;
        agg.set(pref, d);
      }
    }
  }
  return byYear;
}

/** 予算JSONファイルに年度別infrastructureを付与して書き戻す */
function patchFile(
  path: string,
  soumuByYear: Map<string, Map<string, Infrastructure>>,
  mierukaByYear: Map<number, Map<string, Partial<Infrastructure>>>
): number {
  if (!existsSync(path)) {
    console.warn(`スキップ（未生成）: ${path}`);
    return 0;
  }
  const budgets: LocalGovBudget[] = JSON.parse(readFileSync(path, 'utf-8'));
  let patched = 0;
  for (const b of budgets) {
    // 公共施設状況調は年度末時点のストックなので、前年度の調査＝年度期首の値を対応させる
    const d = soumuByYear.get(String(b.fiscalYear - 1))?.get(b.code);
    const y = mierukaByYear.get(b.fiscalYear)?.get(b.code);
    if (d || y) {
      b.infrastructure = { ...d, ...y };
      patched++;
    } else {
      delete b.infrastructure;
    }
  }
  writeFileSync(path, JSON.stringify(budgets));
  return patched;
}

async function main() {
  const [muniBuf, prefBuf] = await Promise.all([fetchBuffer(MUNI_URL), fetchBuffer(PREF_URL)]);
  const { muni, prefSums } = parseMuni(muniBuf);
  const prefOwn = parsePref(prefBuf);
  const soumuByYear = new Map<string, Map<string, Infrastructure>>();
  for (const year of SOUMU_YEARS) {
    const muniYear = muni.get(year)!;
    const pref = buildPrefTotals(prefOwn.get(year)!, prefSums.get(year)!, year);
    console.log(`公共施設状況調 ${year}年度: 市町村${muniYear.size}団体 / 都道府県${pref.size}団体`);
    if (muniYear.size < 1500 || pref.size !== 47) {
      throw new Error('取得件数が想定と異なります（表のレイアウト変更の可能性）');
    }
    soumuByYear.set(year, new Map([...muniYear, ...pref]));
  }

  const mierukaTables: Array<[keyof Infrastructure, Map<string, Map<number, number>>]> = [];
  for (const item of MIERUKA_ITEMS) {
    const table = await fetchMieruka(item.code);
    if (table.size < 1500) throw new Error(`見える化DB ${item.code}: 件数不足 ${table.size}`);
    mierukaTables.push([item.field, table]);
    await sleep(1000);
  }
  const mierukaByYear = buildYearly(mierukaTables);
  for (const year of MIERUKA_YEARS) {
    console.log(`見える化DB ${year}年: ${mierukaByYear.get(year)!.size}団体`);
  }

  for (const path of [
    join(WEB_PUBLIC, 'budgets.json'),
    join(REPO_ROOT, 'data', 'budgets', 'prefectures.json'),
  ]) {
    console.log(`${path}: ${patchFile(path, soumuByYear, mierukaByYear)}件付与`);
  }
  const muniDir = join(WEB_PUBLIC, 'budgets', 'municipal');
  let muniPatched = 0;
  for (const file of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f))) {
    muniPatched += patchFile(join(muniDir, file), soumuByYear, mierukaByYear);
  }
  console.log(`市区町村: ${muniPatched}件付与`);
  console.log('完了（build:municipal-all の再実行が必要です）');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
