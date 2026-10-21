import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, municipality, rating } from './h4-util';

/** Yamanashi 教育委員会 自己点検・評価報告書 (令和5年度・令和4年度事業対象): one PDCA sheet per 事務事業. */
function yamanashiSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const title = t.match(/^令和 5 年度\n\n山梨市教育委員会\n自己点検・評価報告書\n\n【令和 4 年度事業対象】\n/);
  const legend = t.match(/評価の点数表\n\n(５：[^\n]+\n４：[^\n]+\n３：[^\n]+\n２：[^\n]+\n１：[^\n]+)\n/);
  if (!title || !legend) return [];
  const heads = [...t.matchAll(/\n\n(\S+課)\n\n([①-⑳])\n\n([^\n]+)\n\nＰＬＡＮ（計画）\n/g)];
  return heads.map((m, k) => {
    const from = m.index!, to = heads[k + 1]?.index ?? t.length, seg = t.slice(from, to);
    const p = project(input, m[3], m[3], 2023, m[0].trim(), from + 2);
    p.projectCode = null; p.department = m[1]; p.evaluatedFiscalYear = 2022;
    p.evidence.push(evidence(input, title[0].trim(), 0));
    const scores = [...seg.matchAll(/\n評価の点数\n\n([1-5])\n/g)];
    if (scores.length === 1) p.ratings.push(rating(input, 'self', '評価の点数', scores[0][1], legend[1].replace(/\n/g, '／'), scores[0][0].trim(), from + scores[0].index! + 1));
    const ways = [...seg.matchAll(/\n(拡充|継続|改善|縮小|廃止|休止)\n/g)];
    if (seg.includes('今後の方向性') && ways.length === 1) p.ratings.push(rating(input, 'self', '今後の方向性', ways[0][1], null, ways[0][1], from + ways[0].index! + 1));
    p.warnings.push('事務局の自己点検・評価シート（PDCA）の事業名・担当課・評価の点数・今後の方向性（シート内に選択語が1つだけの場合）を収録。必要性/効率性/有効性の設問回答・事業概要は未構造化。金額の記載はない。');
    return p;
  });
}

/** Miyada 事務事業評価の結果（令和3年度・令和2年度実施事業）: 事業別結果一覧 rows whose cells stay on one visual row. */
function miyadaList(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const title = t.match(/^令和３年度\n\n宮田村事務事業評価の結果\n/), done = t.indexOf('今年度は令和２年度に実施した事業のうち');
  if (!title || done < 0) return [];
  const rows = /\n(\d{4}(?:-\d)?)\n\n([^\n]+)\n\n([^\n]*(?:課|局|室)[^\n]*)\n\n([\d,]+)\n\n([A-D]|‐|-)\n\n([A-D]|‐|-)\n/g;
  return [...t.matchAll(rows)].map(m => {
    const at = m.index! + 1, raw = m[0].slice(1, -1);
    const p = project(input, m[1], m[2], 2021, raw, at);
    p.department = m[3]; p.evaluatedFiscalYear = 2020;
    p.evidence.push(evidence(input, '今年度は令和２年度に実施した事業のうち', done));
    let cursor = m[1].length + m[2].length + m[3].length;
    cursor = raw.indexOf(`\n\n${m[4]}\n\n`, cursor) + 2;
    p.amounts.push(amount(input, 'actual', 2020, m[4], '千円', m[4], at + cursor));
    cursor += m[4].length;
    [['一次評価（担当課）', m[5]], ['事務局判定', m[6]]].forEach(([label, value]) => {
      cursor = raw.indexOf(`\n\n${value}`, cursor) + 2;
      if (/^[A-D]$/.test(value)) p.ratings.push(rating(input, 'self', label, value, 'A:良好に実施／B:改善の余地あり／C:改善を要する／D:抜本的見直し', value, at + cursor));
    });
    if (!p.ratings.length) p.warnings.push('一次評価・事務局判定は「‐」（評価略：法定受託事務で一般財源の支出がない事業等）。');
    p.warnings.push('事業別結果一覧のうち、コード・事業名・担当・R02決算額（千円）・一次評価・事務局判定が1行に連続して抽出された行のみ収録（列が崩れた行は除外）。二次（理事者）評価・予算・意見と個別の決算/評価シートは列の対応が崩れているため未収録。');
    return p;
  });
}

export const yamanashi = municipality('19205', ['6cc7ed04f184d879f49572c3'], yamanashiSheets);
export const miyada = municipality('20388', ['dcbcb574dfd0ef3c53b4c965'], miyadaList);
