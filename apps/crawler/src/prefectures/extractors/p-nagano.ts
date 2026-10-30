/**
 * 長野県 事業改善シート（令和６年度実施事業分、■点検。1事業1PDF）の事業番号・事業名・部局/課・「６ 事業コスト」表。
 *
 * 事業コスト表（千円）は R6/R5/R4 年度の行 × 列（予算額: 前年度繰越／当初予算／補正予算等／合計（予算現額）／うち一般財源、決算額、職員数）。
 * 抽出テキストでは行の値がとぎれとぎれに出力されるため、次の条件で年度ごとに確定できた値だけを収録する:
 *  - 「R6年度」等の直後に連続する3値（繰越・当初・補正）の和が、続いて（または後方に1回だけ）現れる値と一致する → 合計（予算現額）;
 *  - 合計の直後に「一般財源・決算額・職員数（小数）」が続く、または（R6年度のみ）R5年度の合計の直前に
 *    「一般財源・決算額・職員数」が並ぶ配置のとき、その決算額を採る。決算額≦合計・一般財源≦合計を満たす場合のみ。
 * 収録する金額: 合計（予算現額＝前年度繰越＋当初予算＋補正予算等）を budget、決算額を actual。0 は収録しない。
 * 細事業一覧の決算額、成果指標、政策評価報告書（施策単位）は対象外。
 */
import type { EvaluationAmount, ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const CODE = '20000';
const SHEET = '事業改善シート（令和６年度実施事業分）';
const YEARS: Record<string, number> = { R6: 2024, R5: 2023, R4: 2022 };

type Tok = { t: 'year' | 'int' | 'dec' | 'label'; raw: string; v: number; at: number };

function tokens(text: string, base: number): Tok[] {
  const out: Tok[] = [];
  let off = 0;
  for (const line of text.split('\n')) {
    const s = line.trim(), lead = line.indexOf(s);
    if (s) {
      const y = /^(R[4-6])年度$/.exec(s);
      if (y) out.push({ t: 'year', raw: s, v: YEARS[y[1]], at: base + off + lead });
      else if (/^(?:(?:△\s?)?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[-ー－])(?:\s+(?:(?:△\s?)?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[-ー－]))*$/.test(s)) {
        for (const m of s.matchAll(/(?:△\s?)?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[-ー－]/g)) {
          const raw = m[0], at = base + off + lead + m.index!;
          if (/^[-ー－]$/.test(raw)) out.push({ t: 'label', raw, v: NaN, at });
          else if (raw.includes('.')) out.push({ t: 'dec', raw, v: Number(raw), at });
          else out.push({ t: 'int', raw, v: (raw.startsWith('△') ? -1 : 1) * Number(raw.replace(/[△\s,]/g, '')), at });
        }
      } else out.push({ t: 'label', raw: s, v: NaN, at: base + off + lead });
    }
    off += line.length + 1;
  }
  return out;
}

type Row = { fy: number; sumIdx: number; actualIdx: number | null; firstIdx: number; lastIdx: number };

/** 事業コスト表の年度行を確定する。 */
function costRows(toks: Tok[]): { rows: Row[]; notes: string[] } {
  const notes: string[] = [];
  const isSum = (i: number) => toks[i]?.t === 'int';
  const tail = (i: number) => toks[i]?.t === 'int' && toks[i + 1]?.t === 'int' && toks[i + 2]?.t === 'dec';
  const rows: Row[] = [];
  for (const [fyIdx, y] of toks.entries()) {
    if (y.t !== 'year') continue;
    const [a, b, c] = [toks[fyIdx + 1], toks[fyIdx + 2], toks[fyIdx + 3]];
    if (![a, b, c].every(x => x?.t === 'int')) continue;
    const S = a.v + b.v + c.v;
    if (S <= 0) continue;
    // 直後（「合計」「（予算現額）」ラベルのみ挟む）に合計がある場合
    let j = fyIdx + 4;
    while (toks[j]?.t === 'label' && /^(?:合計|（予算現額）)$/.test(toks[j].raw)) j++;
    let sumIdx = -1;
    if (isSum(j) && toks[j].v === S) sumIdx = j;
    else {
      // 後方で合計値の直後に一般財源・決算額・職員数が並ぶ箇所が1つだけ
      const hits = toks.map((t, i) => i).filter(i => i > fyIdx + 3 && toks[i].t === 'int' && toks[i].v === S && tail(i + 1));
      if (hits.length === 1) sumIdx = hits[0];
    }
    if (sumIdx < 0) continue;
    if (rows.some(r => r.fy === y.v)) return { rows: [], notes: ['同じ年度の行が複数読めるため事業コストは未収録。'] };
    let actualIdx: number | null = null;
    let k = sumIdx + 1;
    while (toks[k]?.t === 'label' && toks[k].raw === 'うち一般財源') k++;
    if (tail(k)) actualIdx = k + 1;
    rows.push({ fy: y.v, sumIdx, actualIdx, firstIdx: fyIdx, lastIdx: actualIdx !== null ? actualIdx + 1 : sumIdx });
  }
  // R6年度: 合計の直後に値がない配置では、R5年度の合計の直前の「一般財源・決算額・職員数」を R6 の値とする。
  const r6 = rows.find(r => r.fy === 2024), r5 = rows.find(r => r.fy === 2023);
  if (r6 && r6.actualIdx === null && r5 && r5.sumIdx > r6.sumIdx && toks[r6.sumIdx + 1]?.t === 'year') {
    const i = r5.sumIdx - 3;
    if (tail(i) && toks[i - 1]?.t === 'label') { r6.actualIdx = i + 1; r6.lastIdx = i + 2; }
  }
  // 「うち一般財源」の直後に「一般財源・決算額・職員数」が3組続く配置: 見出しの行順（R6・R5・R4）に対応させる。
  const allTails = toks.map((_, i) => i).filter(i => tail(i));
  for (const [li, l] of toks.entries()) {
    if (l.t !== 'label' || l.raw !== 'うち一般財源' || !tail(li + 1) || !tail(li + 4) || !tail(li + 7) || toks[li + 10]?.t === 'int') continue;
    if (allTails.length !== 3) break;
    [2024, 2023, 2022].forEach((fy, n) => {
      const r = rows.find(x => x.fy === fy);
      if (r && r.actualIdx === null && !rows.some(x => x.actualIdx === li + 2 + 3 * n)) { r.actualIdx = li + 2 + 3 * n; r.lastIdx = li + 3 + 3 * n; }
    });
  }
  // 「一般財源・決算額・職員数」の組が表全体で3組だけあり、R5・R4 年度が2組を占めるとき、残る1組を R6 年度とする。
  if (r6 && r6.actualIdx === null && allTails.length === 3) {
    const free = allTails.filter(i => !rows.some(r => r.actualIdx === i + 1));
    if (free.length === 1 && rows.filter(r => r.fy !== 2024 && r.actualIdx !== null).length === 2 && toks[free[0] - 1]?.t === 'label') {
      r6.actualIdx = free[0] + 1; r6.lastIdx = free[0] + 2;
    }
  }
  return { rows, notes };
}

/**
 * 列ごとに出力される配置（「R6年度 R5年度 R4年度」の見出しが続き、各欄の3値が欄名の後に並ぶ）。
 * 繰越3値＋当初3値の後に「補正予算等」3値、「（予算現額）」3値、「うち一般財源」3値、「決算額」3値。行ごとの和の検算が合う場合のみ。
 */
function columnRows(toks: Tok[], yearHeader: boolean): { fy: number; sum: Tok; actual: Tok }[] | null {
  if (!yearHeader) return null;
  const after = (label: string, n: number) => {
    const i = toks.findIndex(t => t.t === 'label' && t.raw === label);
    return i >= 0 && toks.slice(i + 1, i + 1 + n).every(t => t.t === 'int') ? toks.slice(i + 1, i + 1 + n) : null;
  };
  const hosei = toks.findIndex(t => t.t === 'label' && t.raw === '補正予算等');
  const ab = hosei >= 6 ? toks.slice(hosei - 6, hosei) : [];
  const c = after('補正予算等', 3), d = after('（予算現額）', 3), k = after('決算額', 3), g = after('うち一般財源', 3);
  if (ab.length !== 6 || !ab.every(t => t.t === 'int') || toks[hosei - 7]?.raw !== '当初予算' || !c || !d || !k || !g) return null;
  const out = [];
  for (let i = 0; i < 3; i++) {
    if (ab[i].v + ab[i + 3].v + c[i].v !== d[i].v || d[i].v <= 0 || k[i].v > d[i].v || g[i].v > d[i].v) return null;
    out.push({ fy: 2024 - i, sum: d[i], actual: k[i] });
  }
  return out;
}

function extractOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== CODE || !input.text.includes(SHEET)) return [];
  const t = input.text;
  const codeM = /事業番号\n(?:事 業 名\n)?\n(\d{2} \d{2} \d{2})\n/.exec(t);
  if (!codeM) return [];
  const codes = new Set([...t.matchAll(/事業番号\n(?:事 業 名\n)?\n(\d{2} \d{2} \d{2})\n/g)].map(m => m[1]));
  if (codes.size !== 1) return [];
  // 事業名: シート見出し「■点検」の後の事業名欄（複数ページで一致するもの）
  const names: { s: string; at: number }[] = [];
  for (const re of [/■点検\n部局\n\n([^\n]+)\n/g, /■点検\n\n([^\n]+)\n\n部局\n/g, /\n([^\n]*事業[^\n]*?) 実施期間/g]) {
    for (const m of t.matchAll(re)) {
      const s = m[1].trim();
      if (!s || /課・室|部局|実施期間|□|■/.test(s)) continue;
      names.push({ s, at: m.index! + m[0].indexOf(m[1]) });
    }
  }
  const nameSet = new Set(names.map(n => nfkc(n.s)));
  if (nameSet.size !== 1) return [];
  const name = names[0];
  const code = codeM[1];
  const p = project(input, code, name.s, null, code, codeM.index + codeM[0].indexOf(code));
  p.evidence.push(evidence(input, name.s, name.at));
  const sheetAt = t.indexOf(SHEET);
  p.evidence.push(evidence(input, SHEET, sheetAt));
  p.evaluatedFiscalYear = 2024;

  // 部局・課
  const depts = new Map<string, { raw: string; at: number }>();
  const bus = new Set<string>();
  for (const m of t.matchAll(/(\S+部) 課・室(?: ([^\n]+)\n|\n\n([^\n]+)\n)/g)) {
    bus.add(m[1]);
    const ka = (m[2] ?? m[3]).trim();
    if (/^[^\s\d]+(?:課|室|局)$/.test(ka) && !/年度|実施期間|予算/.test(ka)) depts.set(`${m[1]} ${ka}`, { raw: m[0].replace(/\n+$/, ''), at: m.index! });
  }
  if (depts.size === 1 && bus.size === 1) {
    const [[d, ev]] = [...depts];
    p.department = d; p.evidence.push(evidence(input, ev.raw, ev.at));
  } else if (bus.size === 1) {
    const [bu] = [...bus];
    const m = new RegExp(`${bu} 課・室`).exec(t)!;
    p.department = bu; p.evidence.push(evidence(input, m[0], m.index));
    p.warnings.push('課・室欄の値が抽出テキストで一意に読めないため部局のみ収録。');
  } else p.warnings.push('部局・課の欄が一意に読めないため未収録。');

  // 事業コスト
  const s0 = t.indexOf('６ 事業コスト');
  const u = s0 < 0 ? -1 : t.slice(s0).search(/（単位[：︓]千円、[人⼈]）/);
  if (s0 < 0 || u < 0) { p.warnings.push('事業コスト表が見つからないため金額は未収録。'); return [p]; }
  const from = s0 + u;
  const ends = [t.indexOf('\n事業番号\n', from), t.indexOf('７ 主な取組', from)].filter(x => x > 0);
  const to = ends.length ? Math.min(...ends) : t.length;
  const toks = tokens(t.slice(from, to), from);
  const { rows, notes } = costRows(toks);
  p.warnings.push(...notes);
  const amounts: EvaluationAmount[] = [];
  const cols = rows.length ? null : columnRows(toks, t.slice(s0, from).includes('\nR6年度\nR5年度\nR4年度\n'));
  for (const c of cols ?? []) {
    amounts.push(amount(input, 'budget', c.fy, c.sum.raw, '千円', c.sum.raw, c.sum.at));
    if (c.actual.v > 0) amounts.push(amount(input, 'actual', c.fy, c.actual.raw, '千円', c.actual.raw, c.actual.at));
  }
  if (cols) p.warnings.push('事業コスト表が欄ごとに出力される配置。各欄の3値を見出しの年度順（R6・R5・R4）に対応させ、繰越＋当初＋補正＝予算現額の検算が3年度とも合うことを確認。');
  for (const r of rows.sort((a, b) => b.fy - a.fy)) {
    const sum = toks[r.sumIdx];
    const span = (i: number, j: number) => t.slice(toks[i].at, toks[j].at + toks[j].raw.length);
    amounts.push(amount(input, 'budget', r.fy, sum.raw, '千円', span(r.firstIdx, r.sumIdx), toks[r.firstIdx].at));
    if (r.actualIdx !== null) {
      const g = toks[r.actualIdx - 1], k = toks[r.actualIdx];
      if (k.v > 0 && k.v <= sum.v && g.v <= sum.v && g.v >= 0) amounts.push(amount(input, 'actual', r.fy, k.raw, '千円', span(r.actualIdx - 1, r.actualIdx + 1), g.at));
      else if (k.v !== 0) p.warnings.push(`R${r.fy - 2018}年度の決算額が予算現額・一般財源との大小関係を満たさないため未収録。`);
    }
  }
  const got = new Set(amounts.filter(a => a.kind === 'actual').map(a => a.fiscalYear));
  const missing = [2024, 2023, 2022].filter(y => !got.has(y));
  if (missing.length) p.warnings.push(`事業コスト表の値の並びから決算額の行を確定できない年度（${missing.map(y => `R${y - 2018}`).join('・')}）は決算額を未収録（0 の決算額も収録していない）。`);
  p.amounts.push(...amounts);
  p.warnings.push('金額は「６ 事業コスト」表（千円）。予算額の合計（予算現額＝前年度繰越＋当初予算＋補正予算等、和の検算一致）を budget、決算額を actual として収録。評価年度はシートに記載がないため未設定、評価対象年度は「令和６年度実施事業分」による。');
  return [p];
}

export const entries: Record<string, Entry> = {
  [CODE]: {
    scope: '事業改善シート（令和６年度実施事業分、点検。1事業1PDF）の事業番号・事業名・部局/課と「６ 事業コスト」表のR4〜R6年度の予算現額・決算額（値の並びと検算で行が確定できたもののみ）。細事業一覧・成果指標・政策評価報告書（施策単位）は対象外。',
    extract: (input) => extractOne(input),
  },
};
