/**
 * 道路分の想定国費（import-road-allocations.ts の出力）を市区町村ごとに年度比較し、
 * 「説明の付きにくい減額」の候補を全国で順位付けする検証スクリプト。
 *
 * 考え方（異常検知の文脈。警報ではなく要確認リストを作る）:
 *   1) 全体: 市区町村の想定国費合計の log(当年度 / 前年度) を全国分布で標準化（z）。
 *   2) 継続工区だけ: 両年度に同じ要素事業名等（路線・工区）がある工区に限って比べ、完了・新規採択の影響を除く。
 *   3) 一斉性: 継続工区のうち減った工区の割合。工事の完了なら減るのは一部の工区で、自治体内で一斉には減らない。
 *   減額の自治体は毎年一定数あるので、順位は「原資料で理由を確かめる優先度」であって、圧力の証拠ではない。
 *
 * 出力: apps/crawler/output/road-allocations/report.md（年度ペアごとに下位 30 件と注目自治体の位置）
 * 実行: npm run -w @local-gov/crawler analyze:road-allocations [--focus 09215,09411,09213,09407]
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PREFECTURES } from './data/prefectures.js';
import type { RoadAllocationFile, RoadAllocationRow } from './import-road-allocations.js';
import { scorePair } from './road-allocation-score.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const DATA_DIR = join(REPO_ROOT, 'data', 'road-allocations');
const OUT_DIR = join(REPO_ROOT, 'apps', 'crawler', 'output', 'road-allocations');
const SEARCH_INDEX = join(REPO_ROOT, 'apps', 'web', 'public', 'search-index.json');

/** 事業実施主体の鍵。コードが引けたらコード、引けなければ都道府県と原文 */
const entityKey = (r: RoadAllocationRow) => r.code ?? `${r.prefCode}|${r.entity}`;
const routeKey = (r: RoadAllocationRow) => `${entityKey(r)}|${r.frame}|${r.route.replace(/\s+/g, '')}`;
const isMunicipality = (key: string) => /^\d{5}$/.test(key);
const oku = (yen: number) => (yen / 1e8).toFixed(2);

interface YearTotals { all: Map<string, number>; routes: Map<string, number>; entityOf: Map<string, { name: string; prefCode: string }> }

function totalsOf(file: RoadAllocationFile): YearTotals {
  const all = new Map<string, number>(); const routes = new Map<string, number>(); const entityOf = new Map<string, { name: string; prefCode: string }>();
  for (const r of file.rows) {
    const k = entityKey(r);
    all.set(k, (all.get(k) ?? 0) + r.amountYen);
    routes.set(routeKey(r), (routes.get(routeKey(r)) ?? 0) + r.amountYen);
    entityOf.set(k, { name: r.entity, prefCode: r.prefCode });
  }
  return { all, routes, entityOf };
}

interface Score { key: string; name: string; pref: string; prev: number; cur: number; logAll: number; zAll: number; contPrev: number; contCur: number; logCont: number | null; zCont: number | null; routes: number; decreased: number }

function zscores(values: Map<string, number>): { mean: number; sd: number } {
  const v = [...values.values()]; const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, v.length - 1));
  return { mean, sd };
}

function compare(prev: YearTotals, cur: YearTotals): { scores: Score[]; stats: { n: number; sdAll: number; nCont: number; sdCont: number } } {
  const keys = [...new Set([...prev.all.keys(), ...cur.all.keys()])].filter(isMunicipality).filter((k) => (prev.all.get(k) ?? 0) > 0 && (cur.all.get(k) ?? 0) > 0);
  const logAll = new Map(keys.map((k) => [k, Math.log(cur.all.get(k)! / prev.all.get(k)!)]));
  const contPrev = new Map<string, number>(); const contCur = new Map<string, number>(); const routes = new Map<string, number>(); const decreased = new Map<string, number>();
  for (const [rk, a] of prev.routes) {
    const b = cur.routes.get(rk); if (b === undefined) continue;
    const k = rk.split('|')[0]; if (!isMunicipality(k)) continue;
    contPrev.set(k, (contPrev.get(k) ?? 0) + a); contCur.set(k, (contCur.get(k) ?? 0) + b);
    routes.set(k, (routes.get(k) ?? 0) + 1); if (b < a) decreased.set(k, (decreased.get(k) ?? 0) + 1);
  }
  const logCont = new Map<string, number>();
  for (const [k, a] of contPrev) { const b = contCur.get(k)!; if (a > 0 && b > 0) logCont.set(k, Math.log(b / a)); }
  const sAll = zscores(logAll); const sCont = zscores(logCont);
  const prefName = (code: string) => PREFECTURES.find((p) => p.code === code.slice(0, 2))?.name ?? code.slice(0, 2);
  const scores: Score[] = keys.map((k) => ({
    key: k, name: cur.entityOf.get(k)?.name ?? prev.entityOf.get(k)?.name ?? k, pref: prefName(k),
    prev: prev.all.get(k)!, cur: cur.all.get(k)!, logAll: logAll.get(k)!, zAll: (logAll.get(k)! - sAll.mean) / sAll.sd,
    contPrev: contPrev.get(k) ?? 0, contCur: contCur.get(k) ?? 0,
    logCont: logCont.get(k) ?? null, zCont: logCont.has(k) ? (logCont.get(k)! - sCont.mean) / sCont.sd : null,
    routes: routes.get(k) ?? 0, decreased: decreased.get(k) ?? 0,
  }));
  return { scores, stats: { n: keys.length, sdAll: sAll.sd, nCont: logCont.size, sdCont: sCont.sd } };
}

const pct = (log: number | null) => (log === null ? '—' : `${Math.round((Math.exp(log) - 1) * 100)}%`);
const z = (v: number | null) => (v === null ? '—' : v.toFixed(2));

function main() {
  const args = process.argv.slice(2);
  const focusArg = args[args.indexOf('--focus') + 1];
  const focus = (args.includes('--focus') && focusArg ? focusArg : '09215,09411,09213,09407,09301').split(',');
  const names = new Map((JSON.parse(readFileSync(SEARCH_INDEX, 'utf-8')) as Array<{ code: string; name: string }>).map((i) => [i.code, i.name]));
  const files = readdirSync(DATA_DIR).filter((f) => /^\d{4}\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(join(DATA_DIR, f), 'utf-8')) as RoadAllocationFile);
  const totals = files.map((f) => ({ fy: f.fiscalYear, t: totalsOf(f), prefs: f.documents.length, rows: f.rows.length }));
  const out: string[] = ['# 道路分の想定国費: 市区町村別の年度比較（検証）', '', `生成: ${new Date().toISOString()}`, '',
    '出典: 国土交通省 道路局 都道府県別 箇所表「社会資本整備総合交付金の配分（道路分）」別紙（防災・安全交付金＋社会資本整備総合交付金）。想定国費は配分国費のうち道路分として想定される国費で、配分そのものではない。', '',
    '| 年度 | 都道府県数 | 行数 |', '|---|---|---|', ...totals.map((t) => `| ${t.fy} | ${t.prefs} | ${t.rows} |`), ''];
  for (let i = 1; i < totals.length; i++) {
    const a = totals[i - 1], b = totals[i];
    const { scores, stats } = compare(a.t, b.t);
    const ranked = [...scores].sort((x, y) => x.logAll - y.logAll);
    const rankedCont = scores.filter((s) => s.zCont !== null).sort((x, y) => x.logCont! - y.logCont!);
    out.push(`## ${a.fy}年度 → ${b.fy}年度`, '',
      `両年度に想定国費のある市区町村 ${stats.n}（log 比の σ = ${stats.sdAll.toFixed(2)}）、継続工区で比べられる市区町村 ${stats.nCont}（σ = ${stats.sdCont.toFixed(2)}）。`, '',
      '### 注目自治体の位置', '', '| 自治体 | 前年度 | 当年度 | 増減 | z | 全国順位（減少側から） | 継続工区の増減 | z（継続） | 順位（継続） | 減った工区 |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const code of focus) {
      const s = scores.find((x) => x.key === code);
      if (!s) { out.push(`| ${names.get(code) ?? code} | — | — | 両年度の記載なし | | | | | | |`); continue; }
      const rank = ranked.indexOf(s) + 1; const rankCont = s.zCont === null ? '—' : String(rankedCont.indexOf(s) + 1);
      out.push(`| ${s.name}（${s.pref}） | ${oku(s.prev)}億 | ${oku(s.cur)}億 | ${pct(s.logAll)} | ${z(s.zAll)} | ${rank} / ${stats.n} | ${pct(s.logCont)} | ${z(s.zCont)} | ${rankCont} / ${stats.nCont} | ${s.decreased}/${s.routes} |`);
    }
    out.push('', '### 減少が大きい市区町村（全体・下位 30）', '', '| # | 自治体 | 前年度 | 当年度 | 増減 | z | 継続工区の増減 | 減った工区 |', '|---|---|---|---|---|---|---|---|');
    ranked.slice(0, 30).forEach((s, idx) => out.push(`| ${idx + 1} | ${s.name}（${s.pref}） | ${oku(s.prev)}億 | ${oku(s.cur)}億 | ${pct(s.logAll)} | ${z(s.zAll)} | ${pct(s.logCont)} | ${s.decreased}/${s.routes} |`));
    out.push('', '### 継続工区だけで減少が大きく、工区が一斉に減っている市区町村（継続工区 2 以上・8 割以上が減少・下位 30）', '', '| # | 自治体 | 継続工区 前年度 | 当年度 | 増減 | z（継続） | 減った工区 | 全体の増減 |', '|---|---|---|---|---|---|---|---|');
    rankedCont.filter((s) => s.routes >= 2 && s.decreased / s.routes >= 0.8).slice(0, 30).forEach((s, idx) => out.push(`| ${idx + 1} | ${s.name}（${s.pref}） | ${oku(s.contPrev)}億 | ${oku(s.contCur)}億 | ${pct(s.logCont)} | ${z(s.zCont)} | ${s.decreased}/${s.routes} | ${pct(s.logAll)} |`));
    // 残差モデル（road-allocation-score.ts）
    const pair = scorePair(files[i - 1], files[i]);
    const prefName = (code: string) => PREFECTURES.find((p) => p.code === code)?.name ?? code;
    const byScore = pair.scores.filter((s) => s.rank !== null).sort((x, y) => x.rank! - y.rank!);
    out.push('', `### 残差モデルのスコア（継続工区の増減 − 同じ県・同じ交付金の他市区町村の中央値。残差を頑健 z 化し、一斉減と工区数で重み付け。対象 ${pair.n} 市区町村）`, '',
      '| 順位 | 自治体 | 継続工区 前年度 | 当年度 | 増減 | 県内の期待値 | 残差 z | 減った工区 | スコア |', '|---|---|---|---|---|---|---|---|---|');
    const line = (s: (typeof byScore)[number]) => `| ${s.rank ?? '—'} | ${s.name}（${prefName(s.prefCode)}） | ${oku(s.contPrev)}億 | ${oku(s.contCur)}億 | ${pct(s.logCont)} | ${pct(s.expected)} | ${s.z.toFixed(2)} | ${s.decreased}/${s.routes} | ${s.score.toFixed(2)} |`;
    byScore.slice(0, 30).forEach((s) => out.push(line(s)));
    out.push('', '注目自治体:', '');
    for (const code of focus) { const s = pair.scores.find((x) => x.code === code); out.push(s ? line(s) : `| — | ${names.get(code) ?? code} | 両年度の継続工区なし | | | | | | |`); }
    out.push('');
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, 'report.md');
  writeFileSync(path, out.join('\n'));
  console.log(out.join('\n'));
  console.log(`\n→ ${path}`);
}

main();
