/** Batch-12 (m3) extractor for 34462 世羅町: 総合戦略推進会議資料「地方創生交付金事業の効果検証について」（交付金事業ごと1枚）. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints, nfkc, type Entry } from '../batch9/i1-util';

const SOURCES = new Set(['f0f99dd5661c663edfdcd630', 'e7748e7bb47198799cfc7a00', '103c37056219aaeb9f908833', '676f8f0759ed1b5bdca71e77']);
const SHEET = /(?:^|\n)事業名\n交付金\n\n事業概要\n/g;
const SCALE = '地方創生に非常に効果的であった／地方創生に相当程度効果があった／地方創生に効果があった／地方創生に対して効果がなかった（内閣府への地方創生推進交付金事業実施報告例）';
const GRANT_NOTE = '事務事業評価ではなく地方創生関係交付金の効果検証（交付金事業ごと）。';

function sera(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '34462' || !SOURCES.has(input.sourceId)) return [];
  const t = input.text, heads = [...t.matchAll(SHEET)];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const s = h.index!, b = t.slice(s, heads[k + 1]?.index ?? t.length);
    const nm = /\n\n([^\n]+)\n(?:平成|令和)[^\n]*年度：地方創生[^\n]*交付金\n/.exec(b) ?? /の取り組み\n\n([^\n]+)\n/.exec(b);
    const years = [...new Set([...b.matchAll(/R([0-9０-９])年度\n事業費/g)].map(m => nfkc(m[1])))];
    if (!nm || years.length !== 1) return;
    const fy = 2018 + Number(years[0]);
    const yr = /R[0-9０-９]年度\n事業費/.exec(b)!;
    const name = nm[1].trim();
    const p = project(input, nfkc(name), name, null, nm[1], s + nm.index + nm[0].indexOf(nm[1]));
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, yr[0], s + yr.index));
    // 事業効果: the selected wording is printed right after the label only on some sheets; otherwise the column order is lost.
    const effects = [...b.matchAll(/\n事業効果\n(地方創生に[^\n]+)\n/g)];
    if (effects.length === 1) p.ratings.push({ kind: 'self', label: '事業効果', value: effects[0][1], scale: SCALE, evidence: evidence(input, effects[0][0].trim(), s + effects[0].index! + 1) });
    p.warnings.push(GRANT_NOTE, 'KPI・事業費・交付金額は抽出テキストで表の列と値の対応が崩れるため未収録。総合戦略推進会議での評価（「有効であった」「有効とは言えない」）は選択肢が並んで出力され選択結果を確定できないため未収録。評価年度は本文に明記がないため未設定（評価対象年度は「R◯年度 事業費」欄の年度）。');
    out.push(p);
  });
  return mergeReprints(out, p => `${p.projectName}|${p.evaluatedFiscalYear}`);
}

export const seraEntries: Record<string, Entry> = {
  '34462': {
    extract: input => sera(input),
    scope: '世羅町 総合戦略推進会議資料「地方創生交付金事業の効果検証について」（令和3〜6年度分）の交付金事業ごとの事業名・評価対象年度・事業効果（本文で選択結果が確定するもののみ）。交付金の効果検証であり事務事業評価ではない。KPI・事業費・推進会議の評価、総合戦略KPIの効果検証表は対象外。',
  },
};
