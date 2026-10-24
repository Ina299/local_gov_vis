import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, num, sheets, type Entry } from '../batch9/i1-util';
import { municipality } from './m2-util';

// ---------------------------------------------------------------- 川口市 令和５年度内部評価（令和４年度実施事業）の施策評価調書PDF内の実施計画事業評価調書
const DIRECTIONS = '拡充して実施|現状維持で実施|効率化して実施|縮小して実施|他事業に統合されて実施|休止|完了|廃止';
const BUREAU = /^[^\s\-()（）0-9]{1,15}(部|局|市長室)$/;
const SECTION = /^[^\s\-()（）0-9]{1,30}(課|室|センター|プラザ|所|館|署|園|事務局|場|校)$/;
const HEAD_LABELS = new Set(['事業区分', '評価対象年度', '問い合わせ先', '担当', '新規・継続', '通常事業', '主要事業']);

export function kawaguchiR5(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith('施策評価調書（１）\n\n令和4年度\n\n評価対象年度\n')) return [];
  const out: ProjectEvaluation[] = [];
  for (const sh of sheets(t, '実施計画事業評価調書\n')) {
    const headEnd = sh.text.indexOf('１ 事業期間');
    if (headEnd < 0) continue;
    const head = sh.text.slice(0, headEnd);
    const lines = head.split('\n').filter(l => l.trim());
    // 見出し部の年度表記が「令和4年度」1つだけの票に限る（評価対象年度の欄は段組みで位置が揺れる）。
    const years = head.match(/令和\d+年度/g) ?? [];
    if (lines[1] !== '事業名称' || years.length !== 1 || years[0] !== '令和4年度') continue;
    const name = lines[2] === '評価対象年度' ? lines[3] : lines[2];
    if (!name || HEAD_LABELS.has(name) || BUREAU.test(name)) continue;
    const nameAt = sh.start + head.indexOf(`\n${name}\n`) + 1;
    const pairs = lines.flatMap((l, i) => (BUREAU.test(l) && SECTION.test(lines[i + 1] ?? '') && !HEAD_LABELS.has(lines[i + 1]) ? [i] : []));
    const p = project(input, `R4:${name}`, name, null, name, nameAt);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2022;
    const fyAt = sh.start + head.indexOf('\n令和4年度\n') + 1;
    p.evidence.push(evidence(input, '実施計画事業評価調書', sh.start), evidence(input, '令和4年度', fyAt), evidence(input, '評価対象年度', sh.start + head.indexOf('\n評価対象年度\n') + 1));
    if (pairs.length === 1) {
      const raw = `${lines[pairs[0]]}\n${lines[pairs[0] + 1]}`;
      if (head.includes(`\n${raw}\n`)) {
        p.department = `${lines[pairs[0]]} ${lines[pairs[0] + 1]}`;
        p.evidence.push(evidence(input, raw, sh.start + head.indexOf(`\n${raw}\n`) + 1));
      }
    }
    if (!p.department) p.warnings.push('調書の段組みから担当部課が1つに確定しないため未収録。');
    const tailAt = sh.text.indexOf('６ 総評価');
    if (tailAt >= 0) {
      const tail = sh.text.slice(tailAt);
      for (const [label, re] of [['今後の実施方向性（翌年度）', new RegExp(`\\n翌年度 (${DIRECTIONS})\\n`)], ['今後の実施方向性（翌々年度）', new RegExp(`\\n翌々年度 (${DIRECTIONS})\\n`)]] as const) {
        const d = re.exec(tail);
        if (d) p.ratings.push({ kind: 'self', label, value: d[1], scale: null, evidence: evidence(input, d[0].slice(1, -1), sh.start + tailAt + d.index + 1) });
      }
    }
    // ４ 年度別事業費（千円）: 年度見出し（令和2〜6年度）の直後の表で、決算額（Ｂ）の3列（令和2〜4年度）が特定財源（Ｃ）＋一般財源（Ｄ）の各列と一致した場合のみ。
    const yearsRow = /\n令和2年度\n令和3年度\n令和4年度\n令和5年度\n(?:令和6年度\n)?予算額（Ａ）\n/.exec(sh.text);
    const b = /\n決算額（Ｂ）＝（Ｃ）＋（Ｄ）\n([\d,]+)\n([\d,]+)\n([\d,]+)\n財\n/.exec(sh.text);
    const c = /\n特定財源（Ｃ）\n([\d,]+)\n([\d,]+)\n([\d,]+)\n/.exec(sh.text), d = /\n一般財源（Ｄ）\n([\d,]+)\n([\d,]+)\n([\d,]+)\n/.exec(sh.text);
    if (yearsRow && b && c && d && b.index > yearsRow.index && [1, 2, 3].every(i => num(c[i]) + num(d[i]) === num(b[i]))) {
      const raw = b[0].slice(1, -3), bs = sh.start + b.index + 1;
      [2020, 2021, 2022].forEach((y, i) => { if (num(b[i + 1]) > 0) p.amounts.push(amount(input, 'actual', y, b[i + 1], '千円', raw, bs)); });
      p.evidence.push(evidence(input, yearsRow[0].slice(1, -1), sh.start + yearsRow.index + 1), evidence(input, c[0].slice(1, -1), sh.start + c.index + 1), evidence(input, d[0].slice(1, -1), sh.start + d.index + 1));
      p.warnings.push('金額は「４ 年度別事業費（単位：千円）」の決算額（Ｂ）＝（Ｃ）＋（Ｄ）の令和2〜4年度の3列で、特定財源（Ｃ）＋一般財源（Ｄ）との検算が全列一致した場合のみ実績として収録。予算額（Ａ）・概算人件費（Ｅ）・総事業費は列の並びが確定しないため未収録。0の年度は未収録。');
    }
    p.warnings.push('令和5年度行政評価（内部評価）の施策評価調書PDFに含まれる実施計画事業評価調書（評価対象年度 令和4年度）。評価年度は調書本文に無いため未設定。総評価（60点満点）・視点評価・指標は段組みで値の位置が揺れるため未収録。');
    out.push(p);
  }
  return out;
}

export const kawaguchiEntries: Record<string, Entry> = {
  '11203': {
    extract: municipality(kawaguchiR5, p => `${p.department}|${p.projectName}`),
    scope: '川口市 令和5年度内部評価（令和4年度実施事業）の施策評価調書PDF（第6章の2施策分）に含まれる実施計画事業評価調書の事業名・担当部課・今後の実施方向性と、財源内訳との検算が一致した令和2〜4年度の決算額（千円）。施策評価調書・施策評価結果一覧・見方・内部評価結果の概要、総評価点・視点評価・指標・予算額・人件費は対象外。',
  },
};
