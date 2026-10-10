/**
 * 国土交通省 道路局「社会資本整備総合交付金の配分（道路分）」の都道府県別 箇所表 PDF を取り込み、
 * 市区町村（事業実施主体）ごとの想定国費を年度別に保存する。
 *
 * データソース: 道路IR 予算 https://www.mlit.go.jp/road/road_tk4_000001.html
 *   毎年 4 月の当初配分時に「令和N年度 道路関係予算配分について（概要・箇所表）」として公表。
 *   都道府県ごとの PDF は https://www.mlit.go.jp/road/ir/ir-yosan/r{N}yhai/pdf/sha/13{JIS都道府県コード}k.pdf
 *   （令和5〜8年度で同じ規則を確認済み）。
 *   内容: 防災・安全交付金／社会資本整備総合交付金それぞれについて、
 *     1) 計画名・計画策定主体・重点計画・想定国費（千円）の一覧
 *     2) 別紙: 計画名・要素事業名等（路線・工区）・事業実施主体・想定国費（千円）
 *   「想定国費」は配分国費のうち道路分として想定される国費で、配分そのもの（整備計画単位）ではない。
 *
 * 抽出は pdfjs の文字座標で行う（列見出し「事業実施主体」「想定国費」の x 位置を基準に行を読む）。
 * 文字列の出現順には頼らない。LLM・OCR は使わない。
 *
 * 出力: data/road-allocations/{年度}.json（行ごとの出典ページ付き）
 * 実行: npm run -w @local-gov/crawler import:road-allocations [--fy 2026] [--pref 09]（--pref は PDF のファイル番号）
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PREFECTURES } from './data/prefectures.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const RAW_DIR = join(REPO_ROOT, 'apps', 'crawler', 'output', 'road-allocations', 'raw');
const OUT_DIR = join(REPO_ROOT, 'data', 'road-allocations');
const SEARCH_INDEX = join(REPO_ROOT, 'apps', 'web', 'public', 'search-index.json');

/** 取り込む年度（西暦の会計年度）と令和の年。公表済みの最新年度に合わせて追加する */
const FISCAL_YEARS: Array<{ fy: number; reiwa: number }> = [
  { fy: 2023, reiwa: 5 },
  { fy: 2024, reiwa: 6 },
  { fy: 2025, reiwa: 7 },
  { fy: 2026, reiwa: 8 },
];

export type Frame = '防災・安全交付金' | '社会資本整備総合交付金';

export interface RoadAllocationRow {
  /** 都道府県コード（JIS X 0401） */
  prefCode: string;
  frame: Frame;
  /** 計画名（別紙の左列。複数行はつなげる。参考情報） */
  planName: string;
  /** 要素事業名等（路線名と工区） */
  route: string;
  /** 事業実施主体（原文のまま） */
  entity: string;
  /** 事業実施主体の自治体コード（都道府県は 2 桁、市区町村は 5 桁。組合等で引けないものは null） */
  code: string | null;
  /** 想定国費（円） */
  amountYen: number;
  /** 出典 PDF のページ */
  page: number;
}

export interface RoadAllocationFile {
  fiscalYear: number;
  generatedAt: string;
  source: { name: string; indexUrl: string; note: string };
  documents: Array<{ prefCode: string; url: string; sha256: string; pages: number; rows: number; frameTotals: Record<string, number>; validation: string[] }>;
  rows: RoadAllocationRow[];
}

/**
 * PDF のファイル番号（13NNk）。JIS 都道府県コードとほぼ同じだが 15〜24 は道路局の並び
 * （山梨・長野・新潟・富山・石川・岐阜・静岡・愛知・三重・福井）で、JIS とずれる。
 * 番号は取得にだけ使い、都道府県は PDF 本文の「(○○県)」で決める
 */
const FILE_NUMBERS = Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, '0'));
const pdfUrl = (reiwa: number, fileNumber: string) => `https://www.mlit.go.jp/road/ir/ir-yosan/r${reiwa}yhai/pdf/sha/13${fileNumber}k.pdf`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPdf(url: string, cachePath: string): Promise<Buffer> {
  if (existsSync(cachePath)) return readFileSync(cachePath);
  console.log(`ダウンロード中: ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'local-gov-vis crawler (+https://github.com/Ina299/local_gov_vis)' } });
  if (!res.ok) throw new Error(`ダウンロード失敗: HTTP ${res.status} (${url})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error(`PDF ではありません: ${url}`);
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, buffer);
  await sleep(1000);
  return buffer;
}

interface Glyph { s: string; x: number; y: number }
const entityHeaderY = (glyphs: Glyph[]) => glyphs.find((g) => g.s === '事業実施主体')?.y ?? -Infinity;

/** 市区町村名 → コード（都道府県内で引く）。search-index.json は import:municipal / import:yomi が作る */
function loadNameIndex(): Map<string, string> {
  const items: Array<{ code: string; name: string; prefCode?: string }> = JSON.parse(readFileSync(SEARCH_INDEX, 'utf-8'));
  const map = new Map<string, string>();
  for (const item of items) {
    const pref = item.prefCode ?? item.code.slice(0, 2);
    map.set(`${pref}|${item.name}`, item.code);
  }
  return map;
}

/** 異体字の違いを吸収する（箇所表は「梼原町」、標準地域コードは「檮原町」） */
const VARIANTS: Array<[RegExp, string]> = [[/梼/g, '檮'], [/﨑/g, '崎'], [/髙/g, '高']];
function resolveCode(prefCode: string, entity: string, index: Map<string, string>): string | null {
  const pref = PREFECTURES.find((p) => p.code === prefCode);
  if (pref && entity === pref.name) return prefCode;
  let normalized = entity.normalize('NFKC').replace(/\s+/g, '');
  for (const [from, to] of VARIANTS) normalized = normalized.replace(from, to);
  const direct = index.get(`${prefCode}|${normalized}`);
  if (direct) return direct;
  // 「○○郡△△町」のように郡名付きで書かれることがある
  const withoutCounty = normalized.replace(/^.+?郡/, '');
  return index.get(`${prefCode}|${withoutCounty}`) ?? null;
}

/** 1 つの PDF から別紙の行を読む。合計行（計画一覧のページ）はフレーム別の検証に使う */
async function extractRows(buffer: Buffer, index: Map<string, string>) {
  const require = createRequire(import.meta.url);
  const pdfBase = dirname(require.resolve('pdfjs-dist/package.json'));
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await getDocument({ data: new Uint8Array(buffer), cMapUrl: `${pdfBase}/cmaps/`, cMapPacked: true, standardFontDataUrl: `${pdfBase}/standard_fonts/`, isEvalSupported: false, verbosity: 0 }).promise;
  const rows: RoadAllocationRow[] = [];
  const frameTotals: Record<string, number> = {};
  const validation: string[] = [];
  let frame: Frame | null = null;
  let prefCode: string | null = null;
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const glyphs: Glyph[] = content.items.flatMap((item) => ('str' in item && item.str.trim() ? [{ s: item.str.trim(), x: item.transform[4], y: item.transform[5] }] : []));
      if (!prefCode) {
        // 表紙は「栃 木 県」と 1 字ずつ、2 ページ目以降は「(栃木県)」。どちらも都道府県名として引く
        const joined = glyphs.map((g) => g.s).join('').replace(/\s+/g, '');
        const pref = PREFECTURES.find((p) => joined.includes(`(${p.name})`) || joined.includes(`（${p.name}）`) || joined.startsWith(p.name + '道路局') || joined.startsWith(p.name));
        if (pref) prefCode = pref.code;
      }
      if (!prefCode) { validation.push(`p.${pageNumber}: 都道府県名を特定できません`); continue; }
      // フレーム（交付金の種類）は、計画一覧のページでは表の見出し「防災・安全交付金」「社会資本整備総合交付金」、
      // 別紙のページでは題名「○○交付金（道路分）」で決める。題名が無いページは直前のページのフレームを引き継ぐ
      const frameLabel = glyphs.find((g) => g.s === '防災・安全交付金' || g.s === '社会資本整備総合交付金');
      const planHeader = glyphs.find((g) => g.s === '計画策定主体');
      const isAppendix = glyphs.some((g) => g.s === '事業実施主体');
      // 計画一覧のページ（2 ページ目に続くときは列見出しが無く「合 計」だけのこともある）
      if (frameLabel && !isAppendix && (planHeader || glyphs.some((g) => g.s === '合'))) {
        frame = frameLabel.s as Frame;
        // 「合 計」行の想定国費
        const total = glyphs.find((g) => g.s === '計' && glyphs.some((h) => h.s === '合' && Math.abs(h.y - g.y) < 2));
        if (total) {
          const amount = glyphs.find((g) => Math.abs(g.y - total.y) < 2 && /^[\d,]+$/.test(g.s));
          if (amount) frameTotals[frame] = (frameTotals[frame] ?? 0) + Number(amount.s.replace(/,/g, '')) * 1000;
        }
        continue;
      }
      // 題名は上端 30pt 以内（令和5年度は「令和５年度 防災・安全交付金」、6年度以降は「…交付金（道路分）」）
      const title = glyphs.filter((g) => g.y > Math.max(...glyphs.map((h) => h.y)) - 30 && g.y > entityHeaderY(glyphs)).map((g) => g.s).join('');
      const titleFrame = title.match(/(防災・安全交付金|社会資本整備総合交付金)/);
      if (titleFrame) frame = titleFrame[1] as Frame;
      const entityHeader = glyphs.find((g) => g.s === '事業実施主体');
      const amountHeader = glyphs.find((g) => g.s === '想定国費');
      const routeHeader = glyphs.find((g) => g.s === '要素事業名等');
      if (!entityHeader || !amountHeader || !routeHeader) continue;
      if (!frame) { validation.push(`p.${pageNumber}: 別紙のフレーム（交付金の種類）を特定できません`); continue; }
      const lines = new Map<number, Glyph[]>();
      for (const g of glyphs) { const key = Math.round(g.y / 3) * 3; lines.set(key, [...(lines.get(key) ?? []), g]); }
      let planBuffer: string[] = [];
      let planName = '';
      for (const key of [...lines.keys()].sort((a, b) => b - a)) {
        const line = lines.get(key)!.sort((a, b) => a.x - b.x);
        if (line.some((g) => g.y >= entityHeader.y - 5)) continue; // 見出しより上
        const planText = line.filter((g) => g.x < routeHeader.x - 60).map((g) => g.s).join(''); // 計画名の列（要素事業名等の左）
        const entity = line.find((g) => Math.abs(g.x - entityHeader.x) < 12);
        const amount = line.find((g) => g.x > amountHeader.x - 20 && /^[\d,]+$/.test(g.s));
        if (planText) planBuffer.push(planText);
        if (!entity || !amount) continue;
        if (planBuffer.length) { planName = planBuffer.join(''); planBuffer = []; }
        const route = line.filter((g) => g.x >= routeHeader.x - 60 && g.x < entityHeader.x - 12).map((g) => g.s).join(' ');
        const amountYen = Number(amount.s.replace(/,/g, '')) * 1000;
        rows.push({ prefCode: prefCode!, frame, planName, route, entity: entity.s, code: resolveCode(prefCode!, entity.s, index), amountYen, page: pageNumber });
      }
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }
  // 別紙の合計は計画一覧の合計以下のはず（別紙が無い計画がある）
  for (const [name, total] of Object.entries(frameTotals)) {
    const sum = rows.filter((r) => r.frame === name).reduce((s, r) => s + r.amountYen, 0);
    if (sum > total * 1.001) validation.push(`${name}: 別紙の合計 ${sum} が計画一覧の合計 ${total} を超えています`);
  }
  const unresolved = [...new Set(rows.filter((r) => r.code === null).map((r) => r.entity))];
  if (unresolved.length) validation.push(`自治体コードを引けない事業実施主体: ${unresolved.join('、')}`);
  return { rows, frameTotals, validation, pages: pdf.numPages, prefCode };
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
  const onlyFy = option('--fy');
  const onlyPref = option('--pref');
  const index = loadNameIndex();
  mkdirSync(OUT_DIR, { recursive: true });
  for (const { fy, reiwa } of FISCAL_YEARS) {
    if (onlyFy && String(fy) !== onlyFy) continue;
    const outPath = join(OUT_DIR, `${fy}.json`);
    const previous: RoadAllocationFile | null = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf-8')) : null;
    const file: RoadAllocationFile = {
      fiscalYear: fy,
      generatedAt: new Date().toISOString(),
      source: {
        name: '国土交通省 道路局「令和' + reiwa + '年度 道路関係予算配分について（箇所表）」社会資本整備総合交付金の配分（道路分）',
        indexUrl: `https://www.mlit.go.jp/road/ir/ir-yosan/r${reiwa}yhai.html`,
        note: '想定国費は配分国費のうち道路分として想定される国費（千円を円に換算）。配分は整備計画単位で、個別事業への充当は自治体の裁量',
      },
      documents: [],
      rows: [],
    };
    for (const fileNumber of FILE_NUMBERS) {
      const url = pdfUrl(reiwa, fileNumber);
      if (onlyPref) { // 部分実行（--pref はファイル番号）では前回の結果を残す
        const prevDoc = previous?.documents.find((d) => d.url === url);
        if (fileNumber !== onlyPref) {
          if (prevDoc) { file.documents.push(prevDoc); file.rows.push(...(previous?.rows.filter((r) => r.prefCode === prevDoc.prefCode) ?? [])); }
          continue;
        }
      }
      const buffer = await fetchPdf(url, join(RAW_DIR, String(fy), `${fileNumber}.pdf`));
      const { rows, frameTotals, validation, pages, prefCode } = await extractRows(buffer, index);
      if (!prefCode) throw new Error(`都道府県を特定できません: ${url}`);
      if (file.documents.some((d) => d.prefCode === prefCode)) throw new Error(`同じ都道府県の PDF が 2 つあります: ${prefCode} ${url}`);
      file.documents.push({ prefCode, url, sha256: createHash('sha256').update(buffer).digest('hex'), pages, rows: rows.length, frameTotals, validation });
      file.rows.push(...rows);
      const name = PREFECTURES.find((p) => p.code === prefCode)?.name;
      console.log(`${fy} ${name}（ファイル ${fileNumber}）: ${rows.length} 行 ${validation.length ? '⚠ ' + validation.join(' / ') : ''}`);
    }
    if (!onlyPref && file.documents.length !== 47) throw new Error(`都道府県が 47 ではありません: ${file.documents.length}`);
    writeFileSync(outPath, JSON.stringify(file, null, 1));
    console.log(`→ ${outPath} (${file.rows.length} 行)`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
