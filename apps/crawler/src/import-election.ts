/**
 * 衆議院議員総選挙（小選挙区）の候補者別・市区町村別得票数（総務省）から、市区町村ごとの
 * 「小選挙区・当選者・政党・当選者の地元得票率・地元での差」を選挙ごとに作り、予算JSONに elections フィールドとして付与する。
 *
 * データソース: 総務省「衆議院議員総選挙・最高裁判所裁判官国民審査 結果」市区町村別得票数
 *   https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin{回}/shikuchouson.html
 *   第50・51回は都道府県ごとの Excel が直接リンクされ、第48・49回は都道府県ごとのページ（shikuchouson_XX.html）から
 *   「小選挙区」の .xls へたどる。シート = 小選挙区。行 = 市区町村（分割された市は「宇都宮市第１区」「宇都宮市（１区）」）、
 *   列 = 候補者（1 行目が氏名、2 行目が届出政党）。合計行の最多得票者を当選者とみなす（比例復活は扱わない）。
 *   県選管様式（第51回の一部）は候補者が 2 列目から、0 列目に市・郡、1 列目に区・町村。
 *
 * 市区町村の値（複数の小選挙区にまたがる市は得票を足し合わせる）:
 *   winnerShare  = 当選者の得票 ÷ 有効得票（その市区町村内）
 *   winnerMargin = 当選者の得票率 − その市区町村内で当選者以外の最多得票者の得票率（負なら、地元では別の候補が上だった）
 * 都道府県（2 桁コード）は県内の全小選挙区を合算（winnerMargin は無し）。
 * 2022 年の区割り改定で選挙区名は変わるが、市区町村単位の値は選挙ごとに独立に計算する。
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

/** 対象の選挙（古い順）。次の総選挙が公表されたら追加する。web 側の ELECTION_YEARS（lib/metrics.ts）も合わせる */
const ELECTIONS = [
  { no: 48, date: '2017-10-22' },
  { no: 49, date: '2021-10-31' },
  { no: 50, date: '2024-10-27' },
  { no: 51, date: '2026-02-08' },
].map((e) => ({ ...e, name: `第${e.no}回衆議院議員総選挙（小選挙区）`, year: Number(e.date.slice(0, 4)), pageUrl: `https://www.soumu.go.jp/senkyo/senkyo_s/data/shugiin${e.no}/shikuchouson.html` }));
type ElectionMeta = (typeof ELECTIONS)[number];

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

const decode = (buffer: Buffer) => new TextDecoder('shift_jis').decode(buffer); // 総務省の掲載ページは Shift_JIS
const anchors = (html: string) => [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], label: m[2].replace(/<[^>]+>|\s+/g, '') }));

/** 掲載ページから都道府県ごとの Excel を取る。都道府県ページに飛ぶ回（第48・49回）は「小選挙区」の .xls へたどる */
async function discoverFiles(election: ElectionMeta): Promise<Map<string, string>> {
  const dir = join(RAW_DIR, String(election.no));
  const html = decode(await fetchBuffer(election.pageUrl, join(dir, 'shikuchouson.html')));
  const files = new Map<string, string>();
  for (const a of anchors(html)) {
    const pref = PREFECTURES.find((p) => p.name === a.label);
    if (!pref || files.has(pref.code)) continue;
    const url = new URL(a.href, election.pageUrl).href;
    if (/\.xlsx?$/i.test(url)) { files.set(pref.code, url); continue; }
    if (/\.html?$/i.test(url)) {
      const sub = decode(await fetchBuffer(url, join(dir, `${pref.code}.html`)));
      const file = anchors(sub).find((b) => /\.xlsx?$/i.test(b.href) && /小選挙区/.test(b.label));
      if (file) files.set(pref.code, new URL(file.href, url).href);
    }
  }
  if (files.size !== 47) throw new Error(`第${election.no}回: 都道府県の Excel が 47 件見つかりません: ${files.size}`);
  return files;
}

/** 異体字（公表資料 → 標準地域コード表） */
const NAME_VARIANTS: Array<[RegExp, string]> = [[/梼/g, '檮'], [/鯵/g, '鰺'], [/桧/g, '檜'], [/﨑/g, '崎'], [/髙/g, '高'], [/^始良/, '姶良']];
/** 選挙後に改称・市制施行した自治体（都道府県コード|旧名 → 現在の名前） */
const RENAMED: Record<string, string> = { '28|篠山市': '丹波篠山市', '40|那珂川町': '那珂川市' };

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
    // 「宇都宮市第１区」「宇都宮市第１」「横芝光町（10区）」「港区1区」の区割り表記と、異体字・改称を吸収する
    let name = raw.normalize('NFKC').replace(/[\s　]+/g, '').replace(/\(\d+区\)$/, '').replace(/第?\d+区?$/, '');
    for (const [from, to] of NAME_VARIANTS) name = name.replace(from, to);
    name = RENAMED[`${prefCode}|${name}`] ?? name;
    const list = byPref.get(prefCode) ?? [];
    const exact = list.find((m) => m.name === name);
    if (exact) return exact.code;
    // 「ヶ」「ケ」の揺れ（袖ケ浦市・鰺ヶ沢町）
    const swapped = list.find((m) => m.name.replace(/[ヶケ]/g, 'ヶ') === name.replace(/[ヶケ]/g, 'ヶ'));
    if (swapped) return swapped.code;
    // 政令指定都市の区（さいたま市北区 → さいたま市）
    const city = list.filter((m) => m.name.endsWith('市') && name.startsWith(m.name)).sort((a, b) => b.name.length - a.name.length)[0];
    return city?.code ?? null;
  };
}

type Cell = string | number | null | undefined;
const num = (v: Cell) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, '')) || 0);
const str = (v: Cell) => String(v ?? '').trim();

interface MuniAgg { total: number; winnerVotes: number; othersMax: number; partyVotes: Record<string, number>; districts: Array<{ district: string; winner: string; party: string; votes: number }> }

function parsePrefecture(buffer: Buffer, prefCode: string, resolve: (p: string, n: string) => string | null, log: string[]) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const byCode = new Map<string, MuniAgg>();
  const districts: Array<{ district: string; winner: string; party: string; total: number; winnerVotes: number; partyTotals: Record<string, number> }> = [];
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
    const candidates = header.slice(firstCol, totalCol).map((v, i) => ({ name: str(v).replace(/[\s\u3000]+/g, ''), party: str(rows[partyRow][firstCol + i]).replace(/^[（(]|[）)]$/g, '') || '無所属' })); // 党派欄が空の候補は無所属
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
    const partyTotals: Record<string, number> = {};
    candidates.forEach((c, i) => { partyTotals[c.party] = (partyTotals[c.party] ?? 0) + totals[i]; });
    districts.push({ district, winner: candidates[winnerIndex].name, party: candidates[winnerIndex].party, total: totals.reduce((s, v) => s + v, 0), winnerVotes: totals[winnerIndex], partyTotals });
    for (const { label, row } of muniRows) {
      const code = resolve(prefCode, label);
      if (!code) { log.push(`${sheetName}: 自治体コードを引けません: ${label}`); continue; }
      const votes = candidates.map((_, c) => num(row[firstCol + c]));
      const total = votes.reduce((s, v) => s + v, 0);
      if (total === 0) continue;
      const winnerVotes = votes[winnerIndex];
      const othersMax = Math.max(...votes.filter((_, c) => c !== winnerIndex), 0);
      const agg = byCode.get(code) ?? { total: 0, winnerVotes: 0, othersMax: 0, partyVotes: {}, districts: [] };
      agg.total += total; agg.winnerVotes += winnerVotes; agg.othersMax += othersMax;
      candidates.forEach((c, i) => { agg.partyVotes[c.party] = (agg.partyVotes[c.party] ?? 0) + votes[i]; });
      const entry = agg.districts.find((d) => d.district === district);
      if (entry) entry.votes += winnerVotes; else agg.districts.push({ district, winner: candidates[winnerIndex].name, party: candidates[winnerIndex].party, votes: winnerVotes });
      byCode.set(code, agg);
    }
  }
  return { byCode, districts };
}

/** 政党ごとの得票率（0〜1、小数 4 桁）。無所属は「無所属」として残す */
function shares(votes: Record<string, number>, total: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (total <= 0) return out;
  for (const [party, v] of Object.entries(votes).sort((a, b) => b[1] - a[1])) if (v > 0) out[party] = Math.round((v / total) * 10000) / 10000;
  return out;
}

function toElection(agg: MuniAgg, election: ElectionMeta): Election {
  const winnerShare = agg.total > 0 ? agg.winnerVotes / agg.total : null;
  // 複数の小選挙区にまたがる市は、それぞれの当選者の得票を足した「当選者側」と、残りの最多候補を足した「対立側」の差
  const winnerMargin = agg.total > 0 ? (agg.winnerVotes - agg.othersMax) / agg.total : null;
  const partyShare = shares(agg.partyVotes, agg.total);
  // 複数の小選挙区にまたがる市は、この市で最も得票した当選者の政党
  const top = [...agg.districts].sort((a, b) => b.votes - a.votes)[0];
  return { no: election.no, year: election.year, name: election.name, date: election.date, districts: agg.districts.map(({ district, winner, party }) => ({ district, winner, party })), winnerParty: top?.party ?? null, winnerShare, winnerMargin, partyShare, source: `総務省「${election.name.replace('（小選挙区）', '')} 結果」候補者別市区町村別得票数` };
}

function patchFile(path: string, values: Map<string, Election[]>): number {
  if (!existsSync(path)) { console.warn(`スキップ（未生成）: ${path}`); return 0; }
  const budgets: LocalGovBudget[] = JSON.parse(readFileSync(path, 'utf-8'));
  let patched = 0;
  for (const b of budgets) {
    const e = values.get(b.code);
    if (e?.length) { b.elections = [...e].sort((x, y) => x.date.localeCompare(y.date)); patched++; } else delete b.elections;
  }
  writeFileSync(path, JSON.stringify(budgets));
  return patched;
}

async function main() {
  const resolve = makeResolver();
  const values = new Map<string, Election[]>();
  const log: string[] = [];
  const add = (code: string, e: Election) => values.set(code, [...(values.get(code) ?? []), e]);
  for (const election of ELECTIONS) {
    const files = await discoverFiles(election);
    for (const pref of PREFECTURES) {
      const url = files.get(pref.code)!;
      const ext = url.toLowerCase().endsWith('.xls') ? 'xls' : 'xlsx';
      const buffer = await fetchBuffer(url, join(RAW_DIR, String(election.no), `${pref.code}.${ext}`));
      const prefLog: string[] = [];
      const { byCode, districts } = parsePrefecture(buffer, pref.code, resolve, prefLog);
      for (const [code, agg] of byCode) add(code, toElection(agg, election));
      // 都道府県: 県内の全小選挙区の合算（当選者の得票 ÷ 全有効得票）。地元での差は作らない
      const total = districts.reduce((s, d) => s + d.total, 0);
      const winnerVotes = districts.reduce((s, d) => s + d.winnerVotes, 0);
      const prefPartyVotes: Record<string, number> = {};
      for (const d of districts) for (const [party, v] of Object.entries(d.partyTotals)) prefPartyVotes[party] = (prefPartyVotes[party] ?? 0) + v;
      add(pref.code, { no: election.no, year: election.year, name: election.name, date: election.date, districts: districts.map(({ district, winner, party }) => ({ district, winner, party })), winnerParty: null, winnerShare: total > 0 ? winnerVotes / total : null, winnerMargin: null, partyShare: shares(prefPartyVotes, total), source: `総務省「${election.name.replace('（小選挙区）', '')} 結果」候補者別市区町村別得票数` });
      console.log(`第${election.no}回 ${pref.name}: ${districts.length} 選挙区・${byCode.size} 市区町村 ${prefLog.length ? '⚠ ' + prefLog.join(' / ') : ''}`);
      log.push(...prefLog.map((l) => `第${election.no}回 ${pref.name} ${l}`));
    }
  }
  const muniDir = join(WEB_PUBLIC, 'budgets', 'municipal');
  for (const file of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f)).sort()) console.log(`${file}: ${patchFile(join(muniDir, file), values)}件付与`);
  for (const path of [join(WEB_PUBLIC, 'budgets.json'), join(REPO_ROOT, 'data', 'budgets', 'prefectures.json')]) console.log(`${path}: ${patchFile(path, values)}件付与`);
  if (log.length) console.log(`注意 ${log.length} 件:\n${log.join('\n')}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
