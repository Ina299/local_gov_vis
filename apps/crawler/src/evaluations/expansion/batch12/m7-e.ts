import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, num, type Entry } from '../batch9/i1-util';

type Line = { s: string; start: number };
/** Non-empty trimmed lines with absolute offsets (offset points at the trimmed text). */
function lines(text: string, from: number, to: number): Line[] {
  const out: Line[] = [];
  for (const m of text.slice(from, to).matchAll(/[^\n]+/g)) {
    const lead = m[0].length - m[0].trimStart().length, s = m[0].trim();
    if (s) out.push({ s, start: from + m.index! + lead });
  }
  return out;
}

// ---------------------------------------------------------------- 鹿島市（令和４年度 主要施策の成果説明書）
// 各事業の見出し表: 事業名／事業費（千円）／財源（国・県・市債・その他・一般財源）／所管課／費目。pdftotext で語順が崩れるため、
// 見出し表の語（ラベル・数値）以外の行がちょうど事業名1行・所管課1行・費目1行に分かれ、財源の合計が事業費に一致する表だけを採用する。
const KASHIMA_ID = 'b974c3f7233abffe405efed0';
const KASHIMA_LABELS = new Set(['事業名', '令和４年度 鹿島市決算（資料）', '事業費', '（千円）', '(千円)', '事業費（千円）', '財', '源', '国', '県', '所管課', '費 目', '費', '目',
  '市債（借入金）', '市債(借入金)', 'その他', '一般財源']);
const NUMBER = /^\d{1,3}(?:,\d{3})*$/;

function extractKashima(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '41207' || input.sourceId !== KASHIMA_ID) return [];
  const title = /令 和 ４ 年 度\n鹿島市 主要施策の成果説明書/.exec(input.text.slice(0, 200));
  if (!title) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const starts = [...t.matchAll(/^事業名$/gm)].map(m => m.index!);
  for (let k = 0; k < starts.length; k++) {
    const ls = lines(t, starts[k], starts[k + 1] ?? t.length);
    let i = 1, seenGeneral = false, seenDept = false;
    const names: Line[] = [], numbers: Line[] = [];
    let dept: Line | null = null, item: Line | null = null, end: Line | null = null, bad = false;
    for (; i < ls.length; i++) {
      const l = ls[i];
      if (KASHIMA_LABELS.has(l.s)) {
        if (l.s === '一般財源') seenGeneral = true;
        if (l.s === '所管課') {
          if (seenDept) { bad = true; break; }
          seenDept = true;
          dept = ls[i + 1] ?? null;
          if (!dept || KASHIMA_LABELS.has(dept.s) || NUMBER.test(dept.s)) { bad = true; break; }
          i++;
        }
        if (l.s === '費 目' || l.s === '費') {
          const v = ls[i + 1];
          if (v && /費$/.test(v.s) && !KASHIMA_LABELS.has(v.s)) { item = v; i++; }
        }
        end = l; continue;
      }
      if (NUMBER.test(l.s)) { numbers.push(l); end = l; continue; }
      if (seenGeneral && seenDept) break; // 見出し表の後の本文
      names.push(l); end = l;
    }
    if (bad || !seenGeneral || !seenDept || !dept || !item || !end || names.length !== 1 || numbers.length < 2) continue;
    if (!/(課|局|室|係)$/.test(dept.s)) continue;
    const name = names[0].s;
    if (name.length > 40 || /[。、]/.test(name) || /^[・○〇]/.test(name)) continue;
    // 事業費 = 最大値。残りの数値（財源内訳）の合計が事業費に一致しない表は列対応が確定しないため金額を入れない。
    const vals = numbers.map(n => num(n.s)), max = Math.max(...vals), top = vals.indexOf(max);
    if (vals.filter(v => v === max).length > 2) continue;
    const rest = vals.reduce((a, v, j) => j === top ? a : a + v, 0);
    const headerRaw = t.slice(starts[k], end.start + end.s.length);
    const p = project(input, name, name, null, headerRaw, starts[k]);
    p.department = dept.s; p.evaluatedFiscalYear = 2022;
    p.evidence.push(evidence(input, title[0], title.index));
    p.warnings.push('令和４年度主要施策の成果説明書（決算に係る主要施策の成果）の事業見出し表。評価票ではなく決算説明資料で、評価区分は記載がないため未設定。評価年度は本文に明記がないため未設定。所管課は原文の表記（部・課・係）のまま。');
    if (rest === max) {
      p.amounts.push(amount(input, 'actual', 2022, numbers[top].s, '千円', numbers[top].s, numbers[top].start));
      p.warnings.push('金額は「事業費（千円）」を令和４年度決算の実績として収録（見出し「令和４年度 鹿島市決算（資料）」）。財源内訳（国・県・市債・その他・一般財源）の数値の合計が事業費と一致する表のみ採用し、財源の内訳は列対応が崩れているため未収録。');
    } else {
      p.warnings.push('事業費と財源内訳の合計が一致しない（列の崩れ）ため金額は未収録。');
    }
    out.push(p);
  }
  return mergeReprints(out, p => `${p.projectName}|${p.department}|${p.evaluatedFiscalYear}`);
}

// ---------------------------------------------------------------- 京丹波町（総合計画審議会 評価と意見（令和5年度戦略事業））
// 「事業名 ○○」の行と、その直後に担当課の【】が続く場合のみ担当課を採る。KPI目標/実績・部会評価の票数・達成状況は段組みが崩れ対応が確定しないため未収録。
const KYOTAMBA_ID = '177898e63f752daf588b9efb';

function extractKyotamba(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '26407' || input.sourceId !== KYOTAMBA_ID) return [];
  const title = /評価と意見\n（令和5年度戦略事業）/.exec(input.text.slice(0, 200));
  if (!title) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(/^事業名 ([^\n]+)\n\n?([^\n]*)/gm)) {
    const name = m[1].trim();
    if (!name) continue;
    const d = /^【([^】]+(?:課|室|支所|委員会)(?:[、 ][^】]+)?)】$/.exec(m[2]);
    const raw = d ? m[0] : `事業名 ${m[1]}`;
    const p = project(input, name, name, null, raw, m.index);
    p.department = d ? d[1] : null; p.evaluatedFiscalYear = 2023;
    p.evidence.push(evidence(input, title[0], title.index));
    p.warnings.push('第２期総合戦略の戦略事業について総合計画審議会（創生戦略有識者会議）が評価した資料の事業名。表題「（令和5年度戦略事業）」により評価対象年度を令和5年度とし、評価年度は本文に明記がないため未設定。部会評価（現状どおり／一部改善／抜本的改善の票数）・KPIの目標/実績・達成状況は段組み崩れで事業との対応が確定しないため未収録。'
      + (d ? '担当課は事業名の直後に続く【】内の表記。' : '担当課は事業名の直後に【】がなく対応が確定しないため未設定。'));
    out.push(p);
  }
  return mergeReprints(out, p => `${p.projectName}|${p.evaluatedFiscalYear}`);
}

export const entries: Record<string, Entry> = {
  '41207': { extract: extractKashima, scope: '令和４年度主要施策の成果説明書の各事業見出し表（事業名・所管課・費目）。事業費（千円）は財源内訳の合計と一致する表のみ令和４年度決算の実績として収録。事業名が複数行に割れた表・見出しが崩れた表・内訳表・財政状況資料は対象外。' },
  '26407': { extract: extractKyotamba, scope: '総合計画審議会（創生戦略有識者会議）「評価と意見（令和5年度戦略事業）」の戦略事業名と、直後に続く場合の担当課のみ。KPI目標/実績・部会評価票数・意見本文と、総合戦略の総合的評価（計画レベル）は対象外。' },
};
