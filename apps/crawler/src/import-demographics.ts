/**
 * 人口統計（人口密度・高齢化比率・外国人比率・出生・増減の元データ）を
 * 予算データのある全年度分（2020〜2024年度）取得し、生成済みの予算JSONに
 * 年度別の demographics フィールドとして付与する。
 * あわせて、静的値になっていた都道府県の人口を市区町村マスタ人口の
 * 県別合算で年度別の値に置き換える。
 *
 * データソース:
 *   人口・出生: 総務省「住民基本台帳に基づく人口、人口動態及び世帯数」（毎年公表）
 *     年度Yには「Y+1年1月1日時点」の版を対応させる（動態はY年中の値）。
 *     各年版の4表（表番号はNN-XX、NNは西暦下2桁）:
 *     - NN-04 【総計】市区町村別年齢階級別人口
 *     - NN-12 【外国人住民】市区町村別年齢階級別人口
 *     - NN-03 【総計】市区町村別人口、人口動態及び世帯数（前年中の出生者数・増減数）
 *     - NN-11 【外国人住民】市区町村別人口、人口動態及び世帯数
 *   面積: 国土地理院「全国都道府県市区町村別面積調」（年度によらず最新時点）
 *
 * import:dashboard / import:municipal の後に実行する（既存JSONを上書き更新する）。
 * 実行: npm run -w @local-gov/crawler import:demographics
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { get } from 'https';
import { constants as cryptoConstants } from 'crypto';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import type { LocalGovBudget, Demographics } from './types/budget.js';

/** e-Stat 住基4表のstatInfId。キーは対応する予算年度（値はその翌年1月1日時点の版） */
const JUKI_TABLES: Record<
  number,
  { total: string; foreign: string; totalDynamics: string; foreignDynamics: string }
> = {
  2020: {
    // 令和3年1月1日（21-04 / 21-12 / 21-03 / 21-11）
    total: '000040306661',
    foreign: '000040306694',
    totalDynamics: '000040306659',
    foreignDynamics: '000040306693',
  },
  2021: {
    total: '000032224637',
    foreign: '000032224645',
    totalDynamics: '000032224636',
    foreignDynamics: '000032224644',
  },
  2022: {
    total: '000040306648',
    foreign: '000040306650',
    totalDynamics: '000040306647',
    foreignDynamics: '000040306673',
  },
  2023: {
    total: '000040306674',
    foreign: '000040306682',
    totalDynamics: '000040306672',
    foreignDynamics: '000040306681',
  },
  2024: {
    // 令和7年1月1日（25-04 / 25-12 / 25-03 / 25-11）
    total: '000040306654',
    foreign: '000040306690',
    totalDynamics: '000040306653',
    foreignDynamics: '000040306688',
  },
};

// fileKind=0 はExcel
const estatUrl = (statInfId: string) =>
  `https://www.e-stat.go.jp/stat-search/file-download?statInfId=${statInfId}&fileKind=0`;
// 国土地理院 面積調（令和6年1月以降の時点別面積を含むCSV, Shift_JIS）
const MENCHO_URL = 'https://www.gsi.go.jp/KOKUJYOHO/MENCHO/backnumber/R8_04_mencho.csv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');

// 年齢21階級（0〜4歳…100歳以上）の列位置。0-3列目はコード等、4列目が総数
const ELDERLY_START = 18; // 65歳〜69歳
const AGE_COL_END = 25; // 100歳以上

interface AgePopulation {
  total: number;
  elderly: number | null; // 秘匿(X)を含む場合はnull
}

async function fetchBuffer(url: string): Promise<Buffer> {
  console.log(`ダウンロード中: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ダウンロード失敗: HTTP ${res.status} (${url})`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * 国土地理院のサーバーはTLSのレガシー再ネゴシエーションを要求し
 * fetch(undici)では接続できないため、httpsモジュールで許可して取得する
 */
function fetchBufferLegacyTls(url: string): Promise<Buffer> {
  console.log(`ダウンロード中: ${url}`);
  return new Promise((resolve, reject) => {
    get(
      url,
      { secureOptions: cryptoConstants.SSL_OP_LEGACY_SERVER_CONNECT },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`ダウンロード失敗: HTTP ${res.statusCode} (${url})`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }
    ).on('error', reject);
  });
}

/**
 * 住基の年齢階級別人口Excelを読み、コード → 年齢集計を返す。
 * キーは市区町村: 5桁コード / 都道府県: 2桁コード
 */
function parseJuki(buf: Buffer): Map<string, AgePopulation> {
  const wb = XLSX.read(buf);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
  });
  const result = new Map<string, AgePopulation>();

  const sumRange = (row: unknown[], from: number, to: number): number | null => {
    let sum = 0;
    for (let i = from; i <= to; i++) {
      const v = row[i];
      if (typeof v !== 'number') return null; // 'X'（秘匿）など
      sum += v;
    }
    return sum;
  };

  for (const row of rows) {
    const rawCode = String(row[0] ?? '');
    const gender = row[3];
    if (!/^\d{6}$/.test(rawCode) || gender !== '計') continue;
    const total = row[4];
    if (typeof total !== 'number') continue;

    // 団体コードは6桁（検査数字付き）。市区町村名'-'の行は都道府県計
    const isPref = row[2] === '-';
    const code = isPref ? rawCode.slice(0, 2) : rawCode.slice(0, 5);
    result.set(code, {
      total,
      elderly: sumRange(row, ELDERLY_START, AGE_COL_END),
    });
  }
  return result;
}

interface Dynamics {
  births: number | null; // 秘匿(X)はnull
  change: number | null; // 増減数(Ａ)-(Ｂ)
}

/**
 * 住基の人口動態Excel（市区町村別人口、人口動態及び世帯数）から
 * コード → 出生者数・増減数（令和6年中）を返す
 */
function parseDynamics(buf: Buffer): Map<string, Dynamics> {
  const wb = XLSX.read(buf);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
  });
  const labelRow = rows.find((r) => r.includes('出生者数'));
  if (!labelRow) throw new Error('動態表に出生者数列が見つかりません');
  const birthCol = labelRow.indexOf('出生者数');
  const changeCol = labelRow.indexOf('増減数(Ａ)-(Ｂ)');
  if (changeCol < 0) throw new Error('動態表に増減数列が見つかりません');

  const result = new Map<string, Dynamics>();
  for (const row of rows) {
    const rawCode = String(row[0] ?? '');
    if (!/^\d{6}$/.test(rawCode)) continue;
    const isPref = row[2] === '-';
    const code = isPref ? rawCode.slice(0, 2) : rawCode.slice(0, 5);
    const births = row[birthCol];
    const change = row[changeCol];
    result.set(code, {
      births: typeof births === 'number' ? births : null,
      change: typeof change === 'number' ? change : null,
    });
  }
  return result;
}

/** 面積調CSVを読み、コード → 面積(km²) を返す。最新時点の値を採用 */
function parseMencho(buf: Buffer): Map<string, number> {
  const text = new TextDecoder('shift_jis').decode(buf);
  const rows: string[][] = parse(text, { relax_column_count: true, skip_empty_lines: true });
  const headerIdx = rows.findIndex((r) => r[0] === '標準地域コード');
  if (headerIdx < 0) throw new Error('面積調CSVのヘッダーが見つかりません');
  const header = rows[headerIdx];
  // 面積列（"…(k㎡)"）は新しい時点から順に並ぶ
  const areaCols = header
    .map((name, i) => ({ name, i }))
    .filter(({ name }) => name.includes('(k㎡)'))
    .map(({ i }) => i);

  const result = new Map<string, number>();
  for (const row of rows.slice(headerIdx + 1)) {
    const rawCode = (row[0] ?? '').trim();
    if (!/^\d{4,5}$/.test(rawCode)) continue; // 全国・市部計などを除外
    const code5 = rawCode.padStart(5, '0');
    const code = code5.endsWith('000') ? code5.slice(0, 2) : code5;
    for (const i of areaCols) {
      const v = Number((row[i] ?? '').replace(/,/g, ''));
      if (Number.isFinite(v) && v > 0) {
        result.set(code, v);
        break;
      }
    }
  }
  return result;
}

function buildDemographics(
  total: Map<string, AgePopulation>,
  foreign: Map<string, AgePopulation>,
  totalDynamics: Map<string, Dynamics>,
  foreignDynamics: Map<string, Dynamics>,
  area: Map<string, number>
): Map<string, Demographics> {
  const round = (v: number) => Math.round(v * 10000) / 10000;
  const result = new Map<string, Demographics>();
  for (const [code, t] of total) {
    const f = foreign.get(code);
    const d: Demographics = {};
    const areaKm2 = area.get(code);
    if (areaKm2) d.areaKm2 = areaKm2;
    if (t.total > 0 && t.elderly !== null) d.elderlyRatio = round(t.elderly / t.total);
    if (t.total > 0 && f) d.foreignRatio = round(f.total / t.total);
    const tb = totalDynamics.get(code)?.births ?? null;
    const fb = foreignDynamics.get(code)?.births ?? null;
    const change = totalDynamics.get(code)?.change ?? null;
    if (tb !== null) d.births = tb;
    if (change !== null) d.populationChange = change;
    if (tb !== null && tb > 0 && fb !== null) {
      d.foreignBirthRatio = round(fb / tb);
    }
    if (Object.keys(d).length > 0) result.set(code, d);
  }
  return result;
}

/**
 * 市区町村予算JSON（地方財政状況調査マスタの年度別人口を持つ）から
 * 「都道府県コード:年度」→ 人口合算 を作る
 */
function buildPrefYearPopulations(muniDir: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const file of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f))) {
    const prefCode = file.slice(0, 2);
    const budgets: LocalGovBudget[] = JSON.parse(readFileSync(join(muniDir, file), 'utf-8'));
    for (const b of budgets) {
      if (!b.population) continue;
      const key = `${prefCode}:${b.fiscalYear}`;
      result.set(key, (result.get(key) ?? 0) + b.population);
    }
  }
  return result;
}

/** 予算JSONファイルに年度別demographics（と都道府県は年度別人口）を付与して書き戻す */
function patchFile(
  path: string,
  demographicsByYear: Map<number, Map<string, Demographics>>,
  prefYearPopulations?: Map<string, number>
): number {
  if (!existsSync(path)) {
    console.warn(`スキップ（未生成）: ${path}`);
    return 0;
  }
  const budgets: LocalGovBudget[] = JSON.parse(readFileSync(path, 'utf-8'));
  let patched = 0;
  for (const b of budgets) {
    const d = demographicsByYear.get(b.fiscalYear)?.get(b.code);
    if (d) {
      b.demographics = d;
      patched++;
    }
    if (prefYearPopulations && b.code.length === 2) {
      const population = prefYearPopulations.get(`${b.code}:${b.fiscalYear}`);
      if (population) {
        b.population = population;
        b.perCapitaExpenditure = Math.round(b.totalExpenditure / population);
      }
    }
  }
  writeFileSync(path, JSON.stringify(budgets));
  return patched;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const area = parseMencho(await fetchBufferLegacyTls(MENCHO_URL));

  // 年度ごとに住基4表を取得してdemographicsを組み立てる（年度間は1秒空ける）
  const demographicsByYear = new Map<number, Map<string, Demographics>>();
  for (const [year, ids] of Object.entries(JUKI_TABLES)) {
    const [totalBuf, foreignBuf, totalDynBuf, foreignDynBuf] = await Promise.all([
      fetchBuffer(estatUrl(ids.total)),
      fetchBuffer(estatUrl(ids.foreign)),
      fetchBuffer(estatUrl(ids.totalDynamics)),
      fetchBuffer(estatUrl(ids.foreignDynamics)),
    ]);
    const total = parseJuki(totalBuf);
    const foreign = parseJuki(foreignBuf);
    const totalDynamics = parseDynamics(totalDynBuf);
    const foreignDynamics = parseDynamics(foreignDynBuf);
    console.log(
      `${year}年度: 住基（総計）${total.size}団体 / （外国人）${foreign.size}団体 / ` +
        `動態 ${totalDynamics.size}団体`
    );
    demographicsByYear.set(
      Number(year),
      buildDemographics(total, foreign, totalDynamics, foreignDynamics, area)
    );
    await sleep(1000);
  }
  console.log(`面積: ${area.size}団体`);

  const muniDir = join(WEB_PUBLIC, 'budgets', 'municipal');

  // 都道府県（年度別人口は市区町村マスタの県別合算で置き換える）
  const prefYearPopulations = buildPrefYearPopulations(muniDir);
  console.log(`都道府県別・年度別人口: ${prefYearPopulations.size}件`);
  for (const path of [
    join(WEB_PUBLIC, 'budgets.json'),
    join(REPO_ROOT, 'data', 'budgets', 'prefectures.json'),
  ]) {
    const n = patchFile(path, demographicsByYear, prefYearPopulations);
    console.log(`${path}: ${n}件付与`);
  }

  // 市区町村（都道府県別）
  let muniPatched = 0;
  for (const file of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f))) {
    muniPatched += patchFile(join(muniDir, file), demographicsByYear);
  }
  console.log(`市区町村: ${muniPatched}件付与`);
  console.log('完了（build:municipal-all の再実行が必要です）');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
