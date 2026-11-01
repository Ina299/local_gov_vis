/**
 * 群馬県 平成30年度実施事業評価（政策1〜13の分冊PDF。pdftotext -layout による段組保持テキスト）。
 * 表の列は 個別事業名・区分・部局・所属・事業概要・成果指標・単位・H30実績・H30目標・R元目標・H30当初・R元当初・H30決算（千円）・事業結果・部局評価・財政課評価。
 * 段組保持テキストでは1事業の行（「交通017 「７つの交通軸」の整備・強化 … 13,787,592 16,884,290 18,572,798 …」）に各列の値が1行に並ぶ。
 * 次の条件をすべて満たす行だけを収録する:
 *  - 行頭（字下げのみ）に事業コード（2字＋3桁）と事業名が同じ行にある（事業名が複数行に折り返された事業は、名前の行が確定しないため対象外）;
 *  - 事業名の後に、数値または「-／－／─」だけの語が3つ以上連続する並び（成果指標3列＋金額3列、または指標が文字の場合はその一部＋金額3列）があり、
 *    その最後の3語を H30当初・R元当初・H30決算 とする（列順はページ見出しの「H30当初 R元当初 H30決算」「（千円）」の印字による）;
 *  - 金額欄に文字（「部局予算対応」）や「▲」がある行、数値が次の欄の文字と空白なしで連結した行（値の区切りが確定しない）は除外。
 * 「-」「－」「─」の欄は金額なしとして収録しない。別分冊・同一分冊内の再掲（同じ事業コード）は値が一致すれば1件に統合、不一致なら除外。
 * 精度確認（2026-11）: PDF原本の語座標（PyMuPDF）から作った正解表 738行に対し、この条件で取り出した 728行の値の組がすべて一致（不一致0）。
 * 事業概要（activities）・成果指標（indicators）・評価区分（部局評価・財政課評価）は、下の enrich() の条件で欄の行が確定したものだけ付与する。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { acrossDocuments, amount, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const HEAD = /H30当初 +R元当初 +H30決算/g;
const UNIT = /（千円） +（千円） +（千円）/g;
const ROW = /^( +)(\S{2}\d{3}) (\S[^\n]*)$/gm;
/** 値の語（数値・小数・「-」類）。 */
const VALUE = /^(?:\d{1,3}(?:,\d{3})*(?:\.\d+)?|[-－─])$/;
const DASH = /^[-－─]$/;

function extractOne(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.format !== 'pdf') return [];
  const heads = [...t.matchAll(HEAD)].map(m => ({ at: m.index!, raw: m[0] }));
  const units = [...t.matchAll(UNIT)].map(m => ({ at: m.index!, raw: m[0] }));
  if (!heads.length || !units.length) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(ROW)) {
    const at = m.index!;
    const head = [...heads].reverse().find(h => h.at < at), unit = [...units].reverse().find(u => u.at < at);
    if (!head || !unit) continue;
    const code = m[2], rest = m[3];
    // 事業名: コードの後、2つ以上の空白まで（同じ行の「 再掲」は区分欄）
    const name = rest.split(/ {2,}/)[0].replace(/ 再掲$/, '').trim();
    if (!name || VALUE.test(name) || /[|]/.test(name)) continue;
    if (/予算対応|▲/.test(rest)) continue;
    const tail = rest.slice(rest.split(/ {2,}/)[0].length);
    // 値の語の連続を集める。数値に空白なしで文字が続く語は値の区切りが確定しないため、その行は対象外
    const runs: string[][] = [];
    let cur: string[] = [], glued = false;
    for (const tk of tail.split(/\s+/).filter(Boolean)) {
      if (VALUE.test(tk)) { cur.push(tk); continue; }
      if (cur.length >= 3 && /^\d{1,3}(?:,\d{3})+[^\d,]/.test(tk)) glued = true;
      if (cur.length) runs.push(cur);
      cur = [];
    }
    if (cur.length) runs.push(cur);
    const run = runs.filter(r => r.length >= 3).at(-1);
    if (!run || glued) continue;
    const [initial, next, settled] = run.slice(-3);
    // 証跡: 3つの値が並ぶ部分（行内の位置）
    const triple = new RegExp(String.raw`(?:^|\s)(${[initial, next, settled].map(v => v.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join(String.raw`\s+`)})(?=\s|$)`, 'g');
    const lineStart = at, line = m[0];
    const hits = [...line.matchAll(triple)];
    if (!hits.length) continue;
    const hit = hits.at(-1)!;
    const rawAmt = hit[1], amtAt = lineStart + hit.index! + hit[0].indexOf(hit[1]);
    const nameAt = lineStart + m[1].length;
    const p = project(input, code, name, null, `${code} ${name}`, nameAt);
    p.evaluatedFiscalYear = 2018;
    p.evidence.push(evidence(input, head.raw, head.at), evidence(input, unit.raw, unit.at));
    if (!DASH.test(initial)) p.amounts.push(amount(input, 'budget', 2018, initial, '千円', rawAmt, amtAt));
    if (!DASH.test(next)) p.amounts.push(amount(input, 'budget', 2019, next, '千円', rawAmt, amtAt));
    if (!DASH.test(settled)) p.amounts.push(amount(input, 'actual', 2018, settled, '千円', rawAmt, amtAt));
    if (!p.amounts.length) continue;
    p.warnings.push('金額は事業行の「H30当初」「R元当初」「H30決算」欄（千円。列順はページ見出しの印字による）。予算額は当初予算（H30当初＝2018年度、R元当初＝2019年度）、決算額は2018年度。');
    const dashes = [initial, next, settled].filter(v => DASH.test(v)).length;
    if (dashes) p.warnings.push('金額欄に「-」「－」の欄があり、その欄の金額は未収録。');
    if (!DASH.test(initial) && !DASH.test(settled) && num(settled) > num(initial)) p.warnings.push('H30決算額がH30当初予算額を上回る（補正・繰越等の可能性。原文どおり収録し、決算を正とする）。');
    p.warnings.push('担当部局・所属は欄内で複数行に分かれて印字されるため未収録。事業コードは原文の個別事業の番号。');
    out.push(p);
  }
  return out;
}

// ---- 事業概要・成果指標・評価（部局評価・財政課評価）の付与 ----
// 段組保持テキストでは各欄が文字位置（桁）で並ぶが、日本語の行は桁がずれることがあり、複数行の欄は他の欄の行と交互に出る。
// そこで、ページ見出し行（「個別事業名 … 事業概要 成果（結果）を示す指標 単位 H30実績 … 部局評価 財政課評価」）の各見出しの桁を基準に、
// 次の形で確定できる欄だけを付与する（精度確認 2026-11: PDF原本の語座標から作った正解表 738行に対し、下の条件で取り出した
// 評価 845欄・成果指標 300行・事業概要 247行がすべて一致、不一致0）。事業結果・評価の所見の文は桁のずれが大きく行の帰属が確定しないため対象外。

/** 評価区分として印字される語（折り返しを連結した形）。 */
const RATINGS = new Set(['4継続', '3拡充', '5継続（見直しあり）', '5継続(見直しあり)', '５継続（見直しあり）', '2縮小・一部廃止・統合', '1廃止･休止・終了']);
/** 事業コードだけで始まる行（事業名が折り返された事業を含む）。 */
const CODE_LINE = /^ +\S{2}\d{3}(?: |$)/;
/** 事業概要の段落の範囲を切る行（ページ見出し・政策体系の見出し）。 */
const BREAK = /個別事業名|事業概要|^\s*(?:政策\S|施策\S|\(\d+\)|[①-⑳])/;

type Line = { at: number; s: string };
type Layout = { lines: Line[]; heads: { line: number; col: Record<string, number> }[] };
const layouts = new WeakMap<CachedInput, Layout>();

function layout(input: CachedInput): Layout {
  let l = layouts.get(input);
  if (l) return l;
  const lines: Line[] = [];
  for (let at = 0; at <= input.text.length;) {
    const end = input.text.indexOf('\n', at), e = end < 0 ? input.text.length : end;
    lines.push({ at, s: input.text.slice(at, e) });
    at = e + 1;
  }
  const names = ['事業概要', '成果（結果）を示す指標', '単位', '部局評価', '財政課評価'];
  const heads = lines.flatMap((x, line) => (names.every(n => x.s.includes(n)) ? [{ line, col: Object.fromEntries(names.map(n => [n, x.s.indexOf(n)])) }] : []));
  l = { lines, heads };
  layouts.set(input, l);
  return l;
}

/** 桁 c ちょうどから始まる語（直前が空白か行頭）。 */
function wordAt(s: string, c: number): string | null {
  if (c >= s.length || s[c] === ' ' || (c > 0 && s[c - 1] !== ' ')) return null;
  return /^\S+/.exec(s.slice(c))![0];
}
/** 桁 [lo, hi) で始まる語の位置。 */
const startsIn = (s: string, lo: number, hi: number) => {
  const out: number[] = [];
  for (let p = Math.max(lo, 0); p < Math.min(hi, s.length); p++) if (s[p] !== ' ' && (p === 0 || s[p - 1] === ' ')) out.push(p);
  return out;
};

/** 評価区分: 見出しの桁ちょうどに語がある連続行（事業行の前後1行にかかるもの）を連結し、印字される区分の語になる場合だけ。 */
function rating(lines: Line[], i: number, c: number): { value: string; parts: { s: string; at: number }[] } | null {
  const has = (k: number) => k >= 0 && k < lines.length && wordAt(lines[k].s, c) !== null;
  const found: { value: string; parts: { s: string; at: number }[] }[] = [];
  for (let a = i - 4; a <= i + 1; a++) {
    if (!has(a) || has(a - 1)) continue;
    let b = a;
    while (has(b + 1)) b++;
    if (b < i - 1) continue;
    const parts = [];
    for (let k = a; k <= b; k++) parts.push({ s: wordAt(lines[k].s, c)!, at: lines[k].at + c });
    const value = parts.map(x => x.s).join('');
    if (RATINGS.has(value)) found.push({ value, parts });
  }
  return found.length === 1 ? found[0] : null;
}

/** 事業概要の1行分: 見出しの桁の -3〜+1 で始まる語から、2つ以上の空白か、成果指標欄の手前（指標の桁 -5 以降に始まる語）まで。 */
function summaryPart(s: string, sc: number, ic: number): { p: number; s: string } | 'X' | null {
  const st = startsIn(s, sc - 3, sc + 2);
  if (!st.length) return s.slice(Math.max(sc - 3, 0), sc + 2).trim() ? 'X' : null;
  if (st.length > 1) return 'X';
  const p = st[0];
  let e = s.indexOf('  ', p);
  if (e < 0) e = s.length;
  for (let q = p; q < e; q++) if (s[q] === ' ' && q + 1 >= ic - 5) { e = q; break; }
  return e - p > 24 ? 'X' : { p, s: s.slice(p, e) };
}

/** 事業概要: 事業行に最も近い（前後の事業行より近い）概要欄の行を集め、事業行を中心に上下対称で、1行目が字下げ（段落の始まり）、末尾が句点・閉じ括弧の場合だけ。 */
function summary(lines: Line[], i: number, sc: number, ic: number): { parts: { s: string; at: number }[]; value: string } | null {
  let prev = -1e6, next = 1e6;
  for (let k = i - 1; k > i - 15 && k >= 0; k--) if (CODE_LINE.test(lines[k].s)) { prev = k; break; }
  for (let k = i + 1; k < i + 15 && k < lines.length; k++) if (CODE_LINE.test(lines[k].s)) { next = k; break; }
  let lo = i, hi = i;
  while (lo - 1 >= 0 && lo - 1 > i - 14 && !BREAK.test(lines[lo - 1].s)) lo--;
  while (hi + 1 < lines.length && hi + 1 < i + 14 && !BREAK.test(lines[hi + 1].s)) hi++;
  const mine: { k: number; p: number; s: string }[] = [];
  for (let k = lo; k <= hi; k++) {
    const v = summaryPart(lines[k].s, sc, ic);
    if (!v) continue;
    const d = Math.abs(k - i);
    if (d === Math.abs(k - prev) || d === Math.abs(k - next)) return null; // 前後の事業行と等距離の行は帰属が決まらない
    if (d > Math.abs(k - prev) || d > Math.abs(k - next)) continue;
    if (v === 'X') return null;
    mine.push({ k, ...v });
  }
  if (mine.length < 2) return null;
  const a = mine[0].k, b = mine.at(-1)!.k;
  if (Math.abs(a - i + (b - i)) > 1) return null;
  const rest = mine.slice(1).map(x => x.p);
  if (!(mine[0].p > Math.min(...rest)) || new Set(rest).size > 2) return null;
  const value = mine.map(x => x.s).join('');
  if (!/[。）)]$/.test(value)) return null;
  return { parts: mine.map(x => ({ s: x.s, at: lines[x.k].at + x.p })), value };
}

/** 評価の選択基準（「令和元年度実施事業評価の結果について」の「3 評価の選択基準」に印字された区分）。 */
function scaleOf(inputs: CachedInput[]): { input: CachedInput; raw: string; at: number; scale: string } | null {
  for (const input of inputs) {
    const m = /\n3 評価の選択基準\n[^\n]*\n((?:[^\n]*\n)+?)＜外部リンク＞/.exec(input.text);
    if (!m || !input.text.includes('令和元年度実施事業評価の結果について')) continue;
    const items = m[1].split('\n').filter(s => /^\d(?:-\d)? \S+$/.test(s));
    if (items.length < 5) continue;
    return { input, raw: m[1].replace(/\n$/, ''), at: m.index + m[0].indexOf(m[1]), scale: items.join('／') };
  }
  return null;
}

function enrich(input: CachedInput, inputs: CachedInput[], p: ProjectEvaluation): void {
  const { lines, heads } = layout(input);
  const nameAt = Number(/^extracted-text:chars:(\d+)-/.exec(p.evidence[0].cell ?? '')?.[1]);
  const i = lines.findIndex((x, k) => x.at <= nameAt && (lines[k + 1]?.at ?? Infinity) > nameAt);
  const head = heads.filter(h => h.line < i).at(-1);
  if (i < 0 || !head) return;
  const line = lines[i];
  const col = head.col;
  // 評価（部局評価・財政課評価）
  const scale = scaleOf(inputs);
  for (const label of ['部局評価', '財政課評価']) {
    const r = rating(lines, i, col[label]);
    if (!r) continue;
    const first = r.parts[0], last = r.parts.at(-1)!;
    p.ratings.push({ kind: 'self', label, value: r.value, scale: scale?.scale ?? null, evidence: evidence(input, input.text.slice(first.at, last.at + last.s.length), first.at) });
  }
  if (p.ratings.length) {
    if (scale) p.evidence.push(evidence(scale.input, scale.raw, scale.at));
    p.warnings.push('評価は「部局評価」「財政課評価」欄の区分（次年度当初予算における事業の方向性。折り返しを連結）。尺度は「令和元年度実施事業評価の結果について」の評価の選択基準。所見の文は未収録。');
  }
  // 成果指標: 事業行の指標の桁（-8〜+2）で始まる指標名 → 2つ以上の空白 → 単位 → H30実績・H30目標・R元目標・金額3欄。
  // 指標名が上下の行に折り返している（前後3行の指標の桁に語がある）ものは対象外
  const ic = col['成果（結果）を示す指標'];
  const st = startsIn(line.s, ic - 8, ic + 3);
  const m = st.length === 1 ? /^(\S+(?: \S+)*?) {2,}(\S+) +(\S+) +(\S+) +(\S+) +(\S+) +(\S+) +(\S+)(?= |$)/.exec(line.s.slice(st[0])) : null;
  const amounts = p.amounts.map(a => a.rawValue);
  if (m && [m[6], m[7], m[8]].every(v => VALUE.test(v)) && [m[6], m[7], m[8]].filter(v => !DASH.test(v)).join() === amounts.join()) {
    // 単位の位置（指標名の後の空白の次）
    const unitStart = m[0].indexOf(m[2], m[1].length), us = st[0] + unitStart;
    const clean = (k: number) => !lines[k] || (!startsIn(lines[k].s, ic - 8, ic + 3).length && !lines[k].s.slice(ic + 3, us).trim());
    if ([i - 3, i - 2, i - 1, i + 1, i + 2, i + 3].every(clean)) {
      // 証跡: 指標名から R元目標 の値まで
      const unitEnd = unitStart + m[2].length;
      const ev = evidence(input, m[0].slice(0, unitEnd) + /^ +\S+ +\S+ +\S+/.exec(m[0].slice(unitEnd))![0], line.at + st[0]);
      const val = (v: string) => (DASH.test(v) ? null : v);
      if (val(m[3]) || val(m[4])) p.indicators.push({ name: m[1], fiscalYear: 2018, target: val(m[4]), actual: val(m[3]), unit: m[2], evidence: ev });
      if (val(m[5])) p.indicators.push({ name: m[1], fiscalYear: 2019, target: val(m[5]), actual: null, unit: m[2], evidence: ev });
      if (p.indicators.length) p.warnings.push('成果指標は「成果（結果）を示す指標」「単位」「H30実績」「H30目標」「R元目標」欄（2018年度は目標と実績、2019年度は目標のみ）。');
    }
  }
  // 事業概要
  const s = summary(lines, i, col['事業概要'], ic);
  if (s) {
    const first = s.parts[0], last = s.parts.at(-1)!;
    p.activities = s.value;
    p.evidence.push(evidence(input, input.text.slice(first.at, last.at + last.s.length), first.at));
    p.warnings.push('事業内容は「事業概要」欄（段組保持テキストの概要欄の行を連結。原文の字下げ・改行は除いた）。');
  }
}

export const entries: Record<string, Entry> = {
  '10000': {
    scope: '平成30年度実施事業評価（政策1〜13の分冊）の個別事業のうち、事業コード・事業名と H30当初・R元当初・H30決算（千円）の3欄が段組保持テキストの同じ行に並ぶ事業。事業概要・成果指標・評価区分（部局評価・財政課評価）は欄の行が確定できたものだけ付与。事業名が折り返された事業、金額欄が文字・▲の事業、値が文字と連結した行、事業結果・評価の所見は対象外。',
    // 再掲の統合は金額で判定し（概要・指標・評価の読み取りの差で事業ごと落とさないよう）、統合後に各資料の行から付与する
    extract: (input, inputs) => acrossDocuments(input, inputs, extractOne, p => p.projectCode ?? p.projectName).map(p => (enrich(input, inputs, p), p)),
  },
};
