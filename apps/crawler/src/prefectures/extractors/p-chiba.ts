/**
 * 千葉県 総合計画の進行管理「事業整理票」（施策ごとの 予算事業名／会計／当初予算額／再掲／決算（見込）額 の表）。
 * PDF の段組みで取組名・計画事業名が予算事業名と同じ行に混ざるため、次の2段の確認を通った行だけを収録する。
 *  1. 行の形: 「予算事業名」1行 → 会計（一般／特別／企業）→ 当初予算額（「再掲」「本籍」の印つき可）が段落として連続している。
 *  2. 取組ごとの検算: 取組の表（「（Ａ）－（Ｂ）」の行で区切る）の会計欄の数と読めた当初予算額の数が一致し、その合計（取組の計（Ａ））が、
 *     同じ施策コードの「政策評価帳票」（施策評価シート）の「R◯年度予算額（千円）」表に印字された取組別の値のどれかと一致する。
 *     会計年度はこの表の見出し「R◯年度予算額」による（事業整理票自体には年度が印字されない）。
 * 「決算（見込）額」は決算額か見込額かが欄名で区別されないが、決算額として収録する（利用者の判断。2026-11。RECORD_KESSAN_MIKOMI）。
 * 「再掲」行は他の施策の本籍行の再掲なので事業として収録しない。担当課は事業ごとに印字されないため未収録。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { acrossDocuments, amount, nfkc, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

/** 決算（見込）額を actual として収録するか（見込額を含みうる欄。利用者の判断で収録する）。 */
const RECORD_KESSAN_MIKOMI = true;
/** 決算（見込）額が当初予算額のこの倍数を超える行は、決算額を収録しない（原表の桁の誤記対策）。 */
const MAX_ACTUAL_RATIO = 3;

const N = String.raw`\d{1,3}(?:,\d{3})*`;
const CODE = /施策\n(?:取組\n番号\n)?\n([ⅠⅡⅢⅣⅤⅥⅦ]－[０-９]+－[①-⑳])/g;
const ROW = new RegExp(String.raw`(?<=\n\n)([^\n]+)\n\n(一般|特別|企業)\n\n(${N})(?: (再掲|本籍))?\n\n(?:(${N})\n\n)?`, 'g');
const KAIKEI = /(?<=\n)(一般|特別|企業)(?=\n)/g;
/** 会計欄が k 行続き、空行の後に当初予算額が k 行続く形（k=1 が通常の行）。 */
const KAIKEI_RUN = new RegExp(String.raw`(?<=\n)((?:(?:一般|特別|企業)\n)+)\n((?:${N}(?: (?:再掲|本籍))?\n)+)`, 'g');
const NOT_NAME = /^(?:施策|取組|番号|主な取組名|計画事業名|予算事業名|会計|再掲|合|計|純計|一般|特別|企業)$|当初予算額|決算（見込）額|単位：千円|^\d{1,3}(?:,\d{3})*$/;

type Section = { code: string; start: number; text: string };
type Table = { input: CachedInput; fy: number; label: string; labelStart: number; values: { raw: string; start: number }[] };

function sections(t: string): Section[] {
  const heads = [...t.matchAll(CODE)];
  const out: Section[] = [];
  heads.forEach((m, i) => {
    const start = m.index!, end = heads[i + 1]?.index ?? t.length;
    const last = out.at(-1);
    if (last && last.code === m[1] && last.start + last.text.length === start) last.text += t.slice(start, end);
    else out.push({ code: m[1], start, text: t.slice(start, end) });
  });
  return out;
}

/** 政策評価帳票の同じ施策コードの施策評価シートから「R◯年度予算額（千円） R◯年度決算額（千円）」表の数値行を集める。 */
function evaluationTables(inputs: CachedInput[], code: string): Table[] {
  const ascii = nfkc(code);
  const out: Table[] = [];
  for (const input of inputs) {
    const t = input.text;
    if (!t.includes('総合計画政策評価帳票')) continue;
    const heads = [...t.matchAll(/（様式２）施策評価シート/g)].map(m => m.index!);
    heads.forEach((h, i) => {
      const sec = t.slice(h, heads[i + 1] ?? t.length);
      const c = /\n([ⅠⅡⅢⅣⅤⅥⅦ]-\d+-[①-⑳])\n/.exec(sec.slice(0, 400));
      if (!c || nfkc(c[1]) !== ascii) return;
      const lab = /R(\d+)年度予算額（千円） R\1年度決算額（千円）\n/.exec(sec);
      if (!lab) return;
      const after = sec.slice(lab.index + lab[0].length);
      const stop = after.search(/\n・/);
      const block = stop < 0 ? after.slice(0, 600) : after.slice(0, stop);
      const base = h + lab.index + lab[0].length;
      const values = [...block.matchAll(new RegExp(`(?<=^|\\n)(${N})(?=\\n|$)`, 'g'))].map(m => ({ raw: m[1], start: base + m.index! }));
      out.push({ input, fy: 2018 + Number(lab[1]), label: lab[0].trim(), labelStart: h + lab.index, values });
    });
  }
  return out;
}

function one(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith('施策\n') || !t.includes('予算事業名') || !t.includes('決算（見込）額')) return [];
  const out: ProjectEvaluation[] = [];
  for (const sec of sections(t)) {
    // 純計の内訳（会計別）の「一般 N N 純計の内訳」は事業行ではない
    const body = sec.text.replace(/(一般|特別|企業)(\n\n\d[\d,]*\n\n\d[\d,]*\n\n純計の内訳)/g, (_m, k: string, rest: string) => '＊'.repeat(k.length) + rest);
    const tables = evaluationTables(inputs, sec.code);
    const codeAt = sec.start + sec.text.indexOf(sec.code);
    const marks = [...body.matchAll(/（Ａ）－（Ｂ）/g)].map(m => m.index!);
    marks.forEach((end, bi) => {
      const from = bi ? marks[bi - 1] : 0, block = body.slice(from, end);
      const kaikei = [...block.matchAll(KAIKEI)].length;
      const budgets: number[] = [];
      for (const m of block.matchAll(KAIKEI_RUN)) {
        const k = m[1].split('\n').length - 1, vals = m[2].split('\n').slice(0, -1);
        if (k !== vals.length) return;
        budgets.push(...vals.map(v => num(v.replace(/ (?:再掲|本籍)$/, ''))));
      }
      if (!kaikei || kaikei !== budgets.length) return;
      const total = budgets.reduce((a, b) => a + b, 0);
      const hits = tables.flatMap(tb => tb.values.filter(v => num(v.raw) === total).map(v => ({ tb, v })));
      if (hits.length !== 1) return;
      const { tb, v: hit } = hits[0];
      for (const m of block.matchAll(ROW)) {
        const [, name, , budget, mark] = m;
        if (mark === '再掲' || NOT_NAME.test(name.trim()) || name.length > 80) continue;
        const start = sec.start + from + m.index!;
        const raw = m[0].replace(/\n+$/, '');
        const p = project(input, `${sec.code}-${start}`, name.trim(), null, raw, start);
        p.evaluatedFiscalYear = tb.fy;
        p.evidence.push(evidence(input, sec.code, codeAt), evidence(tb.input, tb.label, tb.labelStart), evidence(tb.input, hit.raw, hit.start));
        if (num(budget) > 0) p.amounts.push(amount(input, 'budget', tb.fy, budget, '千円', raw, start));
        // 決算（見込）額が当初予算額の3倍を超える行は桁の誤記の疑い（例: 予算 5,000 に対し 4,869,999）があるため収録しない
        const overrun = num(budget) > 0 && m[5] !== undefined && num(m[5]) > num(budget) * MAX_ACTUAL_RATIO;
        if (RECORD_KESSAN_MIKOMI && m[5] && num(m[5]) > 0 && !overrun) p.amounts.push(amount(input, 'actual', tb.fy, m[5], '千円', raw, start));
        if (RECORD_KESSAN_MIKOMI && overrun) p.warnings.push(`決算（見込）額 ${m[5]} が当初予算額 ${budget} の${MAX_ACTUAL_RATIO}倍を超え、桁の誤記の疑いがあるため決算額は未収録。`);
        p.warnings.push(`当初予算額は事業整理票の行（予算事業名→会計→当初予算額が連続）から。施策${sec.code}のこの取組の当初予算額の合計（計（Ａ）${hit.raw}千円）が政策評価帳票「${tb.label}」の取組別の値と一致することを確認し、年度もその見出しによる。`);
        p.warnings.push(RECORD_KESSAN_MIKOMI ? '決算額は「決算（見込）額」欄の値（決算額と見込額の区別が欄名にないが、決算額として扱った）。担当課は事業ごとに印字されないため未収録。' : '「決算（見込）額」欄は決算額と見込額の区別がないため未収録。担当課は事業ごとに印字されないため未収録。');
        out.push(p);
      }
    });
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '12000': {
    scope: '総合計画の進行管理「事業整理票」（令和5・6年度分）の予算事業: 予算事業名と当初予算額（取組ごとの合計が政策評価帳票の取組別予算額と一致する取組のみ）。再掲行、決算（見込）額、取組・計画事業の文言が混ざる行、政策評価帳票の施策評価本文は対象外。',
    extract: (input, inputs) => acrossDocuments(input, inputs, i => one(i, inputs), p => `${nfkc(p.projectName)}|${p.evaluatedFiscalYear}`),
  },
};
