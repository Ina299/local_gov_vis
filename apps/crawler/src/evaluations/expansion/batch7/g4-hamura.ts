import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, project } from '../shared';
import { joinLines, municipality, rating } from './g4-util';

const NEW = '18c5703a2ff5be74b9def28a', POST = '365518dd7d9e7de4c829760b';

/** Hamura 令和7年度 新規事務事業評価 結果一覧表: rows whose cells come out in order (number, name, department, division, result). */
function newProjects(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith('令和７年度\n行政評価（新規事務事業評価）結果一覧表\n') || !t.includes('A：実施が妥当\n\nB：要再検討\n\nC：実施しない')) return [];
  const out: ProjectEvaluation[] = [];
  // A number that is not at the start of a cell belongs to a row merged with its neighbour; such rows are skipped.
  for (const m of t.matchAll(/\n\n(\d+)(?:\n\n| )((?:[^\n]+\n)?[^\n]+)\n\n([^\s]+部)\n\n((?:[^\n]+\n)?[^\n]+)\n\n([ＡＢＣ])\n/g)) {
    const name = joinLines(m[2]), dept = joinLines(m[4]);
    if (/\s/.test(dept) || !/(課|室|館|センター)$/.test(dept)) continue;
    const raw = m[0].slice(2), at = m.index! + 2;
    const p = project(input, m[1], name, 2025, raw, at);
    p.projectCode = null; p.department = dept;
    p.ratings.push(rating(input, 'self', '評価結果（新規事務事業評価）', m[5], 'A：実施が妥当／B：要再検討／C：実施しない', raw, at));
    p.warnings.push('令和8年度から新たに実施を計画している事務事業の事前評価（羽村市行政評価委員会）。評価コメント欄は行との対応が崩れているため未収録。番号は掲載順のため事業コードにしていません。');
    out.push(p);
  }
  return out;
}

/** Hamura 令和7年度行政評価結果概要一覧（内部評価（事後評価））: plan-business rows followed by progress and three A-C grades. */
function postEvaluation(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith('令和7年度行政評価結果概要一覧（内部評価（事後評価））\n')) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(/\n\n(\d+) ((?:[^\n]+\n)?[^\n]+)\n\n(計画通り完了|計画を見直し完了)\n\n([ABC])\n\n([ABC])\n\n([ABC])\n/g)) {
    const name = joinLines(m[2]), raw = m[0].slice(2), at = m.index! + 2;
    const p = project(input, m[1], name, 2025, raw, at);
    p.projectCode = null;
    p.ratings.push(rating(input, 'self', '進捗状況', m[3], null, raw, at), rating(input, 'self', '妥当性', m[4], null, raw, at),
      rating(input, 'self', '効率性（手法）', m[5], null, raw, at), rating(input, 'self', '達成度', m[6], null, raw, at));
    p.warnings.push('長期総合計画の計画事業の事後評価一覧から、番号・計画事業名の直後に進捗状況と3項目の評価が並ぶ行のみ収録。総合評価・事後評価の概要は施策単位の欄と行の対応が崩れているため未収録。担当課・評価対象年度は一覧に明記がないため未設定。');
    out.push(p);
  }
  return out;
}

export const hamura = municipality('13227', input => input.sourceId === NEW ? newProjects(input) : input.sourceId === POST ? postEvaluation(input) : []);
