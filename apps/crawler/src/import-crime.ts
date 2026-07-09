/**
 * 犯罪統計（刑法犯総数・殺人・強盗・侵入盗・不同意性交等の認知件数）を
 * 警察庁「犯罪統計【確定値】」（e-Stat掲載のExcel）から都道府県別・年別に取得し、
 * 予算JSONの都道府県レコードに safety フィールドの一部として付与する。
 *
 * 市区町村別の罪種別データは全国統一の現行統計が存在しないため都道府県のみ
 * （web側は prefOnly 指標として市区町村ビューを無効化する）。
 * 年度Yには「Y年中（暦年）」の認知件数を対応させる。
 * 不同意性交等は2023年の法改正前は「強制性交等」（さらに前は強姦）で、
 * 各年版のシート名がどちらかで存在する。
 *
 * import:dashboard の後に実行する（既存JSONを上書き更新する）。
 * 実行: npm run -w @local-gov/crawler import:crime
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import type { LocalGovBudget, Safety } from './types/budget.js';

/** 年 → 確定値ExcelのstatInfId（e-Stat「令和N年1～12月犯罪統計【確定値】」） */
const KAKUTEI_IDS: Record<number, string> = {
  2020: '000032049031',
  2021: '000032168154',
  2022: '000040015380',
  2023: '000040141107',
  2024: '000040247461',
};

const estatUrl = (statInfId: string) =>
  `https://www.e-stat.go.jp/stat-search/file-download?statInfId=${statInfId}&fileKind=0`;

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

type CrimeCounts = Pick<
  Safety,
  'penalCodeOffenses' | 'homicides' | 'robberies' | 'burglaries' | 'sexualAssaults'
>;

/**
 * 都道府県別シートから 都道府県名 → 当年認知件数（3列目）を返す。
 * 行形式: [地方名, 都道府県名, 当年, 前年, …]。北海道は方面別の内訳行があり
 * [北海道, 計] が県計。東京都は [東京都, null]。地方計（[東北, 計]等）は除く
 */
function parsePrefSheet(sheet: XLSX.WorkSheet): Map<string, number> {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const result = new Map<string, number>();
  for (const row of rows) {
    const region = String(row[0] ?? '').trim();
    const sub = String(row[1] ?? '').trim();
    const value = row[2];
    if (typeof value !== 'number') continue;
    if (region === '北海道' && sub === '計') result.set('北海道', value);
    else if (region === '東京都' && !sub) result.set('東京都', value);
    else if (/[県府]$/.test(sub)) result.set(sub, value);
  }
  if (result.size !== 47) {
    throw new Error(`都道府県の行数が47ではありません: ${result.size}`);
  }
  return result;
}

/** 1年分の確定値Excelから罪種別の 都道府県名 → 認知件数 を取り出す */
function parseYear(buf: Buffer): Map<string, CrimeCounts> {
  const wb = XLSX.read(buf);
  const sheetOf = (...names: string[]): XLSX.WorkSheet => {
    for (const n of names) if (wb.Sheets[n]) return wb.Sheets[n];
    throw new Error(`シートが見つかりません: ${names.join('/')}`);
  };
  const tables: Array<[keyof CrimeCounts, Map<string, number>]> = [
    ['penalCodeOffenses', parsePrefSheet(sheetOf('第３表'))],
    ['homicides', parsePrefSheet(sheetOf('殺人'))],
    ['robberies', parsePrefSheet(sheetOf('強盗'))],
    ['burglaries', parsePrefSheet(sheetOf('侵入盗'))],
    ['sexualAssaults', parsePrefSheet(sheetOf('不同意性交等', '強制性交等'))],
  ];
  const result = new Map<string, CrimeCounts>();
  for (const [key, table] of tables) {
    for (const [pref, value] of table) {
      const c = result.get(pref) ?? {};
      c[key] = value;
      result.set(pref, c);
    }
  }
  return result;
}

/** 都道府県予算JSONへ年度別に付与（既存のsafety=交通事故とマージ）して書き戻す */
function patchFile(path: string, byYear: Map<number, Map<string, CrimeCounts>>): number {
  if (!existsSync(path)) {
    console.warn(`スキップ（未生成）: ${path}`);
    return 0;
  }
  const budgets: LocalGovBudget[] = JSON.parse(readFileSync(path, 'utf-8'));
  let patched = 0;
  for (const b of budgets) {
    if (b.code.length !== 2) continue;
    const c = byYear.get(b.fiscalYear)?.get(b.name);
    if (c) {
      b.safety = { ...b.safety, ...c };
      patched++;
    }
  }
  writeFileSync(path, JSON.stringify(budgets));
  return patched;
}

async function main() {
  const byYear = new Map<number, Map<string, CrimeCounts>>();
  for (const [year, id] of Object.entries(KAKUTEI_IDS)) {
    const buf = await fetchBuffer(estatUrl(id));
    const parsed = parseYear(buf);
    byYear.set(Number(year), parsed);
    const total = Array.from(parsed.values()).reduce((s, c) => s + (c.homicides ?? 0), 0);
    console.log(`${year}年: 47都道府県 / 殺人 全国${total}件`);
    await sleep(1000);
  }

  for (const path of [
    join(WEB_PUBLIC, 'budgets.json'),
    join(REPO_ROOT, 'data', 'budgets', 'prefectures.json'),
  ]) {
    console.log(`${path}: ${patchFile(path, byYear)}件付与`);
  }
  console.log('完了（市区町村データは対象外。municipal-allの再生成も不要）');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
