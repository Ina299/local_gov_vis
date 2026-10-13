import { createHash } from 'node:crypto';
import type { EvaluationEvidence, ProjectEvaluation } from '../../../../web/src/types/evaluation';

export interface CachedInput {
  municipalityCode: string;
  municipalityName: string;
  sourceId: string;
  sourceUrl: string;
  sourcePageUrl: string;
  sourceSha256: string;
  fetchedAt: string;
  format: 'pdf' | 'html' | 'xlsx';
  text: string;
  truncated: boolean;
}
export function evidence(input: CachedInput, rawText: string, start?: number): EvaluationEvidence {
  const offset = start ?? input.text.indexOf(rawText);
  if (offset < 0 || input.text.slice(offset, offset + rawText.length) !== rawText) throw new Error('Evidence is not an exact source substring');
  return { sourceUrl: input.sourceUrl, sourcePageUrl: input.sourcePageUrl, format: input.format,
    fetchedAt: input.fetchedAt, sha256: input.sourceSha256, rawText, page: null, sheet: null,
    cell: `extracted-text:chars:${offset}-${offset + rawText.length}` };
}
export function stableId(input: CachedInput, projectCode: string, evaluationYear: number | null): string {
  return `cached-${input.municipalityCode}-${createHash('sha256').update(`${input.sourceUrl}\n${projectCode}\n${evaluationYear}`).digest('hex').slice(0,24)}`;
}
export function project(input: CachedInput, projectCode: string, projectName: string, evaluationYear: number | null, rawText: string, start?: number): ProjectEvaluation {
  return { id: stableId(input, projectCode, evaluationYear), municipalityCode: input.municipalityCode,
    municipalityName: input.municipalityName, projectCode, projectName, department: null,
    evaluationYear, evaluatedFiscalYear: null, purpose: null, activities: null, outcomes: null,
    amounts: [], indicators: [], ratings: [], evidence: [evidence(input, rawText, start)], extractionStatus: 'partial',
    warnings: ['保存済み抽出テキストから部分構造化。PDF原本との再照合は未実施。表の空欄・列位置を推測して補完していません。原典ページ番号は未復元のため抽出テキスト内の文字位置を記録。'] };
}
