import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { dedupe } from './g7-util';

const SCALE = 'Ａ：（拡大）Ｂ：（継続）Ｃ：（統廃合）Ｄ：（縮小）Ｅ：（廃止・休止）Ｆ：（終了）';
const TITLE = '令和７年度実施計画事業に係る事務事業評価の２次評価について';

/** 大網白里市 令和7年度 実施計画事業の事務事業評価 2次評価一覧（R07-list.pdf）の行。後半の事務事業一覧・意見への回答は対象外。 */
export function extractOamishirasato(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12239' || input.sourceId !== 'd9765c0b5d68276717ac9dae' || !input.text.startsWith(TITLE)) return [];
  const out: ProjectEvaluation[] = [];
  // Only rows whose 市民意見・委員意見 cells are both "－" have an unambiguous column order.
  for (const m of input.text.matchAll(/(?<=^|\n\n)(\d+)\n\n([^\n]+)\n\n([^\n]+)\n\n([Ａ-Ｆ])\n\n((?:[^\n]+\n)*?[^\n]+)\n\n－\n\n－\n\n([Ａ-Ｆ])\n\n([^\n]+)/g)) {
    const start = m.index!, raw = m[0];
    const p = project(input, `No${m[1]}`, m[2], 2025, raw, start);
    p.department = m[3];
    p.evidence.push(evidence(input, TITLE, 0));
    const ev = evidence(input, raw, start);
    p.ratings.push({ kind: 'self', label: '1次評価（今後の事業の方向性）', value: m[4], scale: SCALE, evidence: ev });
    p.ratings.push({ kind: 'self', label: '2次評価（今後の事業の方向性）', value: m[6], scale: SCALE, evidence: ev });
    p.warnings.push('2次評価一覧の行（事業No.・事務事業名・担当課・1次評価と理由・2次評価）。市民意見・委員意見欄が「－」の行のみ収録。評価票本体（指標・事業費）は抽出テキストが無いため未収録。評価対象年度は一覧に明示されないため未設定。');
    out.push(p);
  }
  return dedupe(out, p => p.projectName);
}
