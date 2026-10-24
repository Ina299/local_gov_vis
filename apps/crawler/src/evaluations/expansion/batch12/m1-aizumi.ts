import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount } from '../batch9/i1-util';
import { type Entry, era, segments, toNumber, uniqueBy } from './m1-util';

// ---------------------------------------------------------------- 36403 藍住町 教育に関する事務の管理及び執行の状況の点検及び評価報告書（事業評価シート）
const HEAD = /^(令和|平成)([０-９]+)年度（(令和|平成)([０-９]+)年度対象事業）\n\n教育に関する事務の管理及び執行\nの状況の点検及び評価報告書/;
const SOURCES = new Set(['574296fb96a27877c2bfdce0', '7820528cf31d038ce3f2984c', '8048c5e1c9e54a49c751d27e']);
const SCALE_RAW = /総合評価のランク\nＳ\n\n優れた取組が多く、予想以上の成果が上がっている\n\nＡ\n\n優れた取組が多く、十分成果が上がっている\n\nＢ\n\n着実に取組ができており、成果が上がっている\n\nＣ\n\n成果が十分上がっておらず、改善の余地が多い\n\nＤ\n\n成果がほとんど上がっておらず、抜本的な見直しが必要/;
const SCALE = 'Ｓ 優れた取組が多く、予想以上の成果が上がっている／Ａ 優れた取組が多く、十分成果が上がっている／Ｂ 着実に取組ができており、成果が上がっている／Ｃ 成果が十分上がっておらず、改善の余地が多い／Ｄ 成果がほとんど上がっておらず、抜本的な見直しが必要';
const SCALE_OLD_RAW = /総合評価のランク\nＡ\n\n優れた取り組みが多く、十分成果が上がっている\n\nＢ\n\n優れた取り組みがいくつかあり、成果が上がっている\n\nＣ\n\n成果が十分上がっておらず、改善の余地が多い\n\nＤ\n\n成果が殆ど上がっておらず、抜本的な見直しが必要/;
const SCALE_OLD = 'Ａ 優れた取り組みが多く、十分成果が上がっている／Ｂ 優れた取り組みがいくつかあり、成果が上がっている／Ｃ 成果が十分上がっておらず、改善の余地が多い／Ｄ 成果が殆ど上がっておらず、抜本的な見直しが必要';
const NUM = '(\\d{1,3}(?:,\\d{3})*)';
// 平成30年度報告書: the first year header (H27決算) is printed apart from the other two.
const COST_OLD = new RegExp(`H(\\d\\d)決算\\n\\nH(\\d\\d)決算\\n\\n${Array(6).fill(NUM).join('\\n\\n')}\\n`);
const COST = new RegExp(`((令和|平成)(元|[０-９]+)年度決算)\\n\\n((令和|平成)(元|[０-９]+)年度決算)\\n\\n((令和|平成)(元|[０-９]+)年度決算)\\n\\n${Array(6).fill(NUM).join('\\n\\n')}\\n`);

function extractAizumi(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '36403' || !SOURCES.has(input.sourceId)) return [];
  const t = input.text, head = t.match(HEAD), scale = SCALE_RAW.test(t) ? SCALE : SCALE_OLD_RAW.test(t) ? SCALE_OLD : null;
  if (!head || !scale) return [];
  const evaluationYear = era(head[1], head[2]), fy = era(head[3], head[4]);
  const out: ProjectEvaluation[] = [];
  for (const s of segments(t, /事業評価シート\n事務事業名\n\n/g)) {
    const name = /^事業評価シート\n事務事業名\n\n((?:[^\n]+\n){1,2}?)\n総合計画の\n/.exec(s.text);
    if (!name) continue;
    const projectName = name[1].trimEnd().replace(/\n/g, '');
    const p = project(input, projectName, projectName, evaluationYear, name[0].trimEnd(), s.at);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, head[0], 0));
    const no = [...s.text.matchAll(/事業番号\n\n(\d+)\n/g)];
    if (no.length === 1) { p.projectCode = `事業番号${no[0][1]}`; p.evidence.push(evidence(input, no[0][0].trimEnd(), s.at + no[0].index!)); }
    const dept = [...s.text.matchAll(/\n([^\n]+課)\n\n根拠法令\n/g)];
    if (dept.length === 1) { p.department = dept[0][1]; p.evidence.push(evidence(input, dept[0][0].trim(), s.at + dept[0].index! + 1)); }
    const cost = COST.exec(s.text), old = cost ? null : COST_OLD.exec(s.text);
    const parsed = cost ? { m: cost, years: [era(cost[2], cost[3]), era(cost[5], cost[6]), era(cost[8], cost[9])], total: cost.slice(10, 13), general: cost.slice(13, 16) }
      : old && Number(old[2]) === Number(old[1]) + 1 && s.text.slice(0, old.index).includes(`H${Number(old[1]) - 1}決算`)
        ? { m: old, years: [1987 + Number(old[1]), 1988 + Number(old[1]), 1988 + Number(old[2])], total: old.slice(3, 6), general: old.slice(6, 9) } : null;
    if (parsed) {
      const { m: cost, years, total, general } = parsed;
      const raw = cost[0].trimEnd();
      // Rows are printed 事業費 then うち一般財源等; the split is accepted only when every general-fund value is within the business cost.
      if (years[2] === fy && years[1] === fy - 1 && years[0] === fy - 2 && total.every((v, i) => toNumber(general[i]) <= toNumber(v)) && s.text.includes('事業費（千円）')) {
        years.forEach((y, i) => p.amounts.push(amount(input, 'actual', y, total[i], '千円', raw, s.at + cost.index!)));
        p.warnings.push('事業コスト表の「事業費（千円）（一部事業以外は人件費を除く）」の各年度決算を収録。抽出テキストでは3年度×2行（事業費、うち一般財源等）の数値が行順に並ぶため、先頭3つを事業費とし、後の3つ（うち一般財源等）がそれぞれ以下であることを確認した場合のみ採用。うち一般財源等は未収録。');
      }
    }
    const rating = [...s.text.matchAll(/総合評価\n\n判定説明\n及び考察\n\n([ＳＡＢＣＤ])\n/g)];
    if (rating.length === 1) p.ratings.push({ kind: 'self', label: '総合評価（教育委員会評価）', value: rating[0][1], scale, evidence: evidence(input, rating[0][0].trimEnd(), s.at + rating[0].index!) });
    p.warnings.push(`藍住町 教育に関する事務の点検及び評価報告書（${head[1]}${head[2]}年度・${head[3]}${head[4]}年度対象事業）の事業評価シート。`,
      '事業実績・成果（指標）の表、項目別評価（必要性・有効性等）、事業の方向性は選択肢と値の対応が抽出テキストで確定できないため未収録。評価委員会意見は未収録。');
    out.push(p);
  }
  return uniqueBy(out);
}

export const aizumiEntries: Record<string, Entry> = {
  '36403': {
    extract: input => extractAizumi(input),
    scope: '教育に関する事務の点検及び評価報告書（平成29・令和5・6年度対象事業）の事業評価シートから、事務事業名・事業番号・担当課・総合評価（Ｓ〜Ｄ）・事業費（千円・各年度決算）を構造化。指標表・項目別評価・事業の方向性は対応が確定しないため対象外。教育委員会の活動状況等の総括部分は対象外。',
  },
};
