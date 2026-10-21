import type { EvaluationEvidence, ProjectEvaluation } from '../../../web/src/types/evaluation';
import type { DiscoveredDocument, ParseResult } from './adapters';
import type { Artifact } from './fetch';

/** Fail closed when an adapter loses provenance or invents invalid numeric values. */
export function validateExtraction(result: ParseResult, doc: DiscoveredDocument, artifact: Artifact): void {
  if (!['ok', 'partial', 'unsupported'].includes(result.status) || !Array.isArray(result.projects)) {
    throw new Error('Invalid parser result');
  }
  if (result.status !== 'unsupported' && !result.projects.length) throw new Error('Parser returned success without any projects');
  const evidence = (item: EvaluationEvidence) => {
    if (item.sourceUrl !== doc.url || item.sourcePageUrl !== doc.sourcePageUrl ||
        item.sha256 !== artifact.sha256 || item.fetchedAt !== artifact.fetchedAt ||
        item.format !== doc.format || typeof item.rawText !== 'string' || !item.rawText.trim()) {
      throw new Error('Extracted field lacks exact source provenance');
    }
    if (doc.format === 'pdf' && (!Number.isInteger(item.page) || item.page! < 1)) throw new Error('PDF evidence requires a page');
    if (doc.format === 'xlsx' && (!item.sheet || !item.cell)) throw new Error('Excel evidence requires sheet and cell');
  };
  const year = (value: number | null) => value === null || (Number.isInteger(value) && value >= 1868 && value <= 2200);
  const ids = new Set<string>();
  for (const project of result.projects as ProjectEvaluation[]) {
    if (!project.id || ids.has(project.id) || !project.projectName?.trim() || project.municipalityCode !== doc.municipalityCode) {
      throw new Error('Missing/duplicate project identity or wrong municipality');
    }
    ids.add(project.id);
    if (!year(project.evaluationYear) || !year(project.evaluatedFiscalYear)) throw new Error('Invalid evaluation year');
    if (!project.evidence.length) throw new Error('Project has no original evidence');
    project.evidence.forEach(evidence);
    for (const amount of project.amounts) {
      if (!['budget', 'actual', 'personnel', 'fullCost'].includes(amount.kind) || !year(amount.fiscalYear) ||
          (amount.amountYen !== null && !Number.isFinite(amount.amountYen))) throw new Error('Invalid financial amount');
      if (amount.amountYen !== null && (!amount.rawValue.trim() || !amount.rawUnit.trim())) throw new Error('Converted amount lacks original value/unit');
      evidence(amount.evidence);
    }
    for (const indicator of project.indicators) {
      if (!indicator.name || !year(indicator.fiscalYear)) throw new Error('Invalid indicator');
      evidence(indicator.evidence);
    }
    for (const rating of project.ratings) {
      if (!['self', 'external'].includes(rating.kind) || !rating.label || !rating.value) throw new Error('Invalid original rating');
      evidence(rating.evidence);
    }
  }
}
