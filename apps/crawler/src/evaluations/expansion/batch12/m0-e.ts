import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints, nfkc, type Entry } from '../batch9/i1-util';

// ---------------------------------------------------------------- 今治市（教育委員会 点検及び評価報告書 令和７年度・令和６年度対象）
// 各「取組事業NN」の見出し（〇事業名）と《事業概要》を収録。KPI表は年度列と値の対応が段組みで崩れる回があるため未収録。
function extractImabari(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '38202' || input.sourceId !== '2c7a24345e7aad651c437bc5') return [];
  const t = input.text;
  const title = '令和７年度（令和６年度対象）\n\n教育に関する事務の管理及び執行の状況の\n点検及び評価報告書';
  if (!t.startsWith(title)) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(/(重点方針0[1-5])\n\n(取組事業(\d\d))\n\n〇 ?([^\n]+)\n/g)) {
    if (m.index! < 3000) continue; // 目次は対象外
    const name = m[4].trim(), start = m.index!;
    const p = project(input, `取組事業${m[3]}`, name, 2025, m[0].trimEnd(), start);
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, title, 0));
    const ov = /《事業概要》\n([\s\S]*?)\n《令和６年度の主な取組・実績》/.exec(t.slice(start, start + 1500));
    if (ov && !/- \d+ -/.test(ov[1])) {
      p.purpose = ov[1].trim();
      p.evidence.push(evidence(input, ov[0], start + ov.index));
    }
    p.warnings.push('教育委員会の点検・評価報告書（令和７年度・令和６年度対象）の取組事業。評価年度は表紙の「令和７年度」、評価対象年度は「令和６年度対象」による。KPI表（実績値・目標値）は年度列との対応が段組みで崩れる回があるため未収録。事業費の記載はなく、担当課の記載もない。事業ごとの評価記号はなく、評価は《事業の課題、評価、今後の展開》の文章のみ（未収録）。');
    out.push(p);
  }
  return out.length === 34 ? mergeReprints(out, p => `${nfkc(p.projectName)}|${p.evaluatedFiscalYear}`) : [];
}

export const eEntries: Record<string, Entry> = {
  '38202': { extract: extractImabari, scope: '教育に関する事務の管理及び執行の状況の点検及び評価報告書（令和７年度・令和６年度対象）の取組事業34件（事業名・事業概要）。KPI表の値・評価文・概要版（R7_gaiyou）・自己評価・学識経験者の意見は対象外。' },
};
export const entries = eEntries;
