/**
 * OGP画像（1200×630）を生成する。
 * - apps/web/public/og.png: トップ用。歳出・住民1人あたり・最新年度のコロプレス＋タイトル
 * - apps/web/public/og/{指標}.png: 指標別共有ページ（/m/{指標}/）用。各指標のコロプレス＋指標名・説明
 *
 * 値の計算・色分けはwebと同一にするため、apps/web/src/lib の metrics.ts / choropleth.ts を
 * 直接import（tsconfigの "@/*" → ../web/src/* エイリアス経由）する。
 *
 * 実行: npm run -w @local-gov/crawler build:og （PNGはコミットするため手動実行のみ）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import { geoMercator, geoPath } from 'd3-geo';
import { Resvg } from '@resvg/resvg-js';
// webはCJS扱い（package.jsonにtype:moduleなし）のため、名前付きimportは
// ESM interopで失敗することがある。名前空間importで受けて分割代入する
import * as metricsLib from '../../web/src/lib/metrics';
import * as choropleth from '../../web/src/lib/choropleth';
import type { MetricDef } from '../../web/src/lib/metrics';
import type { LocalGovBudget } from '../../web/src/types/budget';

const { METRICS, metricValue, metricDisplayLabel } = ((metricsLib as { default?: unknown })
  .default ?? metricsLib) as typeof metricsLib;
const {
  SEQUENTIAL_BLUES,
  rampFor,
  computeBreaks,
  getClassColor,
  computeSignedBreaks,
  getDivergingColor,
  DIVERGING_NEG,
  DIVERGING_POS,
} = ((choropleth as { default?: unknown }).default ?? choropleth) as typeof choropleth;

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC = join(__dirname, '..', '..', '..', 'apps', 'web', 'public');

const W = 1200;
const H = 630;
const BG = '#1a1a2e';
const INK = '#ffffff';
const INK_MUTED = 'rgba(255,255,255,0.72)';
// OGPではデータなしをwebのマゼンタではなく背景に馴染む無彩色にする（カードとして見た時の破綻防止）
const NO_DATA_FILL = '#3a3a52';
const FONT = "'Yu Gothic UI', 'Meiryo', sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 日本語テキストを固定文字数で折り返す（禁則処理なしの単純分割で十分） */
function wrapJa(text: string, perLine: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < text.length && lines.length < maxLines; i += perLine) {
    lines.push(text.slice(i, i + perLine));
  }
  if (text.length > perLine * maxLines) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, perLine - 1)}…`;
  }
  return lines;
}

interface TextLine {
  text: string;
  y: number;
  size: number;
  fill: string;
  weight?: number;
}

interface Legend {
  label: string;
  colors: string[];
  left: string;
  right: string;
}

function main(): void {
  const budgets: LocalGovBudget[] = JSON.parse(
    readFileSync(join(WEB_PUBLIC, 'budgets.json'), 'utf-8')
  );
  const years = Array.from(new Set(budgets.map((b) => b.fiscalYear))).sort((a, b) => b - a);

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

  // 隣接する塗りの区切り（マーク間の背景色ギャップに相当）
  const stroke = `stroke="${BG}" stroke-width="1.2" stroke-linejoin="round"`;

  function renderMapSvg(colorOf: (code: string) => string): string {
    return [
      ...mainFeatures.map(
        (f) => `<path d="${mainPath(f)}" fill="${colorOf(codeOf(f))}" ${stroke}/>`
      ),
      ...okinawa.map(
        (f) => `<path d="${insetPath(f)}" fill="${colorOf(codeOf(f))}" ${stroke}/>`
      ),
      // 沖縄インセットの区切り線（左上を斜めに区切る慣例表現）
      `<polyline points="${insetRect[0][0] - 22},${insetRect[1][1] + 12} ${insetRect[0][0] - 22},${insetRect[0][1] - 6} ${insetRect[0][0] + 34},${insetRect[0][1] - 34}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>`,
    ].join('\n');
  }

  function renderCard(opts: {
    mapSvg: string;
    title: string;
    lines: TextLine[];
    legend: Legend;
  }): Buffer {
    const legendY = 476;
    const swatch = 34;
    const swatchEnd = 72 + opts.legend.colors.length * (swatch + 4) - 4;
    const legendSvg = [
      `<text x="72" y="${legendY - 16}" font-family=${JSON.stringify(FONT)} font-size="21" fill="${INK_MUTED}">${esc(opts.legend.label)}</text>`,
      ...opts.legend.colors.map(
        (c, i) =>
          `<rect x="${72 + i * (swatch + 4)}" y="${legendY}" width="${swatch}" height="${swatch}" rx="5" fill="${c}"/>`
      ),
      `<text x="72" y="${legendY + swatch + 30}" font-family=${JSON.stringify(FONT)} font-size="19" fill="${INK_MUTED}">${esc(opts.legend.left)}</text>`,
      `<text x="${swatchEnd}" y="${legendY + swatch + 30}" text-anchor="end" font-family=${JSON.stringify(FONT)} font-size="19" fill="${INK_MUTED}">${esc(opts.legend.right)}</text>`,
    ].join('\n');

    const linesSvg = opts.lines
      .map(
        (l) =>
          `<text x="72" y="${l.y}" font-family=${JSON.stringify(FONT)} font-size="${l.size}"${l.weight ? ` font-weight="${l.weight}"` : ''} fill="${l.fill}">${esc(l.text)}</text>`
      )
      .join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${opts.mapSvg}
  <!-- 地図と文字の重なり防止に左側へ薄いグラデーションを敷く -->
  <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0.38" stop-color="${BG}" stop-opacity="1"/>
    <stop offset="0.53" stop-color="${BG}" stop-opacity="0"/>
  </linearGradient>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <text x="72" y="196" font-family=${JSON.stringify(FONT)} font-size="64" font-weight="700" fill="${INK}">${esc(opts.title)}</text>
  ${linesSvg}
  ${legendSvg}
</svg>`;

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: W },
      font: { loadSystemFonts: true, defaultFontFamily: 'Yu Gothic UI' },
      background: BG,
    });
    return resvg.render().asPng();
  }

  /**
   * 指標の年度別値（都道府県コード→値）を計算し、最も新しく揃っている年度を選ぶ。
   * 公表が遅れる統計（maxYear相当）はデータの有無で自然に古い年度へフォールバックする
   */
  function pickValues(def: MetricDef): { year: number; values: Map<string, number> } | null {
    let best: { year: number; values: Map<string, number> } | null = null;
    for (const year of years) {
      const values = new Map<string, number>();
      for (const b of budgets) {
        if (b.fiscalYear !== year) continue;
        const v = metricValue(b, def.key, 'perCapita');
        if (v !== null) values.set(b.code, v);
      }
      if (values.size >= 40) return { year, values };
      if (values.size > 0 && (!best || values.size > best.values.size)) best = { year, values };
    }
    return best;
  }

  // --- トップ用 og.png（歳出・住民1人あたり・最新年度） ---
  const expDef = METRICS.find((m) => m.key === 'expenditure')!;
  const exp = pickValues(expDef)!;
  const expBreaks = computeBreaks(Array.from(exp.values.values()));
  const ogPng = renderCard({
    mapSvg: renderMapSvg((code) => {
      const v = exp.values.get(code);
      return v === undefined ? NO_DATA_FILL : getClassColor(v, expBreaks, false, SEQUENTIAL_BLUES);
    }),
    title: '地方自治体予算マップ',
    lines: [
      { text: 'あなたの町の税金は、どこから来て', y: 266, size: 27, fill: INK_MUTED },
      { text: '何に使われたのか。', y: 306, size: 27, fill: INK_MUTED },
      { text: '47都道府県・約1,700市区町村の決算を可視化', y: 368, size: 24, fill: INK },
    ],
    legend: {
      label: `歳出・住民1人あたり（${exp.year}年度決算）`,
      colors: SEQUENTIAL_BLUES,
      left: '少ない',
      right: '多い',
    },
  });
  writeFileSync(join(WEB_PUBLIC, 'og.png'), ogPng);
  console.log(`og.png を生成しました（${exp.year}年度・${exp.values.size}団体・${ogPng.length}バイト）`);

  // --- 指標別 og/{指標}.png（/m/{指標}/ 用。デフォルト指標の歳出はトップと同じため除く） ---
  const ogDir = join(WEB_PUBLIC, 'og');
  mkdirSync(ogDir, { recursive: true });
  let totalBytes = 0;
  let count = 0;
  for (const def of METRICS) {
    if (def.key === 'expenditure') continue;
    const picked = pickValues(def);
    if (!picked) {
      console.warn(`skip ${def.key}: 都道府県データなし`);
      continue;
    }
    const { year, values } = picked;
    const vals = Array.from(values.values());

    let colorOf: (code: string) => string;
    let legendColors: string[];
    let legendLeft: string;
    let legendRight: string;
    if (def.kind === 'change') {
      // 増減数は0を中心にした発散配色（webと同じ）
      const signed = computeSignedBreaks(vals);
      legendColors = [...DIVERGING_NEG, ...DIVERGING_POS];
      legendLeft = '減少';
      legendRight = '増加';
      colorOf = (code) => {
        const v = values.get(code);
        return v === undefined ? NO_DATA_FILL : getDivergingColor(v, signed);
      };
    } else {
      const ramp = rampFor(def.key);
      const breaks = computeBreaks(vals);
      const invert = def.invertColor ?? false;
      legendColors = ramp;
      // 指数・割合は「低い/高い」、それ以外の量は「少ない/多い」。反転指標は淡＝高い
      const [lo, hi] =
        def.kind === 'index' || def.kind === 'ratio' ? ['低い', '高い'] : ['少ない', '多い'];
      legendLeft = invert ? hi : lo;
      legendRight = invert ? lo : hi;
      colorOf = (code) => {
        const v = values.get(code);
        return v === undefined ? NO_DATA_FILL : getClassColor(v, breaks, invert, ramp);
      };
    }

    const descLines = wrapJa(def.description ?? '', 20, 3);
    const yearText = def.yearIndependent ? '' : `（${year}年度）`;
    const png = renderCard({
      mapSvg: renderMapSvg(colorOf),
      title: def.label,
      lines: [
        { text: '地方自治体予算マップ', y: 252, size: 24, fill: INK },
        ...descLines.map((text, i) => ({
          text,
          y: 316 + i * 36,
          size: 22,
          fill: INK_MUTED,
        })),
      ],
      legend: {
        label: `${metricDisplayLabel(def.key, 'perCapita')}${yearText}`,
        colors: legendColors,
        left: legendLeft,
        right: legendRight,
      },
    });
    writeFileSync(join(ogDir, `${def.key}.png`), png);
    totalBytes += png.length;
    count++;
  }
  console.log(`og/*.png を${count}枚生成しました（合計${Math.round(totalBytes / 1024)}KB）`);
}

main();
