/** Batch-12 (m3) extractor for 01636 清水町（北海道）: 令和５年度物価高騰対応重点支援地方創生臨時交付金充当事業の効果検証（一覧表）. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { nfkc, num, type Entry } from '../batch9/i1-util';

const SOURCE = 'f85b30ee0ef20baf588d8970';
const TITLE = '令和５年度物価高騰対応重点支援地方創生臨時交付金充当事業の効果検証';
// A row printed in order: 事業始期, 事業終期, 総事業費, 交付対象経費, その他, 効果検証, 担当課.
const ROW = /\n\n(R\d\.\d+\.\d+)\n\n(R\d\.\d+\.\d+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n((?:[^\n]+\n)*?[^\n]+)\n\n([^\n]+課)(?=\n|$)/g;

function shimizu(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01636' || input.sourceId !== SOURCE || !input.text.startsWith(TITLE)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  let prev = 0;
  for (const m of t.matchAll(ROW)) {
    const seg = t.slice(prev, m.index!), segAt = prev;
    prev = m.index! + m[0].length;
    // The name is the cell printed right before the ①目的・効果 cell of the same row; rows whose name is printed elsewhere are skipped.
    const blocks = seg.split('\n\n'), first = blocks.findIndex(b => b.startsWith('①'));
    if (first < 1 || /^\d+$/.test(blocks[first - 1].trim())) continue;
    // Column check: 総事業費 = 交付対象経費 + その他.
    if (num(m[3]) !== num(m[4]) + num(m[5])) continue;
    const nameRaw = blocks[first - 1], nameAt = segAt + blocks.slice(0, first - 1).reduce((a, b) => a + b.length + 2, 0);
    const name = nameRaw.split('\n').join('');
    const p = project(input, nfkc(name), name, null, nameRaw, nameAt);
    p.projectCode = null;
    p.department = m[7];
    p.evidence.push(evidence(input, TITLE, 0), evidence(input, m[0].trim(), m.index! + 2));
    p.warnings.push('事務事業評価ではなく地方創生臨時交付金の効果検証（交付対象事業ごと）。',
      `事業期間は${m[1]}〜${m[2]}。総事業費（${m[3]}円）・交付対象経費（${m[4]}円）は表見出しに決算・予算の別がなく、事業期間が年度をまたぐため金額欄には収録しない（総事業費＝交付対象経費＋その他の検算は一致）。評価年度・評価対象年度は本文に明記がないため未設定（表題は令和５年度の交付金）。`);
    out.push(p);
  }
  return out;
}

export const shimizuEntries: Record<string, Entry> = {
  '01636': {
    extract: input => shimizu(input),
    scope: '清水町 令和５年度物価高騰対応重点支援地方創生臨時交付金充当事業の効果検証の一覧表のうち、事業名・担当課・事業期間の行対応が確定する交付対象事業（総事業費の検算一致行）。交付金の効果検証であり事務事業評価ではない。金額（決算・予算の別がない）、令和６年度版・実施計画・機構図、名称が別位置に出力される行は対象外。',
  },
};
