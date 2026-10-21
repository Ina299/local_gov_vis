import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Extract, amount, eraYear, municipality, num, rating } from './h6-util';

/* ---------- 11361 横瀬町 行政評価結果一覧（令和元年度事務事業分） ---------- */

const YOKOZE_SHEET = /事務事業名(?:\n\n| )([^\n]+)\n\n担当課所\n\n([^\n]+)\n/g;
const YOKOZE_DIRECTIONS = new Set(['現状維持', '拡大', '縮小', '廃止', '一部改善']);
const YOKOZE_SCALE = '担当者評価 （2点：適切 1点：概ね適切 0点：不十分）';

/** One record per 事務事業評価シート: 担当課所・総事業費（実績3か年）・担当者評価の総合点数・今後の方針. */
function yokoze(input: CachedInput): ProjectEvaluation[] {
  const title = /行政評価結果一覧\n（(令和|平成)(\S+?)年度事務事業分）/.exec(input.text);
  if (!title || title.index > 100) return [];
  const fy = eraYear(title[1], title[2]);
  if (fy === null) return [];
  const out: ProjectEvaluation[] = [], heads = [...input.text.matchAll(YOKOZE_SHEET)];
  heads.forEach((h, i) => {
    const start = h.index!, end = heads[i + 1]?.index ?? input.text.length, sheet = input.text.slice(start, end);
    if (!/(課|室|局|所|会)$/.test(h[2])) return;
    const p = project(input, h[1], h[1], null, h[0].replace(/\n$/, ''), start);
    p.projectCode = null; p.department = h[2]; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, title[0], title.index));
    // 事業費表の各年度列は見出し直後の行が総事業費。同じ列の後続行（財源内訳）より小さい値は列崩れとみなす。
    for (const m of sheet.matchAll(/(平成|令和)(\S+?)年度（実績）\n([\d,]+)\n((?:[\d,]+\n)*)\n/g)) {
      const year = eraYear(m[1], m[2]), rest = m[4].split('\n').filter(Boolean).map(num);
      if (year === null || rest.some(v => v > num(m[3])) || !/単位：千円/.test(sheet.slice(0, m.index))) continue;
      p.amounts.push(amount(input, 'actual', year, m[3], '千円', `${m[1]}${m[2]}年度（実績）\n${m[3]}`, start + m.index!));
    }
    const scores = [...sheet.matchAll(/\d+／18点/g)];
    if (scores.length === 1) p.ratings.push(rating(input, 'self', '担当者評価 総合点数', scores[0][0], YOKOZE_SCALE, scores[0][0], start + scores[0].index!));
    const dirs = [...sheet.matchAll(/\n([^\n]+)\n/g)].filter(m => YOKOZE_DIRECTIONS.has(m[1]));
    if (dirs.length && new Set(dirs.map(m => m[1])).size === 1) {
      const at = /今後の方針\n\n([^\n]+)\n/.exec(sheet), d = at && at[1] === dirs[0][1] ? at : null;
      p.ratings.push(d ? rating(input, 'self', '今後の方針', d[1], null, d[0].trimEnd(), start + d.index)
        : rating(input, 'self', '今後の方針', dirs[0][1], null, dirs[0][1], start + dirs[0].index! + 1));
    }
    p.warnings.push('横瀬町 行政評価結果一覧（令和元年度事務事業分）の事務事業シート。評価対象年度は表題の「令和元年度事務事業分」、評価実施年度は本文に明示がないため未設定。',
      '事業費は「単位：千円」の事業費表で各年度（実績）見出しの直後にある総事業費だけを記録（平成31年度＝令和元年度）。同じ列の財源内訳より小さい値になる場合は列崩れとして除外。財源内訳は未構造化。',
      '指標（実績値・達成度）は抽出テキストで年度列と値の対応が確定できないため未構造化。総合点数は9項目×2点の18点満点（シート内に1つだけある場合のみ）。今後の方針はシート内の方針ラベルが1種類に定まる場合のみ。');
    out.push(p);
  });
  return out;
}

/* ---------- 37341 三木町 事務事業評価一覧表（令和元年度一般会計事業） ---------- */

const MIKI_PAGE = '■事務事業評価 一覧表(令和元年度一般会計事業)';
const MIKI_AMOUNT_HEAD = 'H30決算額 R1決算額 R2予算額 必要性\n';
const MIKI_EVAL_HEAD = '事業の評価\n有効性\n効率性\n総合評価\n';
const MIKI_DIRECTIONS = new Set(['現状維持', '拡充', '縮小', '内容見直し', '廃止・終了']);
const DEPT = /^\S+(課|事務局|出納室)$/;

const parens = (s: string) => (s.match(/[（(]/g)?.length ?? 0) === (s.match(/[）)]/g)?.length ?? 0);
const okName = (s: string) => !/\s/.test(s) && !/^[（(]/.test(s) && parens(s) && !DEPT.test(s);

interface Line { s: string; at: number }
interface Row { name: string; nameStart: number; dept: string | null; deptStart: number }
interface Names { first: number | null; count: number; rows: Map<number, Row>; depts: Line[] }

const linesOf = (block: string, at: number): Line[] => {
  const out: Line[] = [];
  for (const s of block.split('\n')) { out.push({ s, at }); at += s.length + 1; }
  return out;
};
/** Leading names that are certainly one row each: stops before a wrapped name (continuation line or unbalanced parentheses). */
function prefix(names: Line[]): Line[] {
  const out: Line[] = [];
  for (let i = 0; i < names.length; i++) {
    if (!okName(names[i].s) || /^[（(]/.test(names[i + 1]?.s ?? '')) break;
    out.push(names[i]);
  }
  return out;
}

/** Row number -> name (and department) in the page head (before 事業費（千円）), for the layouts where the pairing is explicit. */
function mikiNames(page: string, base: number): Names {
  const head = page.slice(0, Math.max(0, page.indexOf('事業費（千円）')));
  const rows = new Map<number, Row>(), lines = linesOf(head, base);
  let numbers: number[] = [], depts: Line[] = [];
  // 「番号 事業名」が1行の様式。次の行は担当課・次の番号行・空行のいずれかでなければ折返しとみなして採らない。
  lines.forEach((l, i) => {
    const m = /^(\d{1,3}) (.+)$/.exec(l.s), next = lines[i + 1]?.s ?? '';
    if (!m) return;
    numbers.push(Number(m[1]));
    if (!okName(m[2]) || !(/^\d{1,3} /.test(next) || DEPT.test(next) || next === '')) return;
    const dept = DEPT.test(next) ? next : null;
    rows.set(Number(m[1]), { name: m[2], nameStart: l.at + m[1].length + 1, dept, deptStart: dept ? lines[i + 1].at : -1 });
  });
  // 番号列と事業名列（と担当課列）が別々に並ぶ様式。
  const list = /番号\n((?:\d{1,3}\n)+)\n事 業 名\n(\n担当課\n\n)?((?:[^\n]+\n)+)\n(担当課\n)?((?:[^\n]+\n)*)/.exec(head);
  if (list && !rows.size) {
    numbers = list[1].trimEnd().split('\n').map(Number);
    const at3 = base + list.index + list[0].indexOf(list[3], list[1].length), block = linesOf(list[3].replace(/\n$/, ''), at3);
    // 事業名と担当課が1行ずつ交互に並ぶ場合（「…（繰越）農林課」のように1行に連結したものは分ける）。
    const split: Line[] = block.flatMap(l => {
      const m = /^(.*[）)]) ?([^\s（）()]+(?:課|事務局|出納室))$/.exec(l.s);
      return m ? [{ s: m[1], at: l.at }, { s: m[2], at: l.at + l.s.length - m[2].length }] : [l];
    });
    const alternating = list[2] && split.length === numbers.length * 2 && split.every((l, k) => DEPT.test(l.s) === (k % 2 === 1));
    if (alternating) {
      for (let k = 0; k < numbers.length; k++) {
        const n = split[2 * k], d = split[2 * k + 1];
        if (okName(n.s)) rows.set(numbers[k], { name: n.s, nameStart: n.at, dept: d.s, deptStart: d.at });
      }
    } else {
      prefix(block).forEach((n, k) => rows.set(numbers[k], { name: n.s, nameStart: n.at, dept: null, deptStart: -1 }));
      const at5 = base + list.index + list[0].length - list[5].length;
      depts = linesOf(list[5].replace(/\n$/, ''), at5).filter(l => l.s !== '');
      if (!depts.length || !depts.every(l => DEPT.test(l.s))) depts = [];
    }
  } else if (rows.size) {
    const d = /担当課\n((?:\S+(?:課|事務局|出納室)\n)+)/.exec(head);
    if (d) depts = linesOf(d[1].replace(/\n$/, ''), base + d.index + '担当課\n'.length);
  }
  return { first: numbers.length ? Math.min(...numbers) : null, count: numbers.length, rows, depts };
}

/**
 * 三木町の一覧表は各ページの先頭から行単位で読める区間（事業費4列と評価3列の行数が一致する区間）と、
 * 列ごとに縦に並ぶ残りの区間に分かれる。行単位の区間だけを、ページ先頭の番号から順に対応づける。
 */
function miki(input: CachedInput): ProjectEvaluation[] {
  const out: ProjectEvaluation[] = [], text = input.text;
  if (!text.includes(MIKI_PAGE)) return [];
  const starts = [...text.matchAll(/■事務事業評価 一覧表\(令和元年度一般会計事業\)/g)].map(m => m.index!);
  starts.forEach((s, i) => {
    const page = text.slice(s, starts[i + 1] ?? text.length);
    const { first, count, rows: names, depts } = mikiNames(page, s);
    if (first === null || !names.size) return;
    const eh = page.indexOf(MIKI_EVAL_HEAD);
    if (eh < 0) return;
    const evalStart = eh + MIKI_EVAL_HEAD.length, evalBlock = page.slice(evalStart, page.indexOf('\n\n', evalStart));
    // 評価列は「有効性」1行と「効率性 総合評価」1行の組が行数分だけ続く。崩れていればそのページは採らない。
    const evals = [...evalBlock.matchAll(/([1-5])\n([1-5]) (\S+)(?:\n|$)/g)];
    if (!evals.length || evals.map(e => e[0]).join('').replace(/\n$/, '') !== evalBlock) return;
    const k = evals.length;
    const ah = page.indexOf(MIKI_AMOUNT_HEAD), amountStart = ah + MIKI_AMOUNT_HEAD.length;
    const amountBlock = ah < 0 ? '' : page.slice(amountStart, page.indexOf('\n\n', amountStart));
    const tokens = [...amountBlock.matchAll(/[^\s]+/g)];
    const amountsOk = tokens.length === 4 * k && tokens.every(t => /^\d{1,3}(,\d{3})*$/.test(t[0]))
      && tokens.every((t, j) => j % 4 !== 3 || /^[1-5]$/.test(t[0]));
    for (let j = 0; j < k; j++) {
      const row = names.get(first + j), e = evals[j];
      if (!row || !MIKI_DIRECTIONS.has(e[3])) continue;
      // 別列の担当課は、件数がページの行数か行単位区間の行数と一致する場合だけ順に対応づける。
      const dept = row.dept ? { s: row.dept, at: row.deptStart } : depts.length === count || depts.length === k ? depts[j] : undefined;
      const p = project(input, row.name, row.name, null, row.name, row.nameStart);
      p.projectCode = String(first + j); p.evaluatedFiscalYear = 2019;
      if (dept) { p.department = dept.s; p.evidence.push(evidence(input, dept.s, dept.at)); }
      const eAt = s + evalStart + e.index!, eRaw = e[0].replace(/\n$/, '');
      if (amountsOk) {
        const t = tokens.slice(4 * j, 4 * j + 4), rawStart = s + amountStart + t[0].index!, raw = text.slice(rawStart, s + amountStart + t[3].index! + t[3][0].length);
        p.amounts.push(amount(input, 'actual', 2018, t[0][0], '千円', raw, rawStart), amount(input, 'actual', 2019, t[1][0], '千円', raw, rawStart),
          amount(input, 'budget', 2020, t[2][0], '千円', raw, rawStart));
        p.ratings.push(rating(input, 'self', '必要性', t[3][0], null, raw, rawStart));
      }
      p.ratings.push(rating(input, 'self', '有効性', e[1], null, eRaw, eAt), rating(input, 'self', '効率性', e[2], null, eRaw, eAt),
        rating(input, 'self', '総合評価', e[3], null, eRaw, eAt));
      p.warnings.push('三木町 事務事業評価一覧表（令和元年度一般会計事業）。評価対象年度は表題の令和元年度、評価実施年度は本文に明示がないため未設定。整理番号を projectCode に記録。',
        '抽出テキストで各ページ先頭の行単位区間（評価列の行数と事業費4列×行数が一致する区間）だけを、番号順に対応づけて構造化。列ごとに縦に並ぶ後半区間・事業名が折り返す行は対象外。',
        amountsOk ? '事業費は H30決算額・R1決算額（実績）と R2予算額（予算）、単位千円。評価点（必要性・有効性・効率性）の段階定義は本文にないため scale は未設定。'
          : 'このページは事業費列の値の数が行数と一致しないため事業費と必要性は未構造化。');
      out.push(p);
    }
  });
  return out;
}

export const entries: Record<string, { extract: Extract; scope: string }> = {
  '11361': { extract: municipality('11361', yokoze), scope: '横瀬町 行政評価結果一覧（令和元年度事務事業分）の事務事業シート: 事業名・担当課所・総事業費（平成29〜令和元年度実績）・担当者評価の総合点数・今後の方針。財源内訳・指標・評価文と冒頭の結果概要（最終評価3事業）は対象外。' },
  '37341': { extract: municipality('37341', miki), scope: '三木町 事務事業評価一覧表（令和元年度一般会計事業）のうち行単位で読める区間: 整理番号・事業名・担当課・H30/R1決算額とR2予算額・必要性/有効性/効率性・総合評価。列ごとに縦に並ぶ区間・折返しのある事業名・特別会計・一覧ページ（html）は対象外。' },
};
