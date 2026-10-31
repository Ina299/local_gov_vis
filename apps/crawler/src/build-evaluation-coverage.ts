/**
 * 事務事業評価の整備状況（地図の層・収支図からの遷移先の判定用）を自治体ごとに 1 段階へまとめる。
 *   npm run -w @local-gov/crawler build:evaluation-coverage
 * 入力: apps/web/public/evaluation-evidence/index.json（資料・テキスト）と evaluations-index.json＋整理済み事業票（構造化）。
 * 出力: apps/web/public/evaluation-coverage.json。評価資料・事業票を更新したら再実行する。
 * あわせて evaluation-budget-totals.json（年度別の歳出総額＝決算。事業コストの流れで「全体」として並べる）も作る。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LocalGovBudget } from '../../web/src/types/budget';
import type { EvaluationDataset } from '../../web/src/types/evaluation';
import type { EvidenceIndex } from '../../web/src/types/evaluationEvidence';
import type { EvaluationIndex } from '../../web/src/lib/evaluationLoader';
import * as flowLib from '../../web/src/lib/projectCostFlow';
import * as coverageLib from '../../web/src/lib/evaluationCoverage';
import type { BudgetTotalsFile, CoverageEntry, EvaluationCoverageFile } from '../../web/src/lib/evaluationCoverage';
import { readdir } from 'node:fs/promises';

// web 側は CommonJS として読み込まれるため、名前付き export は default 経由になることがある
const interop = <T,>(m: T) => ((m as { default?: unknown }).default ?? m) as T;
const { costFlowYears, defaultFlowYear } = interop(flowLib);
// 事業コストの流れ: 決算額の図を優先し、なければ予算額の図（画面の既定と同じ）
const flowYearsOf = (projects: EvaluationDataset['projects']) => {
  const actual = costFlowYears(projects, 5, 'actual');
  return actual.length ? actual : costFlowYears(projects, 5, 'budget');
};
const { COVERAGE_LEVELS, transparencyOf } = interop(coverageLib);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const publicDir = join(root, 'apps/web/public');
const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8')) as T;

const evidence = await readJson<EvidenceIndex>(join(publicDir, 'evaluation-evidence/index.json'));
const structured = await readJson<EvaluationIndex>(join(publicDir, 'evaluations-index.json'));
const datasets = new Map(structured.municipalities.filter((m) => m.dataStatus === 'primary_available' && m.datasetPath).map((m) => [m.municipalityCode, m.datasetPath!]));

// 歳出総額（決算）: 都道府県は budgets.json、市区町村は municipal-all/{年度}.json
const totals: BudgetTotalsFile['totals'] = {};
const add = (b: LocalGovBudget) => { (totals[b.code] ??= {})[String(b.fiscalYear)] = b.totalExpenditure; };
(await readJson<LocalGovBudget[]>(join(publicDir, 'budgets.json'))).forEach(add);
for (const file of (await readdir(join(publicDir, 'budgets/municipal-all'))).filter((f) => /^\d{4}\.json$/.test(f)).sort()) {
  (await readJson<LocalGovBudget[]>(join(publicDir, 'budgets/municipal-all', file))).forEach(add);
}
// 透明度: 年度ごとの読み取れた決算額の合計（事業コストの流れと同じ重複除去。事業数の下限なし）÷ 歳出総額（決算）
const withTransparency = (entry: CoverageEntry, projects: EvaluationDataset['projects'] | null, totalsKey: string): CoverageEntry => {
  const recorded = Object.fromEntries((projects ? costFlowYears(projects, 1, 'actual') : []).map((y) => [String(y.fiscalYear), y.total]));
  const t = transparencyOf(recorded, totals[totalsKey]);
  if (t === 0) return { ...entry, transparency: 0 };
  return t ? { ...entry, transparency: Math.round(t.ratio * 1e6) / 1e6, transparencyYear: t.year, transparencyTotalYear: t.totalYear } : entry;
};

const municipalities: EvaluationCoverageFile['municipalities'] = {};
const counts = new Array<number>(COVERAGE_LEVELS.length).fill(0);
for (const entry of [...evidence.municipalities].sort((a, b) => a.municipalityCode.localeCompare(b.municipalityCode))) {
  const code = entry.municipalityCode;
  let level: number;
  let flowYear: number | undefined;
  const datasetPath = datasets.get(code);
  let projects: EvaluationDataset['projects'] | null = null;
  if (datasetPath) {
    const dataset = await readJson<EvaluationDataset>(join(publicDir, datasetPath));
    projects = dataset.projects;
    const years = flowYearsOf(dataset.projects);
    flowYear = defaultFlowYear(years) ?? undefined;
    level = years.length ? 0 : 1;
  } else if (entry.substantiveTextDocumentCount > 0) level = 2;
  else if (entry.textDocumentCount > 0) level = 3;
  else if (entry.evaluationPageCount > 0) level = 4;
  else level = 5;
  counts[level]++;
  municipalities[code] = withTransparency(flowYear === undefined ? { level } : { level, flowYear }, projects, code);
}

// 都道府県（地図の都道府県表示は 2 桁コード）。資料・テキストは evaluation-evidence-prefectures、事業票は evaluations-prefectures
const prefectureIndex = await readJson<EvidenceIndex>(join(publicDir, 'evaluation-evidence-prefectures/index.json')).catch(() => null);
const prefectureCounts = new Array<number>(COVERAGE_LEVELS.length).fill(0);
const prefectureStructured = await readJson<EvaluationIndex>(join(publicDir, 'evaluations-prefectures-index.json')).catch(() => null);
for (const entry of prefectureIndex?.municipalities ?? []) {
  let level = entry.substantiveTextDocumentCount > 0 ? 2 : entry.textDocumentCount > 0 ? 3 : entry.evaluationPageCount > 0 ? 4 : 5;
  let flowYear: number | undefined;
  const row = prefectureStructured?.municipalities.find((m) => m.municipalityCode === entry.municipalityCode && m.dataStatus === 'primary_available' && m.datasetPath);
  let projects: EvaluationDataset['projects'] | null = null;
  if (row) {
    projects = (await readJson<EvaluationDataset>(join(publicDir, row.datasetPath!))).projects;
    const years = flowYearsOf(projects);
    flowYear = defaultFlowYear(years) ?? undefined;
    level = years.length ? 0 : 1;
  }
  prefectureCounts[level]++;
  municipalities[entry.prefectureCode] = withTransparency(flowYear === undefined ? { level } : { level, flowYear }, projects, entry.prefectureCode);
}
console.log('prefectures', JSON.stringify(Object.fromEntries(COVERAGE_LEVELS.map((label, i) => [label, prefectureCounts[i]]))));

const out: EvaluationCoverageFile = { schemaVersion: 1, evidenceSnapshotAt: evidence.snapshotAt, structuredGeneratedAt: structured.generatedAt, levels: [...COVERAGE_LEVELS], municipalities };
await writeFile(join(publicDir, 'evaluation-coverage.json'), JSON.stringify(out) + '\n');
console.log(JSON.stringify(Object.fromEntries(COVERAGE_LEVELS.map((label, i) => [label, counts[i]])), null, 1));

const sortedTotals = Object.fromEntries(Object.keys(totals).sort().map((code) => [code, totals[code]]));
await writeFile(join(publicDir, 'evaluation-budget-totals.json'), JSON.stringify({ schemaVersion: 1, source: 'Japan Dashboard 地方財政（総務省 地方財政状況調査・決算）の歳出総額', totals: sortedTotals } satisfies BudgetTotalsFile) + '\n');
console.log(`budget totals: ${Object.keys(totals).length}団体`);
const measured = Object.values(municipalities).filter((e) => e.transparency !== undefined);
console.log(`transparency: ${measured.length}団体（0%: ${measured.filter((e) => e.transparency === 0).length}、比べられない: ${Object.keys(municipalities).length - measured.length}）`);
