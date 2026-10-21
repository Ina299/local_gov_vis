import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, project } from '../shared';
import { amount, municipality, num } from './g4-util';

const HEAD = '令和８年度 事業評価書\n令和７年度事業名\n';

/** Yokohama 令和8年度事業評価書 (様式1): one sheet per budget business, evaluating the 令和7年度 business. */
function parse(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.format !== 'pdf' || !t.startsWith('様式１\n\n令和８年度事業評価書\n\n目次')) return [];
  const starts: number[] = [];
  for (let i = t.indexOf(HEAD); i >= 0; i = t.indexOf(HEAD, i + 1)) starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const seg = t.slice(s, starts[k + 1] ?? t.length);
    // Two layouts: name/department after their labels, or both after "政策・施策" (department may follow 歳出予算科目).
    const h = seg.match(/^令和８年度 事業評価書\n令和７年度事業名\n\n([^\n]+)\n\n所管区局・課\n\n([^\n]+)\n\n政策・施策\n/)
      ?? seg.match(/^令和８年度 事業評価書\n令和７年度事業名\n所管区局・課\n政策・施策\n\n([^\n]+)\n(?:歳出予算科目 [^\n]+\n\n)?([^\n]+)\n\n政策番号\n/);
    const c = seg.match(/事業決算額\n事業費\n（千円）\n\n年度\n\n６年度\n\n決算\n\n７年度\n\n?([\s\S]*?)\n\n各細事業の分析結果を踏まえた事業改善の検討等\n/);
    if (!h || !c || /^\d|課$/.test(h[1]) || !/(局|区|室|課|部|本部|事務局)/.test(h[2])) return;
    const values = [...c[1].matchAll(/(?:^|\n)(▲ ?)?([\d,]+)(?=\n|$)/g)];
    const labels = c[1].replace(/(?:^|\n)(?:▲ ?)?[\d,]+(?=\n|$)/g, '').trim();
    if (values.length !== 3 || labels !== '差引（増減）') return;
    const [y6, y7, diff] = values.map(v => (v[1] ? -1 : 1) * num(v[2]));
    if (y6 + diff !== y7) return; // column order confirmed by the printed difference
    const p = project(input, `${h[1]}|${h[2]}`, h[1], 2026, seg.slice(0, h[0].length), s);
    p.projectCode = null; p.department = h[2]; p.evaluatedFiscalYear = 2025;
    p.activities = seg.match(/\n事業概要\n([\s\S]*?)\n+事業決算額\n/)?.[1].trim() || null;
    const raw = c[0], at = s + c.index!;
    p.amounts.push(amount(input, 'actual', 2024, values[0][2], '千円', raw, at), amount(input, 'actual', 2025, values[1][2], '千円', raw, at));
    p.warnings.push('事業決算額欄の６年度・７年度を決算として収録（欄の差引（増減）で列順を検算済み）。細事業の分析・事業量・客観的指標の選択肢は段組みが崩れて列の対応が確定できないため未構造化。評価書番号は款・項・目の並びが崩れているため未設定。');
    if (h[1].includes('人件費')) p.warnings.push('職員人件費の評価書。金額は人件費の決算額だが、他事業の事業費と同じ「事業決算額」欄の値として actual で収録。');
    out.push(p);
  });
  return out;
}

export const yokohama = municipality('14100', parse);
