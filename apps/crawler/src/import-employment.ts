/**
 * 就労・所得データを取得し、既存の予算JSONに employment フィールドとして付与する。
 *
 * データソース:
 *   平均所得: 総務省「市町村税課税状況等の調」（令和7年度）別表b＝第11表市町村別データ
 *     https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/ichiran09_25.html
 *     所得割納税義務者数と課税対象所得（2024年中の所得）。都道府県は市区町村の合算。
 *   産業構成: 令和2年国勢調査 就業状態等基本集計 第5-3表
 *     男女・従業上の地位・産業（大分類）別就業者数 － 全国、都道府県、市区町村
 *     （e-Stat statInfId=000032201183。産業大分類の就業者構成比、上位5＋その他）
 *
 * import:dashboard / import:municipal の後に実行し、最後に build:municipal-all を再実行する。
 * 実行: npm run -w @local-gov/crawler import:employment
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import * as XLSX from 'xlsx';
import type { LocalGovBudget, Employment } from './types/budget.js';

const TAX_URL =
  'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/xls/J51-25-b.xlsx';
const CENSUS_URL =
  'https://www.e-stat.go.jp/stat-search/file-download?statInfId=000032201183&fileKind=0';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');
const CACHE_DIR = join(tmpdir(), 'local-gov-employment-cache');

async function fetchCached(url: string, name: string): Promise<Buffer> {
  const cachePath = join(CACHE_DIR, name);
  if (existsSync(cachePath)) return readFileSync(cachePath);
  console.log(`ダウンロード中: ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`ダウンロード失敗: HTTP ${res.status} (${url})`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, buf);
  return buf;
}

interface IncomeAcc {
  taxpayers: number;
  income: number; // 千円
}

/**
 * 課税状況調 別表b（第11表市町村別）から市区町村・都道府県の
 * 所得割納税義務者数と課税対象所得を集計する。キーは市区町村5桁/都道府県2桁
 */
function parseTax(buf: Buffer): Map<string, IncomeAcc> {
  const wb = XLSX.read(buf);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const result = new Map<string, IncomeAcc>();
  const add = (key: string, taxpayers: number, income: number) => {
    const acc = result.get(key) ?? { taxpayers: 0, income: 0 };
    acc.taxpayers += taxpayers;
    acc.income += income;
    result.set(key, acc);
  };
  for (const row of rows) {
    // 列: 0=年度 1=団体コード(6桁) 4=表側 5=所得割の納税義務者数 13=課税対象所得(千円)
    if (row[4] !== '市町村民税') continue;
    const rawCode = String(row[1] ?? '');
    if (!/^\d{6}$/.test(rawCode)) continue;
    const taxpayers = Number(row[5]);
    const income = Number(row[13]);
    if (!Number.isFinite(taxpayers) || !Number.isFinite(income) || taxpayers <= 0) continue;
    const muniCode = rawCode.slice(0, 5);
    add(muniCode, taxpayers, income);
    add(muniCode.slice(0, 2), taxpayers, income); // 都道府県合算
  }
  return result;
}

/**
 * 国勢調査 第5-3表から産業（大分類）別就業者の構成比を集計する。
 * キーは市区町村5桁/都道府県2桁。値は産業名 → 就業者数と総数
 */
function parseCensus(buf: Buffer): Map<string, { total: number; byIndustry: Map<string, number> }> {
  const wb = XLSX.read(buf);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const result = new Map<string, { total: number; byIndustry: Map<string, number> }>();
  for (const row of rows) {
    // 列: 0=地域識別コード 5=2020年_地域コード 7=男女 9=産業 10=就業者数（総数）
    const kind = String(row[0] ?? '');
    if (kind === '9' || kind === '') continue; // 旧市区町村・ヘッダは除外
    if (row[7] !== '0_総数') continue;
    const areaCode = String(row[5] ?? '');
    if (!/^\d{5}$/.test(areaCode)) continue;
    const industry = String(row[9] ?? '');
    const value = Number(row[10]);
    if (!Number.isFinite(value)) continue;
    // 全国(00000)は不要。都道府県は 'a' 行（XX000）を2桁キーで持つ
    const key =
      areaCode === '00000' ? null : areaCode.endsWith('000') ? areaCode.slice(0, 2) : areaCode;
    if (!key) continue;
    let acc = result.get(key);
    if (!acc) {
      acc = { total: 0, byIndustry: new Map() };
      result.set(key, acc);
    }
    if (industry === '0_総数') acc.total += value;
    else if (/^[A-S]_/.test(industry)) {
      // 大分類のみ（「01_うち農業」「R1_（再掲）」「T_分類不能」は除外）
      const name = industry.replace(/^[A-S]_/, '').replace(/，/g, '・');
      acc.byIndustry.set(name, (acc.byIndustry.get(name) ?? 0) + value);
    }
  }
  return result;
}

/**
 * 全業種の構成比%（小数1桁、降順）。地図の業種別塗り分けに使うため
 * 全業種を保存する（円グラフ側で上位5＋その他に畳む）。0.05%未満は省く
 */
function allIndustries(
  total: number,
  byIndustry: Map<string, number>
): Array<{ name: string; share: number }> | undefined {
  if (total <= 0 || byIndustry.size === 0) return undefined;
  const list = [...byIndustry]
    .map(([name, v]) => ({ name, share: Number(((v / total) * 100).toFixed(1)) }))
    .filter((i) => i.share >= 0.05)
    .sort((a, b) => b.share - a.share);
  return list.length > 0 ? list : undefined;
}

function patchFile(
  path: string,
  incomes: Map<string, IncomeAcc>,
  census: Map<string, { total: number; byIndustry: Map<string, number> }>
): void {
  const budgets: LocalGovBudget[] = JSON.parse(readFileSync(path, 'utf-8'));
  let patched = 0;
  for (const b of budgets) {
    const income = incomes.get(b.code);
    const ind = census.get(b.code);
    const employment: Employment = {};
    if (income) {
      employment.avgIncome = Math.round((income.income * 1000) / income.taxpayers);
      employment.taxpayers = income.taxpayers;
    }
    if (ind) employment.industries = allIndustries(ind.total, ind.byIndustry);
    if (employment.avgIncome !== undefined || employment.industries) {
      b.employment = employment;
      patched++;
    }
  }
  writeFileSync(path, JSON.stringify(budgets, null, path.includes('municipal') ? 0 : 2));
  console.log(`${path}: ${patched}/${budgets.length}件付与`);
}

async function main() {
  const incomes = parseTax(await fetchCached(TAX_URL, 'kazei-b.xlsx'));
  const census = parseCensus(await fetchCached(CENSUS_URL, 'kokusei-5-3.xlsx'));
  console.log(`所得: ${incomes.size}団体 / 産業: ${census.size}団体`);

  // 検証: 東京都と札幌市
  const tokyo = incomes.get('13');
  if (tokyo) {
    console.log(
      `検証 東京都: 納税者${tokyo.taxpayers.toLocaleString()}人 平均${Math.round((tokyo.income * 1000) / tokyo.taxpayers / 10000)}万円`
    );
  }
  const sapporo = census.get('01100');
  if (sapporo) {
    const top = allIndustries(sapporo.total, sapporo.byIndustry);
    console.log(
      `検証 札幌市 産業(${top?.length}業種): ${top?.slice(0, 3).map((i) => `${i.name}${i.share}%`).join('・')}…`
    );
  }

  patchFile(join(WEB_PUBLIC, 'budgets.json'), incomes, census);
  patchFile(join(REPO_ROOT, 'data', 'budgets', 'prefectures.json'), incomes, census);
  const muniDir = join(WEB_PUBLIC, 'budgets', 'municipal');
  for (const file of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f))) {
    patchFile(join(muniDir, file), incomes, census);
  }
  console.log('完了。build:municipal-all を再実行してください。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
