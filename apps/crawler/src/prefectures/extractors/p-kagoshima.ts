/**
 * 鹿児島県「主要施策の成果に関する調書」（令和6年度、部局別PDF）。施策ごとの表（単位：千円）に
 * 予算科目の行と、その内訳の事業の行があり、各行に 予算額・財源内訳（国庫支出金／その他の特定財源／一般財源）・
 * 決算額・財源内訳（同）の8列が並ぶ。8つの値が抽出テキストで連続し、予算額＝財源3列の和・決算額＝財源3列の和の
 * 検算が合う行だけを読み、さらに「科目の行＝直後の内訳行の合計（8列すべて）」が成り立つ組の内訳行だけを事業として収録する。
 * 担当課は表の下の「(n) 事業名（○○課）」の見出しに同じ事業名がある場合のみ。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { acrossDocuments, amount, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const NUM = /^(?:\d{1,3}(?:,\d{3})*|－|-)$/;
const val = (s: string) => (s === '－' || s === '-' ? 0 : Number(s.replace(/,/g, '')));
const TITLE = /^令 和 (\d|[０-９]) 年 度\n\n主要施策の成果に関する調書\n/;
const UNIT = '（単位：千円）';
const SECTION = /\n\((\d+)\) ?([^\n（]+?)（([^（）\n]+)）\n\n?(?:<1>|〈1〉|＜ ?1 ?＞) ?施策の目的/g;

type Row = { label: string; rawLabel: string; labelAt: number; values: string[]; raw: string; at: number };

/** 表の領域（単位表記から次の「(n) 見出し」または次の表まで）を8列の行に分ける。 */
function rows(t: string, from: number, to: number): Row[] {
  const toks = [...t.slice(from, to).matchAll(/\S+/g)].map(m => ({ s: m[0], at: from + m.index! }));
  const out: Row[] = [];
  let j = 0, prev = 0;
  while (j + 8 <= toks.length) {
    const w = toks.slice(j, j + 8).map(x => x.s);
    if (w.every(x => NUM.test(x)) && val(w[0]) > 0 && val(w[0]) === val(w[1]) + val(w[2]) + val(w[3]) && val(w[4]) === val(w[5]) + val(w[6]) + val(w[7])) {
      // 行名: 直前の行から続く語。行頭の「内 」「訳 」（縦書きの「内訳」の欄名）は除く
      const between = toks.slice(prev, j);
      const labelAt = between[0]?.at ?? toks[j].at;
      const rawLabel = between.length ? t.slice(labelAt, between.at(-1)!.at + between.at(-1)!.s.length) : '';
      const label = rawLabel.split('\n').map(l => l.trim().replace(/^[内訳] /, '')).filter(l => l && l !== '内' && l !== '訳' && l !== '内訳').join('').replace(/\s/g, '');
      const at = toks[j].at, last = toks[j + 7];
      out.push({ label, rawLabel, labelAt, values: w, raw: t.slice(at, last.at + last.s.length), at });
      prev = j + 8; j += 8;
    } else j++;
  }
  return out;
}

const clean = (l: string) => l.length >= 3 && l.length <= 50 && !/[0-9０-９,，－]|予算|決算|財源|国庫|単位|支出金|^計$/.test(l);

function extractKagoshima(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const title = TITLE.exec(t);
  if (!title) return [];
  const fy = 2018 + Number(title[1].normalize('NFKC'));
  const sections = [...t.matchAll(SECTION)].map(m => ({ at: m.index! + 1, name: m[2].replace(/\s/g, ''), dept: m[3].trim(), raw: m[0].slice(1, m[0].indexOf('\n', 1)) }));
  const units: number[] = [];
  for (let i = t.indexOf(UNIT); i >= 0; i = t.indexOf(UNIT, i + 1)) units.push(i);
  const out: ProjectEvaluation[] = [];
  const used = new Map<string, number>();
  units.forEach((u, ui) => {
    const nextSec = sections.find(s => s.at > u)?.at ?? t.length;
    const end = Math.min(nextSec, units[ui + 1] ?? t.length);
    const rs = rows(t, u, end);
    const secEnd = units.find(x => x > u && x >= end) ?? t.length; // この表の下の見出しの範囲（次の表まで）
    // 科目の行＝直後の連続する内訳行の合計（8列すべて）となる組を探し、組の内訳行だけを事業とする
    let i = 0;
    while (i < rs.length) {
      let found = -1;
      const sums = Array(8).fill(0);
      for (let j = i + 1; j < rs.length; j++) {
        rs[j].values.forEach((v, k) => { sums[k] += val(v); });
        if (sums.every((s, k) => s === val(rs[i].values[k]))) { found = j; break; }
      }
      if (found < 0) { i++; continue; }
      for (const r of rs.slice(i + 1, found + 1)) {
        if (!clean(r.label) || /再掲/.test(r.label)) continue;
        // 行名の完結: 2行に折り返す場合の1行目が「事業」で終わるなら前の行の名前の残りが混入している。
        // 名前の途中で切れた行（続きが表の別の場所に出力される）を除くため、事業／費で終わるか、表の下の「(n) 事業名（課）」見出しと一致するものに限る。
        const parts = r.rawLabel.split('\n').map(l => l.trim().replace(/^[内訳] /, '')).filter(l => l && !['内', '訳', '内訳'].includes(l));
        if (parts.length > 2 || parts.length === 2 && /事業$/.test(parts[0])) continue;
        if (!/(?:事業|費)$/.test(r.label) && !sections.some(x => x.name === r.label)) continue;
        const same = sections.filter(s => s.name === r.label);
        // 表の直下の見出し、なければ文書内で同名の見出しがすべて同じ課を示す場合
        const sec = same.find(s => s.at >= end && s.at < secEnd) ?? (same.length && same.every(s => s.dept === same[0].dept) ? same[0] : undefined);
        const n = (used.get(r.label) ?? 0) + 1; used.set(r.label, n);
        const p = project(input, `${fy}-${r.label}-${n}`, r.label, null, r.rawLabel, r.labelAt);
        p.evaluatedFiscalYear = fy;
        p.evidence.push(evidence(input, title[0].trim(), title.index), evidence(input, UNIT, u), evidence(input, rs[i].raw, rs[i].at));
        p.amounts.push(amount(input, 'budget', fy, r.values[0], '千円', r.raw, r.at));
        if (val(r.values[4]) > 0) p.amounts.push(amount(input, 'actual', fy, r.values[4], '千円', r.raw, r.at));
        else p.warnings.push(`決算額の欄が「${r.values[4]}」のため決算額は未収録。`);
        if (sec) { p.department = sec.dept; p.evidence.push(evidence(input, sec.raw, sec.at)); }
        else p.warnings.push('同じ事業名の「(n) 事業名（担当課）」見出しがない（または課が一致しない）ため担当課は未収録。');
        if (used.get(r.label)! > 1) p.warnings.push('同じ文書に同名の事業が予算科目ごとに別の行で掲載されている（科目別の内訳）。');
        p.warnings.push(`金額は施策別の表（単位：千円）の内訳行の予算額・決算額。予算額・決算額がそれぞれ財源内訳3列の和に一致し、予算科目の行が内訳行の合計に一致（8列とも）することを確認した。決算年度は表題「令和${fy - 2018}年度主要施策の成果に関する調書」による。`);
        out.push(p);
      }
      i = found + 1;
    }
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '46000': {
    scope: '令和6年度主要施策の成果に関する調書（部局別）の施策別の表のうち、予算科目の内訳に掲げられた事業ごとの予算額・決算額（千円）と、表の下の見出しに記された担当課。財源内訳の検算または科目の合計の検算が合わない表・行、行名が抽出テキストで崩れた行、（再掲）の行、予算科目の行・計の行、教育委員会の点検・評価報告書は対象外。',
    extract: (input, inputs) => acrossDocuments(input, inputs, extractKagoshima, p => `${p.projectName}|${p.amounts.map(a => a.amountYen).join(',')}`),
  },
};
