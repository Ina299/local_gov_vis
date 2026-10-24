import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount } from '../batch9/i1-util';
import { type Entry, uniqueBy } from './m1-util';

// ---------------------------------------------------------------- 33622 勝央町 元気なまち総合戦略 事業実施評価調書（令和5年度）
const SOURCE = '24bea74e0d1280a0dc4ad7ec';
const HEAD = '令和5年度\n①\n\n勝央町元気なまち総合戦略 事業実施評価調書';
const COLUMNS = '実績額（単位：千円）';
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023];
const V = '(-|ー|－|\\d[\\d,]*)';
// 担当部署 followed by the six 実績額 cells (平成30〜令和5年度), as printed in one row.
const BLOCK = new RegExp(`\\n([^\\n]{2,6}部)\\n\\n${Array(6).fill(V).join('\\n\\n')}\\n`, 'g');
const NAME = /\n([^\n（]+)\n(\d{1,2})(?:\n\n| )（[①-⑤]/g;

function extractShoo(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.municipalityCode !== '33622' || input.sourceId !== SOURCE || !t.startsWith(HEAD) || !t.includes(COLUMNS)) return [];
  const names = [...t.matchAll(NAME)], blocks = [...t.matchAll(BLOCK)];
  const out: ProjectEvaluation[] = [];
  names.forEach((m, i) => {
    const name = m[1].trim(), no = Number(m[2]);
    // A line that is only the tail of a wrapped name (e.g. 「進事業」) is not a business name.
    if (name.length < 4) return;
    const p = project(input, `No.${no}`, name, null, m[0].trim(), m.index! + m[0].indexOf(m[1]));
    p.evaluatedFiscalYear = 2023;
    p.evidence.push(evidence(input, HEAD, 0));
    // The row's department and amounts are attributed only when the next row number is also recognised and exactly one row block lies in between.
    const next = names[i + 1], end = next?.index ?? t.length;
    const inside = blocks.filter(b => b.index! > m.index! && b.index! < end);
    if (next && Number(next[2]) === no + 1 && inside.length === 1) {
      const b = inside[0], raw = b[0].slice(1, -1), at = b.index! + 1;
      p.department = b[1];
      YEARS.forEach((y, k) => { if (/\d/.test(b[k + 2])) p.amounts.push(amount(input, 'actual', y, b[k + 2], '千円', raw, at)); });
      p.warnings.push('担当部署と実績額（千円・平成30〜令和5年度）は、同じ行の担当部署の直後に6年度分の数値が並ぶ箇所が、この事業と次の番号の事業の間に1つだけある場合のみ収録（「-」は未記載として除外）。');
    } else p.warnings.push('事業の行の列（担当部署・実績額・KPI）が隣の事業と抽出テキスト上で混在し対応が確定できないため、事業名のみ収録。');
    p.warnings.push('勝央町元気なまち総合戦略 事業実施評価調書（令和5年度）。KPIの指標値・実績値、事業効果・事業評価・今後の方針は表の列が抽出テキストで分離・混在しているため未収録。評価実施年度は本文に明示がないため未設定。');
    out.push(p);
  });
  return uniqueBy(out);
}

export const shooEntries: Record<string, Entry> = {
  '33622': {
    extract: input => extractShoo(input),
    scope: '元気なまち総合戦略 事業実施評価調書（令和5年度）から、事業名が1行で読める総合戦略事業の事業名・番号と、行の対応が確定する場合のみ担当部署・実績額（千円・平成30〜令和5年度）を構造化。KPI・評価区分は列崩れのため対象外。企業版ふるさと納税・デジタル田園都市国家構想交付金の実施結果報告は対象外。',
  },
};
