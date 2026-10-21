import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { acrossDocuments, amount, at, num, sheets, type Entry } from './i1-util';

/** 令和7年度内部評価結果（令和6年度実施事業）の施策体系順の評価調書 R7-n-n.pdf。 */
const KAWAGUCHI_DOCS = new Set(['0632535270c99f1a3f3d74d4', '1103bcf6073157200e56e8fa', '12c05587978c661fce2bb28f', '13bd7aea87442ad3106618ea', '1ad0e8393c3797bb227f3de2',
  '25c82b86c0095c45ec5d2602', '281968e9b10df926977f5c19', '31d38115fe8d111a010a6fcc', '3a6d3c5415f0976a20e574e1', '3ab4a1a73443cddf06266947', '444fe8553512a120a38930b6',
  '45623cdd41c8040e7b730b0b', '5a5ff7de634288b7509e7383', '5fd19f681c4814e0413abac9', '7e1534876711e71653bbff8c', '9aad7814d61896eca2ee3ab1', '9b635c33e2dbc3e9260fe001',
  'a2a03858f221ebc7fb90f6fd', 'a7a9be49836e03bddeb816ac', 'aff60b28fa400c00f5f30b71', 'c494983e0fb9518ad61a13aa', 'e116e3cc14f7724955de4e70', '11b89e0f51eb7cb014f82a95']);
const DIRECTIONS = '拡充して実施|現状維持で実施|効率化して実施|縮小して実施|他事業に統合されて実施|休止|完了|廃止';
const SECTION = /^[^\-()（）\n0-9]{1,30}(課|室|センター|プラザ|所|館|署|園|事務局|場|校)$/;

function sheetRecords(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11203' || !KAWAGUCHI_DOCS.has(input.sourceId)) return [];
  const out: ProjectEvaluation[] = [];
  for (const sh of sheets(input.text, '実施計画事業評価調書\n')) {
    const headEnd = sh.text.indexOf('１ 事業期間');
    if (headEnd < 0) continue;
    const head = sh.text.slice(0, headEnd);
    const nm = /\n([^\n]+)\n\n担当\n\n([^\n]+)\n/.exec(head), fy = /\n(令和6年度)\n/.exec(head), fyLabel = /\n(評価対象年度)\n/.exec(head);
    // 評価対象年度の欄は段組みで位置が揺れるため、見出し部に年度表記が令和6年度の1つだけの票に限る。
    if (!nm || !fy || !fyLabel || (head.match(/令和\d+年度/g) ?? []).length !== 1) continue;
    const sections = head.split('\n').filter(l => l !== nm[2] && SECTION.test(l) && !['事業区分', '評価対象年度', '問い合わせ先'].includes(l));
    const name = nm[2].trim();
    const p = project(input, `${nm[1]}:${sections.length === 1 ? sections[0] : ""}:${name}`, name, null, nm[0].slice(1, -1), sh.start + nm.index! + 1);
    p.evaluatedFiscalYear = 2024;
    p.department = sections.length === 1 ? `${nm[1]} ${sections[0]}` : nm[1];
    p.evidence.push(evidence(input, '実施計画事業評価調書', sh.start), at(input, sh.start, fy, 1), at(input, sh.start, fyLabel, 1));
    if (sections.length === 1) p.evidence.push(evidence(input, sections[0], sh.start + head.indexOf(`\n${sections[0]}\n`) + 1));
    else p.warnings.push('調書の段組みから担当課が1つに確定しないため、担当は部名のみ収録。');
    // 総評価（60点満点）。抽出テキスト上の位置が2通りあるため、見つかった値がすべて同じ1つの数値の場合のみ採用する。
    const tail = sh.text.slice(sh.text.indexOf('６ 総評価'));
    const total = [...tail.matchAll(/\n総評価\n\n(\d{1,2})\n/g), ...tail.matchAll(/\n(\d{1,2})\n／60\n/g)].sort((x, y) => x.index! - y.index!);
    const tailStart = sh.start + sh.text.indexOf('６ 総評価');
    if (sh.text.includes('６ 総評価') && total.length && new Set(total.map(t => t[1])).size === 1 && Number(total[0][1]) <= 60) {
      p.ratings.push({ kind: 'self', label: '総評価（必要性・効率性・有効性・公平性の視点評価の合計）', value: total[0][1], scale: '60点満点', evidence: at(input, tailStart, total[0]) });
    }
    for (const [label, re] of [['今後の実施方向性（翌年度）', new RegExp(`翌年度 (${DIRECTIONS})\\n`)], ['今後の実施方向性（翌々年度）', new RegExp(`翌々年度 (${DIRECTIONS})\\n`)]] as const) {
      const d = re.exec(tail);
      if (sh.text.includes('６ 総評価') && d) p.ratings.push({ kind: 'self', label, value: d[1], scale: null, evidence: evidence(input, d[0].slice(0, -1), tailStart + d.index) });
    }
    // 年度別事業費（千円）: 決算額（Ｂ）の3列（令和4〜6年度）を、特定財源（Ｃ）＋一般財源（Ｄ）＝決算額（Ｂ）の検算が全列一致した場合のみ採用。
    const b = /決算額（Ｂ）＝（Ｃ）＋（Ｄ）\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n/.exec(sh.text);
    const c = /\n特定財源（Ｃ）\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n/.exec(sh.text), d = /\n一般財源（Ｄ）\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n/.exec(sh.text);
    const years = /\n年度\n\n令和4年度\n/.test(sh.text) && sh.text.includes('令和5年度') && sh.text.includes('令和6年度');
    if (b && c && d && years && [1, 2, 3].every(i => num(c[i]) + num(d[i]) === num(b[i]))) {
      const raw = b[0].slice(0, -1), bs = sh.start + b.index;
      [2022, 2023, 2024].forEach((y, i) => { if (num(b[i + 1]) > 0) p.amounts.push(amount(input, 'actual', y, b[i + 1], '千円', raw, bs)); });
      p.evidence.push(at(input, sh.start, c), at(input, sh.start, d));
      p.warnings.push('金額は「４ 年度別事業費（単位：千円）」の決算額（Ｂ）＝（Ｃ）＋（Ｄ）の令和4〜6年度の3列で、特定財源（Ｃ）＋一般財源（Ｄ）との検算が全列一致した場合のみ実績として収録。予算額（Ａ）・概算人件費（Ｅ）・総事業費は段組みが崩れるため未収録。0の年度は未収録。');
    }
    p.warnings.push('実施計画事業評価調書（評価対象年度 令和6年度）から事業名・担当部（課）・総評価・今後の実施方向性を収録。評価年度（令和7年度内部評価）は掲載ページ・概要資料の表記で調書本文に無いため未設定。指標（目標値・実績値）、視点評価の各項目は段組みが崩れるため未構造化。');
    out.push(p);
  }
  return out;
}

export function extractKawaguchi(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  return acrossDocuments(input, inputs, sheetRecords, p => `${p.department}|${p.projectName}`);
}

export const kawaguchiEntries: Record<string, Entry> = {
  '11203': { extract: extractKawaguchi, scope: '令和7年度内部評価（令和6年度実施事業）の施策体系順の評価調書PDFに含まれる実施計画事業評価調書の各票から、事業名・担当部課・総評価（60点満点）・今後の実施方向性（翌年度・翌々年度）と、財源内訳との検算が一致した令和4〜6年度の決算額（千円）を構造化。施策評価調書、目標指標、視点評価の各項目、予算額・概算人件費は対象外。' },
};
