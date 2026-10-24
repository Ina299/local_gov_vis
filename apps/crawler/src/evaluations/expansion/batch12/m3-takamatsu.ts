/** Batch-12 (m3) extractor for 37201 高松市: 高松市事務事業評価表【事中・事後評価】（1事業1枚）. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, nfkc, type Entry } from '../batch9/i1-util';

const SOURCES = new Set(['44760dbb65b9a8626f73fd43']);
const TITLE = /令和 ?([0-9０-９]+)年度（ ?([0-9０-９]+)年度決算分） 高松市事務事業評価表【事中・事後評価】/;
const SCALE = 'Ａ(80%〜100%)／Ｂ(60%〜79%)／Ｃ(0%〜59%)（総合点の率による評価ランク）';

function takamatsu(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '37201' || !SOURCES.has(input.sourceId)) return [];
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const evalYear = 2018 + Number(nfkc(title[1])), fy = 2018 + Number(nfkc(title[2]));
  const name = /\n事務事業 ([^\n]+)\n/.exec(t), dept = /\n課 \(室 \)名 ([^\n]+)\n/.exec(t), bureau = /\n局名 ([^\n]+)\n/.exec(t);
  if (!name || !dept || !bureau) return [];
  const p = project(input, nfkc(name[1]), name[1].trim(), evalYear, name[0].trim(), name.index + 1);
  p.department = dept[1].trim();
  p.evaluatedFiscalYear = fy;
  p.evidence.push(evidence(input, title[0], title.index), evidence(input, dept[0].trim(), dept.index + 1), evidence(input, bureau[0].trim(), bureau.index + 1));
  // 【コストの推移】: header R4（決算）R5（決算）R6（決算）R7（予算）, then each row's four values in that order.
  const cost = /【コストの推移】\n単位\n\nR(\d)（決算）\n\nR(\d)（決算）\n\nR(\d)（決算）\n\nR(\d)\n（予算）\n\nトータルコスト\n\n\[千円\]\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n\(事業費\)\n\n\[千円\]\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n\(職員人件費\)\n\n\[千円\]\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n/.exec(t);
  if (cost) {
    const years = cost.slice(1, 5).map(r => 2018 + Number(r));
    const raw = cost[0], at = cost.index;
    const push = (kind: 'fullCost' | 'actual' | 'personnel' | 'budget', col: number, group: number) =>
      p.amounts.push(amount(input, kind, years[col], cost[group], '千円', raw, at));
    for (let c = 0; c < 3; c++) { push('fullCost', c, 5 + c); push('actual', c, 9 + c); push('personnel', c, 13 + c); }
    push('budget', 3, 12);
    p.warnings.push('【コストの推移】の「トータルコスト」「(事業費)」「(職員人件費)」の各決算列（R4〜R6）を収録し、R7（予算）列は事業費のみ予算額として収録（トータルコスト・人件費の予算列は種別が重なるため未収録）。');
  }
  const rank = /\n評価ランク\n\n([ＡＢＣ])\n\n(継続|拡充|改善|縮小|統合|廃止|休止|終了)\n/.exec(t), score = /\n(\d+) \/1\n00 今後の方向性\n総合点\n/.exec(t);
  if (rank) {
    p.ratings.push({ kind: 'self', label: '評価ランク', value: rank[1], scale: SCALE, evidence: evidence(input, rank[0].trim(), rank.index + 1) });
    p.ratings.push({ kind: 'self', label: '今後の方向性', value: rank[2], scale: null, evidence: evidence(input, rank[0].trim(), rank.index + 1) });
  }
  if (score) p.ratings.push({ kind: 'self', label: '総合点', value: `${score[1]}/100`, scale: '評価項目（妥当性・有効性・効率性）の合計点（100点満点）', evidence: evidence(input, score[0].trim(), score.index + 1) });
  p.warnings.push(`令和${evalYear - 2018}年度（${fy - 2018}年度決算分）高松市事務事業評価表の1枚。成果指標（車券発売収入・競輪場再整備進捗率）は抽出テキストで数値の桁がグラフ目盛と混ざって分断されるため未収録。`);
  return [p];
}

export const takamatsuEntries: Record<string, Entry> = {
  '37201': {
    extract: input => takamatsu(input),
    scope: '高松市事務事業評価表【事中・事後評価】（令和7年度・6年度決算分）のうち第5回取得の1枚（競輪事業）の事業名・局課・コストの推移（決算・予算、千円）・評価ランク・総合点・今後の方向性。成果指標（グラフと数値が混在）は対象外。',
  },
};
