/**
 * 安全（交通事故）を警察庁「交通事故統計情報オープンデータ」の本票CSVから
 * 市区町村別・暦年別に集計し、予算JSONに safety フィールド（年度別）として付与する。
 *
 * データソース: https://www.npa.go.jp/publications/statistics/koutsuu/opendata/index_opendata.html
 *   本票 = 人身事故1件1レコード（物損事故は含まない）。毎年春に前年分を公表。
 *   都道府県コードは警察庁独自（北海道は方面別の10〜14等）でJISへ変換する。
 *   市区町村コードは総務省標準地域コードの下3桁。政令指定都市は区単位のため
 *   予算データの市コードへ集約する。年度Yには「Y年中（暦年）」の事故を対応させる
 *   （住基の人口動態と同じ対応）。
 *
 * import:dashboard / import:municipal の後に実行する（既存JSONを上書き更新する）。
 * 実行: npm run -w @local-gov/crawler import:safety
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import type { LocalGovBudget, Safety } from './types/budget.js';

/** 集計対象の暦年（=予算年度）。公表済みの最新年に合わせて更新する */
const YEARS = [2020, 2021, 2022, 2023, 2024];

const honhyoUrl = (year: number) =>
  `https://www.npa.go.jp/publications/statistics/koutsuu/opendata/${year}/honhyo_${year}.csv`;

/** 警察庁の都道府県コード → JIS都道府県コード（コードブック「都道府県」シートより） */
const POLICE_PREF_TO_JIS: Record<string, string> = {
  '10': '01', '11': '01', '12': '01', '13': '01', '14': '01', // 北海道（方面別）
  '20': '02', '21': '03', '22': '04', '23': '05', '24': '06', '25': '07',
  '30': '13',
  '40': '08', '41': '09', '42': '10', '43': '11', '44': '12', '45': '14',
  '46': '15', '47': '19', '48': '20', '49': '22',
  '50': '16', '51': '17', '52': '18', '53': '21', '54': '23', '55': '24',
  '60': '25', '61': '26', '62': '27', '63': '28', '64': '29', '65': '30',
  '70': '31', '71': '32', '72': '33', '73': '34', '74': '35',
  '80': '36', '81': '37', '82': '38', '83': '39',
  '90': '40', '91': '41', '92': '42', '93': '43', '94': '44', '95': '45',
  '96': '46', '97': '47',
};

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

/** 予算データに存在する全市区町村コード（区→市の集約先の解決に使う） */
function loadMasterCodes(muniDir: string): Set<string> {
  const codes = new Set<string>();
  for (const file of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f))) {
    const budgets: LocalGovBudget[] = JSON.parse(readFileSync(join(muniDir, file), 'utf-8'));
    for (const b of budgets) codes.add(b.code);
  }
  return codes;
}

/**
 * 事故データの5桁コードを予算データのコードへ解決する。
 * 政令指定都市の区（マスタにないコード）は、同一都道府県内で
 * そのコード未満かつ最も近いマスタコード（=親の市）へ集約する。
 * 年途中の合併で旧コードが残る場合も同じ規則で近隣へ寄せず、
 * 差が大きいものは不明としてnullを返す
 */
function resolveCode(code: string, master: Set<string>): string | null {
  if (master.has(code)) return code;
  const pref = code.slice(0, 2);
  let best: string | null = null;
  for (const c of master) {
    if (!c.startsWith(pref) || c >= code) continue;
    if (best === null || c > best) best = c;
  }
  // 政令市の区は市コードとの差が高々30程度。それを大きく超えるものは別物
  if (best !== null && Number(code) - Number(best) <= 40) return best;
  return null;
}

interface SafetyAgg {
  accidents: number;
  fatalities: number;
  injuries: number;
}

/** 本票CSVを読み、発生年ごとの コード → 集計 に足し込む */
function aggregate(
  buf: Buffer,
  master: Set<string>,
  byYear: Map<number, Map<string, SafetyAgg>>,
  unmatched: Map<string, number>
): void {
  const text = new TextDecoder('shift_jis').decode(buf);
  const rows: string[][] = parse(text, { relax_column_count: true, skip_empty_lines: true });
  const header = rows[0];
  const col = (name: string) => header.findIndex((h) => h.replace(/\s/g, '') === name);
  const cPref = col('都道府県コード');
  const cCity = col('市区町村コード');
  const cDeath = col('死者数');
  const cInjury = col('負傷者数');
  const cYear = col('発生日時年');
  if ([cPref, cCity, cDeath, cInjury, cYear].some((i) => i < 0)) {
    throw new Error(`本票のヘッダーが想定と異なります: ${header.slice(0, 12).join(',')}`);
  }

  for (const row of rows.slice(1)) {
    const year = Number(row[cYear]);
    const agg = byYear.get(year);
    if (!agg) continue; // 対象外の年（前年12月処理分など）
    const jisPref = POLICE_PREF_TO_JIS[row[cPref]];
    if (!jisPref) continue;
    const rawCode = jisPref + row[cCity].padStart(3, '0');
    const code = resolveCode(rawCode, master);
    if (!code) {
      unmatched.set(rawCode, (unmatched.get(rawCode) ?? 0) + 1);
      continue;
    }
    let s = agg.get(code);
    if (!s) {
      s = { accidents: 0, fatalities: 0, injuries: 0 };
      agg.set(code, s);
    }
    s.accidents += 1;
    s.fatalities += Number(row[cDeath]) || 0;
    s.injuries += Number(row[cInjury]) || 0;
  }
}

/** 都道府県（2桁コード）の値 = 県内市区町村の合算 を追加する */
function addPrefTotals(agg: Map<string, SafetyAgg>): void {
  const prefs = new Map<string, SafetyAgg>();
  for (const [code, s] of agg) {
    const pref = code.slice(0, 2);
    let p = prefs.get(pref);
    if (!p) {
      p = { accidents: 0, fatalities: 0, injuries: 0 };
      prefs.set(pref, p);
    }
    p.accidents += s.accidents;
    p.fatalities += s.fatalities;
    p.injuries += s.injuries;
  }
  for (const [pref, s] of prefs) agg.set(pref, s);
}

/** 予算JSONファイルに年度別safetyを付与して書き戻す */
function patchFile(path: string, byYear: Map<number, Map<string, SafetyAgg>>): number {
  if (!existsSync(path)) {
    console.warn(`スキップ（未生成）: ${path}`);
    return 0;
  }
  const budgets: LocalGovBudget[] = JSON.parse(readFileSync(path, 'utf-8'));
  let patched = 0;
  for (const b of budgets) {
    const s = byYear.get(b.fiscalYear)?.get(b.code);
    if (s) {
      b.safety = s satisfies Safety;
      patched++;
    }
  }
  writeFileSync(path, JSON.stringify(budgets));
  return patched;
}

async function main() {
  const muniDir = join(WEB_PUBLIC, 'budgets', 'municipal');
  const master = loadMasterCodes(muniDir);
  console.log(`マスタコード: ${master.size}団体`);

  const byYear = new Map<number, Map<string, SafetyAgg>>(YEARS.map((y) => [y, new Map()]));
  const unmatched = new Map<string, number>();
  for (const year of YEARS) {
    const buf = await fetchBuffer(honhyoUrl(year));
    aggregate(buf, master, byYear, unmatched);
    await sleep(1000);
  }
  if (unmatched.size > 0) {
    const total = Array.from(unmatched.values()).reduce((a, b) => a + b, 0);
    console.warn(`コード未解決: ${unmatched.size}種 ${total}件（例: ${[...unmatched.keys()].slice(0, 5).join(', ')}）`);
  }
  for (const year of YEARS) {
    const agg = byYear.get(year)!;
    // 事故が1件もない団体は「データなし」ではなく0件（意味のある値）として埋める
    for (const code of master) {
      if (!agg.has(code)) agg.set(code, { accidents: 0, fatalities: 0, injuries: 0 });
    }
    addPrefTotals(agg);
    const nationwide = Array.from(agg.entries())
      .filter(([code]) => code.length === 2)
      .reduce((sum, [, s]) => sum + s.accidents, 0);
    console.log(`${year}年: 全国${nationwide.toLocaleString()}件 / ${agg.size}団体`);
  }

  for (const path of [
    join(WEB_PUBLIC, 'budgets.json'),
    join(REPO_ROOT, 'data', 'budgets', 'prefectures.json'),
  ]) {
    console.log(`${path}: ${patchFile(path, byYear)}件付与`);
  }
  let muniPatched = 0;
  for (const file of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f))) {
    muniPatched += patchFile(join(muniDir, file), byYear);
  }
  console.log(`市区町村: ${muniPatched}件付与`);
  console.log('完了（build:municipal-all の再実行が必要です）');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
