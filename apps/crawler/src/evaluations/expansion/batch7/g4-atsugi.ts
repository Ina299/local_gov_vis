import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, project } from '../shared';
import { joinLines, municipality, rating } from './g4-util';

const REPORTS: Record<string, { year: number; heading: string }> = {
  '6803914bcfe2d59467cd7445': { year: 2024, heading: '令和６年度 事務事業評価結果一覧\n' },
  'f124706377b12b5e0347e9f4': { year: 2025, heading: '令和７年度 事務事業評価結果一覧\n' },
};
const ROW = /\n(\d+)(?: |\n\n)([^\s\d][^\n]*?(?:部|局|事務局|委員会))\n\n((?:[^\n]+\n)?[^\n]+)\n\n((?:[^\n]+\n){0,2}[^\n]+)\n\n(\d+)\n\n(継続|拡大|縮小|廃止)\n\n(\d+|[－-])\n\n(現行どおり|要改善|[－-])\n/g;

/** Atsugi 事務事業評価結果報告書: rows of the 事務事業評価結果一覧 whose cells come out in order (number, department, division, name, scores). */
function parse(input: CachedInput): ProjectEvaluation[] {
  const report = REPORTS[input.sourceId];
  if (!report || input.format !== 'pdf') return [];
  const t = input.text, from = t.indexOf(report.heading);
  if (from < 0) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.slice(from).matchAll(ROW)) {
    const dept = joinLines(m[3]), name = joinLines(m[4]);
    if (/\s/.test(dept) || /\s/.test(name) || !/(課|室|所|館|局|センター|事務局)$/.test(dept)) continue;
    const at = from + m.index! + 1, raw = m[0].slice(1);
    const p = project(input, `${m[1]}|${name}`, name, report.year, raw, at);
    p.projectCode = null; p.department = dept;
    p.ratings.push(rating(input, 'self', '事業の適合率（％）', m[5], null, raw, at), rating(input, 'self', '一次評価', m[6], '拡大／継続／縮小／廃止', raw, at));
    if (/\d/.test(m[7])) p.ratings.push(rating(input, 'self', '手法の適正率（％）', m[7], null, raw, at));
    if (!/[－-]/.test(m[8])) p.ratings.push(rating(input, 'self', '見直し判定', m[8], null, raw, at));
    p.warnings.push('事務事業評価結果一覧の行から番号・部等・課等・事業名・適合率・一次評価・適正率・見直し判定を収録（各セルが行順に並んで抽出された行のみ。隣の行と結合した行は除外）。二次評価・主な見直し区分は列の位置がずれるため未収録。評価対象の決算年度は一覧に明記がないため未設定。一覧の番号は年度ごとの通し番号のため事業コードにしていません。');
    out.push(p);
  }
  return out;
}

export const atsugi = municipality('14212', parse);
