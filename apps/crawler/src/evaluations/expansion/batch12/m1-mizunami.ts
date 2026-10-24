import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Entry, era, uniqueBy } from './m1-util';

// ---------------------------------------------------------------- 21208 瑞浪市議会 事業評価報告書（決算審査分）
const DOCS: Record<string, RegExp> = {
  '013036a4bb684f8953f3db50': /^議会の評価\n(令和)(７) 年度事業評価報告書\n・ 令和６ 年度決算審査分 事業評価\n/,
  'a24ff8a68c900883b116494f': /^議会の評価\n(令和)(５)年度事業評価報告書\n・令和 4 年度決算審査分 事業評価\n/,
  'a3b4fe7ed44271ed940bf2fc': /^議会の評価\n(令和)(６)年度事業評価報告書\n・令和５年度決算審査分 事業評価\n/,
};
const SCALE = 'A 85～100／B 70～84／C 50～69／D 35～49／E 0～34（議員別評価の点数の平均による総合評価）';
const despace = (s: string) => s.replace(/[ 　]/g, '');

function extractMizunami(input: CachedInput): ProjectEvaluation[] {
  const re = DOCS[input.sourceId], t = input.text, head = re && input.municipalityCode === '21208' ? t.match(re) : null;
  if (!head) return [];
  const evaluationYear = era(head[1], head[2]);
  const out: ProjectEvaluation[] = [];
  const sheets = [...t.matchAll(/(令和(\S) ?年度)決算審査分 事業評価書\n([①-⑳])([^\n]+)\n\n評価事業名\n\n([^\n]+)\n/g)];
  const lists = [...t.matchAll(/年度決算審査分 議員別評価一覧表\n([①-⑳]) ?([^\n]+)\n/g)];
  for (const s of sheets) {
    const fy = era('令和', s[2]), name = despace(s[4]).trim(), dept = despace(s[5]).trim();
    // The member-by-member table with the same circled number and name (before or after the sheet); its average row (値) carries the overall grade.
    const same = lists.filter(l => l[1] === s[3] && despace(l[2]).trim() === name);
    if (same.length !== 1) continue;
    const list = same[0], next = [...sheets, ...lists].map(m => m.index!).filter(i => i > list.index!).sort((a, b) => a - b)[0] ?? t.length;
    const block = t.slice(list.index!, next);
    const avg = [...block.matchAll(/\n値\n\n(?:[\d.]+\n\n){5}([A-E])（ ?([\d.]+)[)）]\n/g)];
    const p = project(input, name, name, evaluationYear, `${s[3]}${s[4]}`, s.index! + s[0].indexOf(s[3] + s[4]));
    p.projectCode = null;
    p.department = dept;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, head[0].trimEnd(), 0), evidence(input, s[0].trimEnd(), s.index!), evidence(input, list[0].trimEnd(), list.index!));
    if (avg.length === 1 && t.includes('A\n\nB\n\nC\n\nD\n\nE\n')) {
      const a = avg[0], raw = a[0].slice(1, -1), at = list.index! + a.index! + 1;
      p.ratings.push({ kind: 'external', label: '議会の事業評価 総合評価', value: a[1], scale: SCALE, evidence: evidence(input, raw, at) },
        { kind: 'external', label: '議会の事業評価 総合評価点（議員別評価の平均）', value: a[2], scale: '100点満点', evidence: evidence(input, raw, at) });
    }
    p.warnings.push(`瑞浪市議会による事業評価（令和${head[2]}年度事業評価報告書・${s[1].replace(/ /g, '')}決算審査分）。執行機関の自己評価ではなく議会の評価。事業名・担当課は事業評価書の見出しから空白を除いて収録。総合評価は同じ番号の議員別評価一覧表の平均値の行から収録。`,
      '項目別（必要性・実施主体・目標指標・効率性・成果）の平均点と評価結果の文章、事業費・指標は未収録。過年度事業評価の再評価分は対象外。');
    out.push(p);
  }
  return uniqueBy(out);
}

export const mizunamiEntries: Record<string, Entry> = {
  '21208': {
    extract: input => extractMizunami(input),
    scope: '瑞浪市議会の事業評価報告書（令和4〜6年度決算審査分）の事業評価書から、事業名・担当課・決算年度と、議員別評価一覧表の平均による総合評価（A〜E・点数）を議会による評価として構造化。過年度事業の再評価分、令和2・3年度決算審査分（様式が異なり事業と評価の対応が確定しない）は対象外。',
  },
};
