import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Entry, uniqueBy } from './m1-util';

// ---------------------------------------------------------------- 07465 中島村 第６次総合振興計画 事業評価 評価一覧表（個別事業）
const DOCS: Record<string, { head: string; done: string; evaluationYear: number; fy: number }> = {
  '00852d2d8c7fdfd8785c784f': { head: '中島村第 6 次総合振興計画 2024 年度（令和 6 年度）評価一覧表', done: '◎本事業評価は、2025 年度（令和 7 年度）に実施しました。', evaluationYear: 2025, fy: 2024 },
  '17e18ac62fccf5787138d673': { head: '中島村第 6 次総合振興計画 2023 年度（令和 5 年度）評価一覧表', done: '◎本事業評価は、2024 年度（令和 6 年度）に実施しました。', evaluationYear: 2024, fy: 2023 },
};
const SCALE_RAW = 'A（順調）\nおおむね期待どおりの成果が得られており、特に問題等もなく順調に進んでいる事業。\nB（改善の余地あり）\n目標達成に向けて遅れがみられる、又は、事業の一部に改善の余地がある事業。\nC（見直し必要）\n目標達成に向けて大幅な遅れが見られる、又は、事業内容を大きく見直す必要がある事業。';
const SCALE = 'A（順調）おおむね期待どおりの成果が得られており、特に問題等もなく順調に進んでいる事業／B（改善の余地あり）目標達成に向けて遅れがみられる、又は、事業の一部に改善の余地がある事業／C（見直し必要）目標達成に向けて大幅な遅れが見られる、又は、事業内容を大きく見直す必要がある事業';
// One-line rows of the list: individual number, business, department, individual rating. Wrapped names are skipped.
const ROW = /\n([①-⑳](?:-\d)?)\n\n([^\n]+)\n\n([^\s]+?(?:課|保育所|幼稚園|児童館))\n\n([ABC])\n/g;

function extractNakajima(input: CachedInput): ProjectEvaluation[] {
  const doc = DOCS[input.sourceId], t = input.text;
  if (input.municipalityCode !== '07465' || !doc || !t.includes(doc.head) || !t.includes(doc.done) || !t.includes(SCALE_RAW)) return [];
  // The list ends where the per-施策 sheets begin.
  const end = t.indexOf('基本目標\n\n1\n\n');
  if (end < 0) return [];
  const out: ProjectEvaluation[] = [];
  for (const row of t.slice(0, end).matchAll(ROW)) {
    const raw = row[0].slice(1, -1), at = row.index! + 1;
    const p = project(input, row[2], row[2], doc.evaluationYear, raw, at);
    p.projectCode = null;
    p.department = row[3];
    p.evaluatedFiscalYear = doc.fy;
    p.evidence.push(evidence(input, doc.head), evidence(input, doc.done));
    p.ratings.push({ kind: 'self', label: '個別評価（個別事業）', value: row[4], scale: SCALE, evidence: evidence(input, raw, at) });
    p.warnings.push(`中島村 第６次総合振興計画 ${doc.fy}年度評価一覧表の個別事業の行（個別番号・個別事業・担当課・個別評価が各1行で並ぶ行のみ）。施策単位の1次〜3次評価と施策評価シートは対象外。`,
      '評価の区分は一覧表冒頭の総合評価の基準（A〜C）。事業名が改行で分かれている行は対応が確定できないため除外。事業費・指標は施策単位の記載のため未収録。');
    out.push(p);
  }
  return uniqueBy(out, p => `${p.projectName}|${p.department}`);
}

export const nakajimaEntries: Record<string, Entry> = {
  '07465': {
    extract: input => extractNakajima(input),
    scope: '第６次総合振興計画 事業評価（2023・2024年度）の評価一覧表から、1行で読める個別事業の事業名・担当課・個別評価（A〜C）を構造化。施策ごとの1次〜3次評価・施策評価シート（事業費・KPI）は施策単位のため対象外。',
  },
};
