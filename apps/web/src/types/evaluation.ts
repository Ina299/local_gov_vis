/** Municipal evaluation sheets are independent of the harmonized finance dataset. */
export type EvaluationFormat = 'html' | 'xlsx' | 'pdf';
export type AcquisitionStatus = 'ok' | 'partial' | 'failed' | 'unsupported' | 'pending';

export interface EvaluationEvidence {
  sourceUrl: string;
  sourcePageUrl: string;
  format: EvaluationFormat;
  fetchedAt: string;
  sha256: string;
  /** Exact source text, not a generated explanation. */
  rawText: string;
  page: number | null;
  sheet: string | null;
  cell: string | null;
}

export interface EvaluationAmount {
  kind: 'budget' | 'actual' | 'personnel' | 'fullCost';
  fiscalYear: number | null;
  amountYen: number | null;
  rawValue: string;
  rawUnit: string;
  evidence: EvaluationEvidence;
}

export interface EvaluationIndicator {
  name: string;
  fiscalYear: number | null;
  target: string | null;
  actual: string | null;
  unit: string | null;
  evidence: EvaluationEvidence;
}

export interface EvaluationRating {
  kind: 'self' | 'external';
  label: string;
  value: string;
  /** The municipality's original definition; never mapped to a common rank. */
  scale: string | null;
  evidence: EvaluationEvidence;
}

export interface ProjectEvaluation {
  id: string;
  municipalityCode: string;
  municipalityName: string;
  projectCode: string | null;
  projectName: string;
  department: string | null;
  /** Official evaluation-cycle year as labeled by the municipality, not inferred from upload time. */
  evaluationYear: number | null;
  /** Fiscal year explicitly assessed, which may differ from publication year. */
  evaluatedFiscalYear: number | null;
  purpose: string | null;
  activities: string | null;
  outcomes: string | null;
  amounts: EvaluationAmount[];
  indicators: EvaluationIndicator[];
  ratings: EvaluationRating[];
  evidence: EvaluationEvidence[];
  extractionStatus: 'extracted' | 'partial';
  warnings: string[];
}

export interface EvaluationSourceStatus {
  id: string;
  municipalityCode: string;
  municipalityName: string;
  sourcePageUrl: string;
  evaluationYear: number | null;
  status: AcquisitionStatus;
  discoveredDocuments: number;
  fetchedDocuments: number;
  extractedProjects: number;
  /** Recorded coverage is bounded, never a claim to cover all municipal projects. */
  scope: string;
  message: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  documents: {
    url: string;
    format: EvaluationFormat;
    status: AcquisitionStatus;
    sha256: string | null;
    fetchedAt: string | null;
    projectCount: number;
    message: string;
  }[];
}

export interface EvaluationDataset {
  schemaVersion: 1;
  generatedAt: string;
  sources: EvaluationSourceStatus[];
  projects: ProjectEvaluation[];
}
