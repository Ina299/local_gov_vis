/**
 * 道路分の想定国費の「説明の付きにくい減額」スコア（教師なしの異常検知）。
 *
 * 考え方: 自治体の配分の増減は、ふつう (1) 県全体・交付金ごとの増減、(2) 工区の完了・新規採択 で説明できる。
 * そこで
 *   - 両年度にある工区（継続工区）だけで比べて (2) を除き、
 *   - 同じ都道府県・同じ交付金の他の市区町村の増減（中央値）を期待値として (1) を除き、
 *   - 残差（自治体の log 比 − 期待値）を全国で頑健に標準化し、
 *   - 継続工区が一斉に減っているほど（工事の完了なら一部の工区しか減らない）、工区数が多いほど重くする。
 * スコアは 0 以上で、大きいほど「進捗や県全体の動きでは説明しにくい減額」。警報ではなく、原資料で理由を確かめる優先度。
 * 教師データ（政治的な配分と確定した事例）が数件しか無いので、精度は示せない。
 */
import type { RoadAllocationFile, RoadAllocationRow } from './import-road-allocations.js';

export interface AnomalyScore {
  code: string;
  prefCode: string;
  name: string;
  /** 全体（全工区）の想定国費 */
  prev: number;
  cur: number;
  /** 継続工区の合計 */
  contPrev: number;
  contCur: number;
  /** 継続工区の log(cur/prev) */
  logCont: number;
  /** 期待値: 同じ都道府県・交付金の他の市区町村の継続工区 log 比の中央値（交付金ごとに自治体の額で加重） */
  expected: number;
  residual: number;
  /** 残差の全国での頑健 z（中央値・MAD） */
  z: number;
  routes: number;
  decreased: number;
  /** 0 以上。大きいほど説明の付きにくい減額 */
  score: number;
  /** スコア順位（1 が最も説明しにくい）。score 0 は null */
  rank: number | null;
}

export interface PairResult { from: number; to: number; scores: AnomalyScore[]; n: number; mad: number }

const entityKey = (r: RoadAllocationRow) => r.code ?? `${r.prefCode}|${r.entity}`;
const routeKey = (r: RoadAllocationRow) => `${entityKey(r)}|${r.frame}|${r.route.replace(/\s+/g, '')}`;
const isMunicipality = (key: string) => /^\d{5}$/.test(key);
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

function routeTotals(file: RoadAllocationFile) {
  const routes = new Map<string, number>();
  const all = new Map<string, number>();
  const names = new Map<string, { name: string; prefCode: string }>();
  for (const r of file.rows) {
    const k = entityKey(r);
    routes.set(routeKey(r), (routes.get(routeKey(r)) ?? 0) + r.amountYen);
    all.set(k, (all.get(k) ?? 0) + r.amountYen);
    names.set(k, { name: r.entity, prefCode: r.prefCode });
  }
  return { routes, all, names };
}

export function scorePair(prevFile: RoadAllocationFile, curFile: RoadAllocationFile): PairResult {
  const a = routeTotals(prevFile), b = routeTotals(curFile);
  // 継続工区を自治体 × 交付金ごとに集計
  type Agg = { prev: number; cur: number; routes: number; decreased: number };
  const byEntityFrame = new Map<string, Map<string, Agg>>();
  for (const [rk, prev] of a.routes) {
    const cur = b.routes.get(rk); if (cur === undefined) continue;
    const [key, frame] = rk.split('|'); if (!isMunicipality(key)) continue;
    const frames = byEntityFrame.get(key) ?? new Map<string, Agg>();
    const agg = frames.get(frame) ?? { prev: 0, cur: 0, routes: 0, decreased: 0 };
    agg.prev += prev; agg.cur += cur; agg.routes += 1; if (cur < prev) agg.decreased += 1;
    frames.set(frame, agg); byEntityFrame.set(key, frames);
  }
  // 都道府県 × 交付金ごとの、市区町村の継続工区 log 比の一覧（期待値の材料）
  const pool = new Map<string, Array<{ key: string; log: number }>>();
  for (const [key, frames] of byEntityFrame) for (const [frame, agg] of frames) {
    if (agg.prev <= 0 || agg.cur <= 0) continue;
    const pk = `${key.slice(0, 2)}|${frame}`;
    pool.set(pk, [...(pool.get(pk) ?? []), { key, log: Math.log(agg.cur / agg.prev) }]);
  }
  const scores: AnomalyScore[] = [];
  for (const [key, frames] of byEntityFrame) {
    let contPrev = 0, contCur = 0, routes = 0, decreased = 0, expectedWeighted = 0, weight = 0;
    for (const [frame, agg] of frames) {
      contPrev += agg.prev; contCur += agg.cur; routes += agg.routes; decreased += agg.decreased;
      const others = (pool.get(`${key.slice(0, 2)}|${frame}`) ?? []).filter((p) => p.key !== key).map((p) => p.log);
      if (others.length >= 3 && agg.prev > 0) { expectedWeighted += median(others) * agg.prev; weight += agg.prev; }
    }
    if (contPrev <= 0 || contCur <= 0) continue;
    const logCont = Math.log(contCur / contPrev);
    const expected = weight > 0 ? expectedWeighted / weight : 0;
    const info = b.names.get(key) ?? a.names.get(key)!;
    scores.push({ code: key, prefCode: key.slice(0, 2), name: info.name, prev: a.all.get(key) ?? 0, cur: b.all.get(key) ?? 0,
      contPrev, contCur, logCont, expected, residual: logCont - expected, z: 0, routes, decreased, score: 0, rank: null });
  }
  // 頑健な標準化（中央値と MAD）
  const residuals = scores.map((s) => s.residual);
  const med = median(residuals);
  const mad = median(residuals.map((r) => Math.abs(r - med))) * 1.4826 || 1;
  for (const s of scores) {
    s.z = (s.residual - med) / mad;
    const coherence = s.decreased / s.routes; // 減った工区の割合
    const shrink = s.routes / (s.routes + 2); // 工区が少ない自治体は偶然で動くので割り引く
    s.score = Math.max(0, -s.z) * (0.5 + 0.5 * coherence) * shrink;
  }
  const ranked = scores.filter((s) => s.score > 0).sort((x, y) => y.score - x.score);
  ranked.forEach((s, i) => { s.rank = i + 1; });
  return { from: prevFile.fiscalYear, to: curFile.fiscalYear, scores, n: scores.length, mad };
}

/** 年度順に並んだファイルから、隣り合う年度ペアごとのスコア */
export function scoreAll(files: RoadAllocationFile[]): PairResult[] {
  const sorted = [...files].sort((x, y) => x.fiscalYear - y.fiscalYear);
  const out: PairResult[] = [];
  for (let i = 1; i < sorted.length; i++) out.push(scorePair(sorted[i - 1], sorted[i]));
  return out;
}
