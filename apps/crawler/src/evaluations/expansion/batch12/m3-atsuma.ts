/** Batch-12 (m3) extractor for 01581 厚真町: 第４次厚真町総合計画 実施計画シート（事業評価・内部評価・外部評価欄つき、1事業1資料）. */
import type { EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Entry } from '../batch9/i1-util';

const HEAD = /^第４次厚真町総合計画\n事業名\n\n１\n\n担当課\n\n([^\n]+)\n\n(?:\d\n\n)?(?:([^\n]+課)\n)?/;
const TARGET = /事業評価対象年度\n\n?(?:Ｒ\n\n)?R8 ）\n\n(?:Ｒ\n\n)?(\d) 年度/;
const SELF_SCALE = 'A：妥当である／B：概ね妥当である／C：あまり妥当でない／D：妥当でない';
const DIR_SCALE = '予算・サービス：「継続（拡大・現状維持・縮小）」「終了」／方向性：「拡大」「現状維持」「縮小」「終了」';
const CHECKS: [string, RegExp][] = [
  ['妥当性', /\n妥当性\n\n実施主体・目的・対\n象・手段等は公平か\nつ妥当か？\n\n([ＡＢＣＤ])\n/],
  ['有効性', /\n有効性\n\n期待された成果が得\nられたか？\n\n([ＡＢＣＤ])\n/],
  ['効率性', /\n効率性\n\nコスト面からみた費\n用対効果は適正か？\n\n([ＡＢＣＤ])\n/],
];
const CHOICE = '(継続（(?:拡大|現状維持|縮小)）|終了)';
const DIRECTION = '(拡大|現状維持|縮小|終了)';
const INTERNAL = new RegExp(`内部評価（本欄は、内部評価委員会で使用するため事業担当課は入力しないでください。）\\n予算\\n\\n７\\n\\n(?:[^\\n]*\\n){0,40}?\\n?${CHOICE}\\n\\nサービス\\n\\n${CHOICE}\\n\\n方向性\\n\\n${DIRECTION}\\n\\n意見\\n`);
const EXTERNAL = new RegExp(`外部評価（本欄は、外部評価委員会で使用するため事業担当課は入力しないでください。）\\n評価実施年月日 Ｒ\\n\\n(?:付帯意見\\n（全体意見）\\n\\n)?(\\d+)\\n\\n年\\n\\n(\\d+)\\n\\n月 (\\d+) 日\\n\\n予算\\n\\n${CHOICE} サービス ${CHOICE} 方向性\\n\\n８\\n${DIRECTION}\\n`);

function atsuma(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01581') return [];
  const t = input.text, head = HEAD.exec(t), target = TARGET.exec(t);
  if (!head || !target || !t.includes('実施計画シート')) return [];
  const p = project(input, head[1], head[1], null, head[0].trimEnd(), 0);
  p.projectCode = null;
  p.evaluatedFiscalYear = 2018 + Number(target[1]);
  p.evidence.push(evidence(input, target[0], target.index));
  if (head[2]) p.department = head[2];
  for (const [label, re] of CHECKS) {
    const m = re.exec(t);
    if (m) p.ratings.push({ kind: 'self', label: `事業の評価（Check）${label}`, value: m[1], scale: SELF_SCALE, evidence: evidence(input, m[0].trim(), m.index + 1) });
  }
  const triple = (m: RegExpExecArray, kind: EvaluationRating['kind'], prefix: string, first: number) => {
    const e = evidence(input, m[0].trimEnd(), m.index);
    (['予算', 'サービス', '方向性'] as const).forEach((label, i) => p.ratings.push({ kind, label: `${prefix}${label}`, value: m[first + i], scale: DIR_SCALE, evidence: e }));
  };
  const internal = INTERNAL.exec(t), external = EXTERNAL.exec(t);
  if (internal) triple(internal, 'self', '内部評価 ', 1);
  if (external) {
    triple(external, 'external', '外部評価 ', 4);
    p.warnings.push(`外部評価の評価実施年月日は令和${external[1]}年${external[2]}月${external[3]}日。`);
  }
  p.warnings.push('厚真町 第４次総合計画 実施計画シート（実施計画年度 R6〜R8、事業評価対象年度は本文の「Ｒ５年度」）。事業費の推移・活動指標・成果指標は年度列と値の対応が抽出テキストで確定できないため未収録。担当課の「今後の方向性」（予算・サービス・方向性）は内部評価欄と同じ並びで出力され区別が確定しないため未収録。評価年度は本文に明記がないため未設定。');
  return [p];
}

export const atsumaEntries: Record<string, Entry> = {
  '01581': {
    extract: input => atsuma(input),
    scope: '厚真町 第４次総合計画 実施計画シート（令和5年度事業を対象とする事後事務事業評価、7事業）の事業名・担当課・評価対象年度・事業の評価（妥当性・有効性・効率性のA〜D）・内部評価と外部評価の予算／サービス／方向性。事業費・指標（列が崩れる）、評価結果概要の一覧表、行政評価の基本方針は対象外。',
  },
};
