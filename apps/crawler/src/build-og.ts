/**
 * OGP画像（apps/web/public/og.png, 1200×630）を生成する。
 * 実データのコロプレス（歳出・住民1人あたり・最新年度の5分位）を右側に描き、
 * 左側にタイトル・説明・凡例を置く。初期画面（未選択の全国ビュー）の縮図。
 *
 * 色はwebと同じ検証済みシーケンシャル青ランプ（apps/web/src/lib/choropleth.ts の
 * SEQUENTIAL_BLUES）・5分位ロジックを使う（クロスワークスペースimportを避けるため複製）。
 *
 * 実行: npm run -w @local-gov/crawler build:og （og.pngはコミットするため手動実行のみ）
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import { geoMercator, geoPath } from 'd3-geo';
import { Resvg } from '@resvg/resvg-js';
import type { LocalGovBudget } from './types/budget.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC = join(__dirname, '..', '..', '..', 'apps', 'web', 'public');

// apps/web/src/lib/choropleth.ts と同じ値・ロジック（凡例・塗りの見え方を揃える）
const SEQUENTIAL_BLUES = ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'];

function computeBreaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const quantiles = [0.2, 0.4, 0.6, 0.8].map((q) => {
    const pos = q * (sorted.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  });
  return Array.from(new Set(quantiles)).filter((b) => b > sorted[0]);
}

function classColor(value: number, breaks: number[]): string {
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  return SEQUENTIAL_BLUES[Math.round((i * (SEQUENTIAL_BLUES.length - 1)) / breaks.length)];
}

const W = 1200;
const H = 630;
const BG = '#1a1a2e';
const INK = '#ffffff';
const INK_MUTED = 'rgba(255,255,255,0.72)';
const FONT = "'Yu Gothic UI', 'Meiryo', sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function main(): void {
  const budgets: LocalGovBudget[] = JSON.parse(
    readFileSync(join(WEB_PUBLIC, 'budgets.json'), 'utf-8')
  );
  const latestYear = Math.max(...budgets.map((b) => b.fiscalYear));
  const perCapita = new Map<string, number>();
  for (const b of budgets) {
    if (b.fiscalYear === latestYear && b.population) {
      perCapita.set(b.code, b.totalExpenditure / b.population);
    }
  }
  const breaks = computeBreaks(Array.from(perCapita.values()));

  const topo = JSON.parse(
    readFileSync(join(WEB_PUBLIC, 'japan.topo.json'), 'utf-8')
  ) as Topology;
  const objName = Object.keys(topo.objects)[0];
  const fc = feature(
    topo,
    topo.objects[objName] as GeometryCollection<{ id: number | string }>
  ) as FeatureCollection<Geometry, { id: number | string }>;

  const codeOf = (f: (typeof fc.features)[number]): string =>
    String(f.properties.id).padStart(2, '0');
  const mainFeatures = fc.features.filter((f) => codeOf(f) !== '47');
  const okinawa = fc.features.filter((f) => codeOf(f) === '47');

  // 右パネルに本土、右下の海域（関東沖）に沖縄をそれぞれフィットさせる
  const mapRect: [[number, number], [number, number]] = [
    [640, 20],
    [W - 24, H - 24],
  ];
  const insetRect: [[number, number], [number, number]] = [
    [1030, 470],
    [1165, 585],
  ];

  const mainProj = geoMercator();
  mainProj.fitExtent(mapRect, { type: 'FeatureCollection', features: mainFeatures });
  const mainPath = geoPath(mainProj);

  // 沖縄は県全域（大東島・先島含む）にフィットさせると本島が点になるため、
  // 本島を中心に固定スケールで拡大し、枠外の離島はクリップして落とす
  const insetProj = geoMercator()
    .center([128.05, 26.4])
    .scale(5200)
    .translate([
      (insetRect[0][0] + insetRect[1][0]) / 2,
      (insetRect[0][1] + insetRect[1][1]) / 2,
    ])
    .clipExtent([
      [insetRect[0][0] - 8, insetRect[0][1] - 8],
      [insetRect[1][0] + 8, insetRect[1][1] + 8],
    ]);
  const insetPath = geoPath(insetProj);

  const fill = (f: (typeof fc.features)[number]): string => {
    const v = perCapita.get(codeOf(f));
    return v === undefined ? '#3a3a52' : classColor(v, breaks);
  };
  // 隣接する塗りの区切り（マーク間の背景色ギャップに相当）
  const stroke = `stroke="${BG}" stroke-width="1.2" stroke-linejoin="round"`;

  const mapSvg = [
    ...mainFeatures.map((f) => `<path d="${mainPath(f)}" fill="${fill(f)}" ${stroke}/>`),
    ...okinawa.map((f) => `<path d="${insetPath(f)}" fill="${fill(f)}" ${stroke}/>`),
    // 沖縄インセットの区切り線（左上を斜めに区切る慣例表現）
    `<polyline points="${insetRect[0][0] - 22},${insetRect[1][1] + 12} ${insetRect[0][0] - 22},${insetRect[0][1] - 6} ${insetRect[0][0] + 34},${insetRect[0][1] - 34}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>`,
  ].join('\n');

  // 凡例（淡→濃 = 少→多）
  const legendY = 476;
  const swatch = 34;
  const legendSvg = [
    `<text x="72" y="${legendY - 16}" font-family=${JSON.stringify(FONT)} font-size="21" fill="${INK_MUTED}">${esc(`歳出・住民1人あたり（${latestYear}年度決算）`)}</text>`,
    ...SEQUENTIAL_BLUES.map(
      (c, i) =>
        `<rect x="${72 + i * (swatch + 4)}" y="${legendY}" width="${swatch}" height="${swatch}" rx="5" fill="${c}"/>`
    ),
    `<text x="72" y="${legendY + swatch + 30}" font-family=${JSON.stringify(FONT)} font-size="19" fill="${INK_MUTED}">少ない</text>`,
    `<text x="${72 + 5 * (swatch + 4) - 4}" y="${legendY + swatch + 30}" text-anchor="end" font-family=${JSON.stringify(FONT)} font-size="19" fill="${INK_MUTED}">多い</text>`,
  ].join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${mapSvg}
  <!-- 地図と文字の重なり防止に左側へ薄いグラデーションを敷く -->
  <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0.38" stop-color="${BG}" stop-opacity="1"/>
    <stop offset="0.53" stop-color="${BG}" stop-opacity="0"/>
  </linearGradient>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <text x="72" y="196" font-family=${JSON.stringify(FONT)} font-size="64" font-weight="700" fill="${INK}">${esc('地方自治体予算マップ')}</text>
  <text x="72" y="266" font-family=${JSON.stringify(FONT)} font-size="27" fill="${INK_MUTED}">${esc('あなたの町の税金は、どこから来て')}</text>
  <text x="72" y="306" font-family=${JSON.stringify(FONT)} font-size="27" fill="${INK_MUTED}">${esc('何に使われたのか。')}</text>
  <text x="72" y="368" font-family=${JSON.stringify(FONT)} font-size="24" fill="${INK}">${esc('47都道府県・約1,700市区町村の決算を可視化')}</text>
  ${legendSvg}
</svg>`;

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: true, defaultFontFamily: 'Yu Gothic UI' },
    background: BG,
  });
  const png = resvg.render().asPng();
  writeFileSync(join(WEB_PUBLIC, 'og.png'), png);
  console.log(`og.png を生成しました（${latestYear}年度・${perCapita.size}団体・${png.length}バイト）`);
}

main();
