/**
 * 衆議院議員総選挙（小選挙区）の候補者別・市区町村別得票数（総務省）から、市区町村ごとの
 * 「小選挙区・当選者・政党・当選者の地元得票率・地元での差」を作り、予算JSONに election フィールドとして付与する。
 *
 * データソース: 総務省「衆議院議員総選挙・最高裁判所裁判官国民審査 速報結果」市区町村別得票数
 *   https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin51/shikuchouson.html（第51回・令和8年2月8日執行）
 *   都道府県ごとの Excel。シート = 小選挙区。行 = 市区町村（分割された市は「宇都宮市第１区」のように区名付き）、
 *   列 = 候補者（1 行目が氏名、2 行目が届出政党）。最終行「○○第N区 合計」の最多得票者を当選者とみなす
 *   （小選挙区は単純多数なので合計行の 1 位 = 当選者。比例復活は扱わない）。
 *
 * 市区町村の値（複数の小選挙区にまたがる市は得票を足し合わせる）:
 *   winnerShare  = 当選者の得票 ÷ 有効得票（その市区町村内）
 *   winnerMargin = 当選者の得票率 − その市区町村内で当選者以外の最多得票者の得票率（負なら、地元では別の候補が上だった）
 * 都道府県（2 桁コード）は県内の全小選挙区を合算（winnerMargin は無し）。
 *
 * 政治的な意味づけはしない。「有権者の支持」であって首長の支持ではない点に注意（表示文言もそのとおりにする）。
 *
 * import:dashboard / import:municipal の後に実行する（既存JSONを上書き更新する）。
 * 実行: npm run -w @local-gov/crawler import:election
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { PREFECTURES } from './data/prefectures.js';
import type { Election, LocalGovBudget } from './types/budget.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');
const RAW_DIR = join(REPO_ROOT, 'apps', 'crawler', 'output', 'election', 'raw');
const SEARCH_INDEX = join(WEB_PUBLIC, 'search-index.json');

/** 対象の選挙。次の総選挙が公表されたらここを更新する */
const ELECTION = {
  name: '第51回衆議院議員総選挙（小選挙区）',
  date: '2026-02-08',
  pageUrl: 'https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin51/shikuchouson.html',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const UA = 'local-gov-vis crawler (+https://github.com/Ina299/local_gov_vis)';

async function fetchBuffer(url: string, cachePath: string): Promise<Buffer> {
  if (existsSync(cachePath)) return readFileSync(cachePath);
  console.log(`ダウンロード中: ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`ダウンロード失敗: HTTP ${res.status} (${url})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, buffer);
  await sleep(1000);
  return buffer;
}

/** 掲載ページから都道府県ごとの Excel リンクを取る（比例ブロックの「○○選挙区」は除く） */
async function discoverFiles(): Promise<Map<string, string>> {
  // 総務省の掲載ページは Shift_JIS
  const html = new TextDecoder('shift_jis').decode(await fetchBuffer(ELECTION.pageUrl, join(RAW_DIR, 'shikuchouson.html')));
  const files = new Map<string, string>();
  for (const m of html.matchAll(/<a[^>]+href="([^"]+\.xlsx)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const label = m[2].replace(/<[^>]+>|\s+/g, '');
    const pref = PREFECTURES.find((p) => p.name === label);
    if (!pref || files.has(pref.code)) continue;
    files.set(pref.code, new URL(m[1], ELECTION.pageUrl).href);
  }
  if (files.size !== 47) throw new Error(`都道府県の Excel が 47 件見つかりません: ${files.size}`);
  return files;
}

/** 市区町村名 → コード（都道府県内）。分割市の「第N区」と政令市の区名を吸収する */
function makeResolver(): (prefCode: string, name: string) => string | null {
  const items: Array<{ code: string; name: string; prefCode?: string }> = JSON.parse(readFileSync(SEARCH_INDEX, 'utf-8'));
  const byPref = new Map<string, Array<{ code: string; name: string }>>();
  for (const item of items) {
    const pref = item.prefCode ?? item.code.slice(0, 2);
    if (item.code.length !== 5) continue;
    byPref.set(pref, [...(byPref.get(pref) ?? []), { code: item.code, name: item.name }]);
  }
  return (prefCode, raw) => {
    const name = raw.normalize('NFKC').replace(/[\s　]+/g, '').replace(/第\d+(区)?$/, '').replace(/梼/g, '檮');
    const list = byPref.get(prefCode) ?? [];
    const exact = list.find((m) => m.name === name);
    if (exact) return exact.code;
    // 政令指定都市の区（さいたま市北区 → さいたま市）
    const city = list.filter((m) => m.name.endsWith('市') && name.startsWith(m.name)).sort((a, b) => b.name.length - a.name.length)[0];
    return city?.code ?? null;
  };
}

type Cell = string | number | null | undefined;
const num = (v: Cell) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, '')) || 0);
const str = (v: Cell) => String(v ?? '').trim();

interface MuniAgg { total: number; winnerVotes: number; othersMax: number; districts: Array<{ district: string; winner: string; party: string }> }

function parsePrefecture(buffer: Buffer, prefCode: string, resolve: (p: string, n: string) => string | null, log: string[]) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const byCode = new Map<string, MuniAgg>();
  const districts: Array<{ district: string; winner: string; party: string; total: number; winnerVotes: number }> = [];
  for (const sheetName of wb.SheetNames) {
    const rows: Cell[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
    // 2 つの様式がある。
    //  (a) 総務省集計: 「候補者名」行の次が「市区町村名＼政党名」行、候補者は 1 列目から、市区町村は 0 列目に「宇都宮市第１区」
    //  (b) 県選管様式: 「候補者名」行→空行→「開票区名＼党派名」行、候補者は 2 列目から、0 列目に市・郡、1 列目に区・町村。
    //      政令市は 0 列目の市の行が合計で、1 列目の区は内訳（数えない）。郡は 0 列目が見出しで、1 列目の町村を数える
    const nameRow = rows.findIndex((r) => str(r[0]) === '候補者名');
    if (nameRow < 0) { log.push(`${sheetName}: 候補者名の行がありません`); continue; }
    const header = rows[nameRow];
    const firstCol = header.findIndex((v, i) => i > 0 && str(v) !== '');
    const totalCol = header.findIndex((v, i) => i >= firstCol && str(v) === '得票数計');
    const partyRow = rows.findIndex((r, i) => i > nameRow && /^(市区町村名|開票区名)/.test(str(r[0])));
    if (firstCol < 0 || totalCol <= firstCol || partyRow < 0) { log.push(`${sheetName}: 見出し行の形式が想定と違います`); continue; }
    const candidates = header.slice(firstCol, totalCol).map((v, i) => ({ name: str(v).replace(/[\s\u3000]+/g, ''), party: str(rows[partyRow][firstCol + i]) }));
    const district = `${PREFECTURES.find((p) => p.code === prefCode)?.name ?? ''}${sheetName.replace(/\s+/g, '').replace(/^.+?県|^.+?府|^東京都|^北海道/, '')}`;
    let totalRow: Cell[] | null = null;
    const muniRows: Array<{ label: string; row: Cell[] }> = [];
    let parentIsCounty = false;
    for (let i = partyRow + 1; i < rows.length; i++) {
      const row = rows[i];
      const label0 = str(row[0]);
      const label1 = firstCol >= 2 ? str(row[1]) : '';
      // 合計行: 「栃木県第１区 合計」(a) または「第１区計」(b)
      const norm0 = label0.normalize('NFKC');
      if (label0 && (/合計$/.test(norm0) || /^(.*第\d+区)?計$/.test(norm0))) { totalRow = row; break; }
      if (label0) {
        // 郡・北海道の振興局・東京都の支庁・県の地方事務所は見出し（1 列目の町村を数える）
        if (/(郡|振興局|支庁|事務所)$/.test(label0.normalize('NFKC'))) { parentIsCounty = true; continue; }
        parentIsCounty = false;
        muniRows.push({ label: label0, row });
      } else if (label1 && parentIsCounty) {
        muniRows.push({ label: label1, row });
      }
    }
    if (!totalRow) { log.push(`${sheetName}: 合計行がありません`); continue; }
    const totals = candidates.map((_, i) => num(totalRow![firstCol + i]));
    const winnerIndex = totals.indexOf(Math.max(...totals));
    districts.push({ district, winner: candidates[winnerIndex].name, party: candidates[winnerIndex].party, total: totals.reduce((s, v) => s + v, 0), winnerVotes: totals[winnerIndex] });
    for (const { label, row } of muniRows) {
      const code = resolve(prefCode, label);
      if (!code) { log.push(`${sheetName}: 自治体コードを引けません: ${label}`); continue; }
      const votes = candidates.map((_, c) => num(row[firstCol + c]));
      const total = votes.reduce((s, v) => s + v, 0);
      if (total === 0) continue;
      const winnerVotes = votes[winnerIndex];
      const othersMax = Math.max(...votes.filter((_, c) => c !== winnerIndex), 0);
      const agg = byCode.get(code) ?? { total: 0, winnerVotes: 0, othersMax: 0, districts: [] };
      agg.total += total; agg.winnerVotes += winnerVotes; agg.othersMax += othersMax;
      if (!agg.districts.some((d) => d.district === district)) agg.districts.push({ district, winner: candidates[winnerIndex].name, party: candidates[winnerIndex].party });
      byCode.set(code, agg);
    }
  }
  return { byCode, districts };
}

function toElection(agg: MuniAgg): Election {
  const winnerShare = agg.total > 0 ? agg.winnerVotes / agg.total : null;
  // 複数の小選挙区にまたがる市は、それぞれの当選者の得票を足した「当選者側」と、残りの最多候補を足した「対立側」の差
  const winnerMargin = agg.total > 0 ? (agg.winnerVotes - agg.othersMax) / agg.total : null;
  return { name: ELECTION.name, date: ELECTION.date, districts: agg.districts, winnerShare, winnerMargin, source: `総務省「${ELECTION.name.replace('（小選挙区）', '')} 速報結果」候補者別市区町村別得票数` };
}

function patchFile(path: string, values: Map<string, Election>): number {
  if (!existsSync(path)) { console.warn(`スキップ（未生成）: ${path}`); return 0; }
  const budgets: LocalGovBudget[] = JSON.parse(readFileSync(path, 'utf-8'));
  let patched = 0;
  for (const b of budgets) {
    const e = values.get(b.code);
    if (e) { b.election = e; patched++; } else delete b.election;
  }
  writeFileSync(path, JSON.stringify(budgets));
  return patched;
}

async function main() {
  const files = await discoverFiles();
  const resolve = makeResolver();
  const values = new Map<string, Election>();
  const log: string[] = [];
  for (const pref of PREFECTURES) {
    const url = files.get(pref.code)!;
    const buffer = await fetchBuffer(url, join(RAW_DIR, `${pref.code}.xlsx`));
    const prefLog: string[] = [];
    const { byCode, districts } = parsePrefecture(buffer, pref.code, resolve, prefLog);
    for (const [code, agg] of byCode) values.set(code, toElection(agg));
    // 都道府県: 県内の全小選挙区の合算（当選者の得票 ÷ 全有効得票）。地元での差は作らない
    const total = districts.reduce((s, d) => s + d.total, 0);
    const winnerVotes = districts.reduce((s, d) => s + d.winnerVotes, 0);
    values.set(pref.code, { name: ELECTION.name, date: ELECTION.date, districts: districts.map(({ district, winner, party }) => ({ district, winner, party })), winnerShare: total > 0 ? winnerVotes / total : null, winnerMargin: null, source: values.values().next().value?.source ?? '' });
    console.log(`${pref.name}: ${districts.length} 選挙区・${byCode.size} 市区町村 ${prefLog.length ? '⚠ ' + prefLog.join(' / ') : ''}`);
    log.push(...prefLog.map((l) => `${pref.name} ${l}`));
  }
  const muniDir = join(WEB_PUBLIC, 'budgets', 'municipal');
  for (const file of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f)).sort()) console.log(`${file}: ${patchFile(join(muniDir, file), values)}件付与`);
  for (const path of [join(WEB_PUBLIC, 'budgets.json'), join(REPO_ROOT, 'data', 'budgets', 'prefectures.json')]) console.log(`${path}: ${patchFile(path, values)}件付与`);
  if (log.length) console.log(`注意 ${log.length} 件:\n${log.join('\n')}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
