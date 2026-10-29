/**
 * 事務事業評価の整備状況（地図の層・収支図からの遷移先の判定用）を自治体ごとに 1 段階へまとめる。
 *   npm run -w @local-gov/crawler build:evaluation-coverage
 * 入力: apps/web/public/evaluation-evidence/index.json（資料・テキスト）と evaluations-index.json＋整理済み事業票（構造化）。
 * 出力: apps/web/public/evaluation-coverage.json。評価資料・事業票を更新したら再実行する。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvaluationDataset } from '../../web/src/types/evaluation';
import type { EvidenceIndex } from '../../web/src/types/evaluationEvidence';
import type { EvaluationIndex } from '../../web/src/lib/evaluationLoader';
import * as flowLib from '../../web/src/lib/projectCostFlow';
import * as coverageLib from '../../web/src/lib/evaluationCoverage';
import type { EvaluationCoverageFile } from '../../web/src/lib/evaluationCoverage';

// web 側は CommonJS として読み込まれるため、名前付き export は default 経由になることがある
const interop = <T,>(m: T) => ((m as { default?: unknown }).default ?? m) as T;
const { costFlowYears, defaultFlowYear } = interop(flowLib);
const { COVERAGE_LEVELS } = interop(coverageLib);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const publicDir = join(root, 'apps/web/public');
const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8')) as T;

const evidence = await readJson<EvidenceIndex>(join(publicDir, 'evaluation-evidence/index.json'));
const structured = await readJson<EvaluationIndex>(join(publicDir, 'evaluations-index.json'));
const datasets = new Map(structured.municipalities.filter((m) => m.dataStatus === 'primary_available' && m.datasetPath).map((m) => [m.municipalityCode, m.datasetPath!]));

const municipalities: EvaluationCoverageFile['municipalities'] = {};
const counts = new Array<number>(COVERAGE_LEVELS.length).fill(0);
for (const entry of [...evidence.municipalities].sort((a, b) => a.municipalityCode.localeCompare(b.municipalityCode))) {
  const code = entry.municipalityCode;
  let level: number;
  let flowYear: number | undefined;
  const datasetPath = datasets.get(code);
  if (datasetPath) {
    const dataset = await readJson<EvaluationDataset>(join(publicDir, datasetPath));
    const years = costFlowYears(dataset.projects);
    flowYear = defaultFlowYear(years) ?? undefined;
    level = years.length ? 0 : 1;
  } else if (entry.substantiveTextDocumentCount > 0) level = 2;
  else if (entry.textDocumentCount > 0) level = 3;
  else if (entry.evaluationPageCount > 0) level = 4;
  else level = 5;
  counts[level]++;
  municipalities[code] = flowYear === undefined ? { level } : { level, flowYear };
}

const out: EvaluationCoverageFile = { schemaVersion: 1, evidenceSnapshotAt: evidence.snapshotAt, structuredGeneratedAt: structured.generatedAt, levels: [...COVERAGE_LEVELS], municipalities };
await writeFile(join(publicDir, 'evaluation-coverage.json'), JSON.stringify(out) + '\n');
console.log(JSON.stringify(Object.fromEntries(COVERAGE_LEVELS.map((label, i) => [label, counts[i]])), null, 1));
