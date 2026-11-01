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

export const entries: Record<string, Entry> = {
  '10000': {
    scope: '平成30年度実施事業評価（政策1〜13の分冊）の個別事業のうち、事業コード・事業名と H30当初・R元当初・H30決算（千円）の3欄が段組保持テキストの同じ行に並ぶ事業。事業名が折り返された事業、金額欄が文字・▲の事業、値が文字と連結した行、成果指標・評価区分は対象外。',
    extract: (input, inputs) => acrossDocuments(input, inputs, extractOne, p => p.projectCode ?? p.projectName),
  },
};
