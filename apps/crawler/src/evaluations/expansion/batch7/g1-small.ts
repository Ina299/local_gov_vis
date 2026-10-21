import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints } from './g1-util';

/** 境町 平成25年度 事務事業評価の一覧（事業名・担当課・区分・財源・事業費・総合評価）。 */
export function extractSakai(input: CachedInput): ProjectEvaluation[] {
  const heading = '平成２５年度行政評価\n\n事務事業評価';
  if (input.municipalityCode !== '08546' || input.sourceId !== 'e8559c91b16afc4b0cf5dd99' || !input.text.startsWith(heading)) return [];
  const legend = '総合評価 1.計画どおり事業を進めることが適当 2.事業の進め方に改善が必要\n3.事業規模や内容の見直しが必要\n4.事業の抜本的見直しや廃止が必要';
  if (!input.text.includes(legend)) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(/^([^\n]+)\n\n(\S+(?:課|室|園))\n\n(継続|新規) (補助|単独)\n\n([\d,]+)\n\n([1-4])$/gm)) {
    const p = project(input, `${m[2]}:${m[1]}`, m[1], 2013, m[0], m.index);
    p.department = m[2];
    p.ratings.push({ kind: 'self', label: '総合評価', value: m[6], scale: legend.replace(/^総合評価 /, '').replaceAll('\n', ' '), evidence: evidence(input, m[0], m.index) });
    p.evidence.push(evidence(input, heading, 0), evidence(input, legend));
    p.warnings.push('平成25年度行政評価（事務事業評価）一覧の行から事業名・担当課・総合評価のみ収録。事業費(千円)は予算・決算の別と年度が表に明記されないため金額として収録していません。今後の方向性は列の折返しで行との対応を確定できないため未収録。評価対象年度は本文に明記がなく未設定。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

/** 福島町 令和7年度（令和6年度決算）事務事業評価結果表の評価点集表の行。 */
export function extractFukushima(input: CachedInput): ProjectEvaluation[] {
  const heading = '令和７年度（令和６年度決算） 事務事業評価結果表\nR７評価点集表';
  if (input.municipalityCode !== '01332' || input.sourceId !== '527239bf6bce14df1c6aec0a' || !input.text.startsWith(heading)) return [];
  const end = input.text.indexOf('事務事業評価シート'), table = input.text.slice(0, end < 0 ? input.text.length : end), out: ProjectEvaluation[] = [];
  const row = /\n\n(\d+)\n\n(?:([^\n]+?)\n\n([^\n]+?)|(\S+?(?:局|課|係|所|室|センター|園)) (\S+))\n\n(\d)\n\n(\d)\n\n(\d+)\n\n(-?\d)\n\n(-?\d)\n\n(-?\d+)\n\n(\d+)\n\n([A-D])\n\n([A-D])\n\n([A-D])\n\n([A-D])(?=\n)/g;
  for (const m of table.matchAll(row)) {
    const [need, eff, sum1, ach, out2, sum2, total] = [6, 7, 8, 9, 10, 11, 12].map(i => Number(m[i]));
    if (need + eff !== sum1 || ach + out2 !== sum2 || sum1 + sum2 !== total) continue;
    const dept = m[2] ?? m[4], name = m[3] ?? m[5], raw = m[0].slice(2), s = m.index! + 2;
    if (!/(?:局|課|係|所|室|センター|園)$/.test(dept)) continue;
    const p = project(input, `整理番号${m[1]}`, name, 2025, raw, s);
    p.department = dept; p.evaluatedFiscalYear = 2024;
    const rate = (label: string, value: string) => p.ratings.push({ kind: 'self', label, value, scale: null, evidence: evidence(input, raw, s) });
    rate('必要性（点）', m[6]); rate('有効性（点）', m[7]); rate('達成度（点）', m[9]); rate('効果性（点）', m[10]); rate('点数計', m[12]);
    rate('項目別評価', m[13]); rate('担当課評価', m[14]); rate('2次評価', m[15]); rate('3次評価', m[16]);
    p.evidence.push(evidence(input, heading, 0));
    p.warnings.push('評価点集表の1行（整理番号・担当課・事務事業名・項目別点数・評価）から収録し、必要性+有効性、達成度+効果性、点数計の検算が一致した行のみ。評価の列名は表頭の並び（項目別・担当課・2次・3次）による。個別の評価シートの事業費・指標は未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}
