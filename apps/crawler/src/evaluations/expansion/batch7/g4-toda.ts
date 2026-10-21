import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, project } from '../shared';
import { amount, ascii, municipality, num, rating } from './g4-util';

const HEAD = '戸田市\n事務事業名\n\n';
const NUM = /^-?[\d,]+(?:\.\d+)? ?人?$/;
const LABEL = /^(担当組織|組織コード|事務事業評価|R\d|\d+|≪事後評価シート≫)$/;
/** Current-year statements of sections 3-4; the label is fixed by the statement wording, not by its (shuffled) position. */
const CRITERIA: [string, RegExp][] = [
  ['目標達成状況', /[ＡＢＣＤ]：(?!施策)[^\n]*目標[^\n]*/g],
  ['施策への貢献度', /([ＡＢＣＤ])：施策の目標達成に[^\n]*/g], ['経費水準', /([ＡＢＣＤ])：経費[^\n]*/g],
  ['事業手法', /([ＡＢＣＤ])：事業手法[^\n]*/g], ['受益・負担の公平性', /([ＡＢＣＤ])：受益・負担[^\n]*/g],
];

/** Toda ≪事後評価シート≫ (2 pages per business, 記入日 令和6年): amounts of section 2 and the A-D results of sections 3, 4 and 6. */
function parse(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.format !== 'pdf' || !t.startsWith(HEAD.replace(/\n\n$/, '')) || !t.includes('≪事後評価シート≫')) return [];
  const starts: number[] = [];
  for (let i = t.indexOf(HEAD); i >= 0; i = t.indexOf(HEAD, i + 1)) starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const seg = t.slice(s, starts[k + 1] ?? t.length);
    const h = seg.match(/^戸田市\n事務事業名\n\n(\d+)\n[\s\S]{0,300}?\n\d+ ?頁\n\n([^\n]+)\n/);
    const filled = seg.match(/記入日\n\n令和 ?(\d+)年 ?(\d+)月/);
    const done = seg.match(/令和([０-９\d]+)年度\n執行額（千円）/), budget = seg.match(/令和([０-９\d]+)年度\n予算額（千円）/);
    if (!h || LABEL.test(h[2]) || !filled || !done || !budget || !seg.includes('≪事後評価シート≫')) return;
    const fy = Number(filled[2]) >= 4 ? 2018 + Number(filled[1]) : 2017 + Number(filled[1]);
    const doneYear = 2018 + Number(ascii(done[1])), budgetYear = 2018 + Number(ascii(budget[1]));
    const p = project(input, h[1], h[2], fy, h[0], s);
    p.projectCode = h[1]; p.evaluatedFiscalYear = doneYear;
    const dept = seg.match(/\n担当\n\n([^\n]+(?:課|室))\n/);
    p.department = dept?.[1] ?? null;
    p.warnings.push('事務事業名の番号を事業コードとして収録。評価結果（施策への貢献度・経費水準・事業手法・受益負担）は３〜５年度の欄が崩れているため、本文の判定文（最新年度の結果として記載されたもの）のみを判定文の文言で項目に対応付け。成果・活動指標の表は列の対応が確定できないため未構造化。');
    // Section 2: ten rows x five years. Accept only when every fund source and the personnel total check out.
    const hs = seg.indexOf('２.事業費'), he = seg.indexOf('３.目標達成状況', hs);
    if (hs >= 0 && he > hs) {
      const lines = seg.slice(hs, he).split('\n').map(l => l.trim()).filter(l => NUM.test(l));
      if (lines.length === 50) {
        const v = lines.map(l => num(l.replace('人', ''))), row = (r: number, c: number) => v[r * 5 + c];
        const ok = [0, 1].every(c => Math.abs(row(0, c) - [1, 2, 3, 4, 5].reduce((a, r) => a + row(r, c), 0)) < 0.5 && Math.abs(row(9, c) - row(0, c) - row(6, c)) <= 1);
        if (ok) {
          const raw = seg.slice(hs, he).trimEnd(), at = s + hs;
          p.amounts.push(amount(input, 'actual', doneYear, lines[0], '千円', raw, at), amount(input, 'budget', budgetYear, lines[1], '千円', raw, at),
            amount(input, 'personnel', doneYear, lines[30], '千円', raw, at), amount(input, 'fullCost', doneYear, lines[45], '千円', raw, at));
          p.warnings.push('事業費の表は財源内訳の合計と事業費＋人件費の合計で列・行の対応を検算した場合のみ収録（執行額・予算額・人件費・事業費＋人件費）。計画額は対象外。');
        } else p.warnings.push('事業費の表は財源内訳・合計の検算が合わず列の対応が確定できないため金額を収録していません。');
      } else p.warnings.push('事業費の表は数値の並びが崩れているため金額を収録していません。');
    }
    // pdftotext moves the section headings away from their statements, so each statement is matched over the whole sheet.
    for (const [label, re] of CRITERIA) {
      const hits = [...seg.matchAll(re)];
      if (hits.length === 1) p.ratings.push(rating(input, 'self', label, hits[0][0], null, hits[0][0], s + hits[0].index!));
    }
    const d = seg.match(/６．(令和[０-９\d]+年度の方向性)・取組方針\n[\s\S]*?＜方向性の判断理由・取組方針＞/);
    if (d) {
      const picks = [...d[0].matchAll(/● ([^\n○●]+)/g)];
      if (picks.length === 1) p.ratings.push(rating(input, 'self', d[1], picks[0][1].trim(), null, picks[0][0], s + d.index! + picks[0].index!));
    }
    out.push(p);
  });
  return out;
}

/** Already structured from attachment 71793 (same period); excluded rather than judged as distinct. */
const EXISTING = ['児童手当支給事業', 'こども医療費支給事業', '地域子育て支援拠点事業', 'こどもの居場所づくり事業', '少子化対策事業', '児童扶養手当支給事業', '遺児手当事業',
  'こども家庭センター事業', '子どもの生活支援事業', '母子生活支援施設入所事業', '助産施設入所事業', 'ひとり親家庭等支援事業', '養育費の保証促進補助金事業', '子育て支援事業', '子育て支援センター事業'];
export const toda = municipality('11224', parse, EXISTING);
