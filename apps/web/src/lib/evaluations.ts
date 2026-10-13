import type {
  AcquisitionStatus,
  EvaluationDataset,
  EvaluationSourceStatus,
  ProjectEvaluation,
} from '@/types/evaluation';

export const EVALUATION_STATUS_LABELS: Record<AcquisitionStatus, string> = {
  ok: '取得済み',
  partial: '一部取得',
  failed: '取得失敗',
  unsupported: '未対応',
  pending: '未取得',
};

export interface EvaluationFilters {
  municipality: string;
  evaluationYear: string;
  fiscalYear: string;
  query: string;
}

export const EMPTY_EVALUATION_FILTERS: EvaluationFilters = {
  municipality: '', evaluationYear: '', fiscalYear: '', query: '',
};

function normalizeSearch(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ja-JP');
}

export function matchesEvaluationYear(year: number | null, filter: string): boolean {
  return filter === '' || (filter === 'unknown' ? year === null : String(year) === filter);
}

/** Official assessment-cycle and assessed fiscal years are deliberately independent. */
export function filterEvaluations(
  projects: ProjectEvaluation[], filters: EvaluationFilters,
): ProjectEvaluation[] {
  const terms = normalizeSearch(filters.query).trim().split(/\s+/).filter(Boolean);
  return projects.filter((project) => {
    if (filters.municipality && project.municipalityCode !== filters.municipality) return false;
    if (!matchesEvaluationYear(project.evaluationYear, filters.evaluationYear)) return false;
    if (!matchesEvaluationYear(project.evaluatedFiscalYear, filters.fiscalYear)) return false;
    if (!terms.length) return true;
    const text = normalizeSearch([
      project.projectName, project.projectCode, project.municipalityName, project.department,
      project.purpose, project.activities, project.outcomes,
      ...project.indicators.flatMap((indicator) => [indicator.name, indicator.target, indicator.actual]),
      ...project.ratings.flatMap((rating) => [rating.label, rating.value]),
    ].filter(Boolean).join(' '));
    return terms.every((term) => text.includes(term));
  });
}

/** Keep current acquisition warnings visible for retained records from older assessment years. */
export function filterEvaluationSources(
  sources: EvaluationSourceStatus[], filters: EvaluationFilters,
): EvaluationSourceStatus[] {
  return sources.filter((source) => !filters.municipality || source.municipalityCode === filters.municipality);
}

export function evaluationMunicipalities(dataset: EvaluationDataset): { code: string; name: string }[] {
  const names = new Map<string, string>();
  for (const entry of [...dataset.sources, ...dataset.projects]) {
    names.set(entry.municipalityCode, entry.municipalityName);
  }
  return Array.from(names, ([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function evaluationYearOptions(values: (number | null)[]): string[] {
  const years = Array.from(new Set(values.filter((value): value is number => value !== null)))
    .sort((a, b) => b - a).map(String);
  return values.includes(null) ? [...years, 'unknown'] : years;
}

export function formatEvaluationYear(year: number | null): string {
  return year === null ? '年度不明' : `${year}年度`;
}

/** Preserve zero. Do not estimate absent cost categories or round away source precision. */
export function formatEvaluationAmount(amountYen: number | null): string {
  return amountYen === null || !Number.isFinite(amountYen)
    ? '金額未取得'
    : `${amountYen.toLocaleString('ja-JP', { maximumFractionDigits: 20 })}円`;
}

export function formatEvaluationTimestamp(value: string | null): string {
  if (!value) return '記録なし';
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return '日時不明';
  return `${timestamp.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })}（日本時間）`;
}

/** Treat source links as untrusted data, even when rendered from a local static file. */
export function safeEvaluationUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNullableString = (value: unknown) => value === null || isString(value);
const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const isNullableNumber = (value: unknown) => value === null || isNumber(value);
const isArrayOf = (value: unknown, check: (entry: unknown) => boolean) =>
  Array.isArray(value) && value.every(check);
const isFormat = (value: unknown) => ['html', 'xlsx', 'pdf'].includes(String(value));
const isStatus = (value: unknown) => isString(value)
  && Object.prototype.hasOwnProperty.call(EVALUATION_STATUS_LABELS, value);

function isEvidence(value: unknown): boolean {
  return isRecord(value)
    && ['sourceUrl', 'sourcePageUrl', 'fetchedAt', 'sha256', 'rawText'].every((key) => isString(value[key]))
    && isFormat(value.format) && isNullableNumber(value.page)
    && isNullableString(value.sheet) && isNullableString(value.cell);
}

/** Fail visibly on malformed assets rather than silently displaying incomplete/zero totals. */
export function parseEvaluationDataset(value: unknown): EvaluationDataset {
  const valid = isRecord(value) && value.schemaVersion === 1 && isString(value.generatedAt)
    && isArrayOf(value.sources, (source) => isRecord(source)
      && ['id', 'municipalityCode', 'municipalityName', 'sourcePageUrl', 'scope', 'message'].every((key) => isString(source[key]))
      && isNullableNumber(source.evaluationYear) && isStatus(source.status)
      && ['discoveredDocuments', 'fetchedDocuments', 'extractedProjects'].every((key) => isNumber(source[key]))
      && isNullableString(source.lastAttemptAt) && isNullableString(source.lastSuccessAt)
      && isArrayOf(source.documents, (document) => isRecord(document)
        && isString(document.url) && isFormat(document.format) && isStatus(document.status)
        && isNullableString(document.sha256) && isNullableString(document.fetchedAt)
        && isNumber(document.projectCount) && isString(document.message)))
    && isArrayOf(value.projects, (project) => isRecord(project)
      && ['id', 'municipalityCode', 'municipalityName', 'projectName'].every((key) => isString(project[key]))
      && ['projectCode', 'department', 'purpose', 'activities', 'outcomes'].every((key) => isNullableString(project[key]))
      && isNullableNumber(project.evaluationYear) && isNullableNumber(project.evaluatedFiscalYear)
      && ['extracted', 'partial'].includes(String(project.extractionStatus))
      && isArrayOf(project.warnings, isString) && isArrayOf(project.evidence, isEvidence)
      && isArrayOf(project.amounts, (amount) => isRecord(amount)
        && ['budget', 'actual', 'personnel', 'fullCost'].includes(String(amount.kind))
        && isNullableNumber(amount.fiscalYear) && isNullableNumber(amount.amountYen)
        && isString(amount.rawValue) && isString(amount.rawUnit) && isEvidence(amount.evidence))
      && isArrayOf(project.indicators, (indicator) => isRecord(indicator)
        && isString(indicator.name) && isNullableNumber(indicator.fiscalYear)
        && ['target', 'actual', 'unit'].every((key) => isNullableString(indicator[key]))
        && isEvidence(indicator.evidence))
      && isArrayOf(project.ratings, (rating) => isRecord(rating)
        && ['self', 'external'].includes(String(rating.kind))
        && isString(rating.label) && isString(rating.value)
        && isNullableString(rating.scale) && isEvidence(rating.evidence)));
  if (!valid) throw new Error('事務事業評価データの形式を確認できませんでした。');
  return value as unknown as EvaluationDataset;
}
