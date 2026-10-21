import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/** 大河原町 大規模事業評価の自己評価調書（事業単位の事前評価）。委員会資料・要求水準書・答申・会議録は対象外。 */
const SHEETS = new Set(['0f44ca1a9e41e9b872b721d2', '489e51a8c68c9a257206aa9b', 'f9153ae0d86fba5997448f5e', 'aad9340dc01c6bf8b764639e']);

export function extractOgawara(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '04321' || !SHEETS.has(input.sourceId)) return [];
  const h = input.text.match(/(自 己 評 価 調 [査書]|自\n\n己\n\n評 価 調\n\n書)\n([^\n]+)\n((?:平成|令和)[０-９\d]+年[０-９\d]+月作成)\n\n?１．事業の概要\n事業の名称\n\n([^\n]+)\n\n事業の内容\n/);
  if (!h) return [];
  const start = h.index!, name = h[4].trim();
  const p = project(input, name, name, null, h[0].trimEnd(), start);
  p.projectCode = null;
  p.department = h[2].replaceAll(' ', '');
  const score = input.text.match(/評価の観点等に基づく評価結果は、次のと\nおりである。/);
  if (score) p.evidence.push(evidence(input, score[0], score.index!));
  p.warnings.push(`大規模事業評価（事前評価）の自己評価調書（${h[3]}）。作成年月のみで評価年度の表記がないため評価年度・評価対象年度は未設定。`);
  p.warnings.push('事業費は計画・見込額（建設費・維持管理費の試算）であり決算・予算の確定値ではないため金額は未収録。評価結果は要綱各号の観点ごとの記述式で段階評価がないため ratings なし。');
  return [p];
}
