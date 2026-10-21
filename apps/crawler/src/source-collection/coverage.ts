import type { Entry } from './collector';

export interface Municipality { code: string; name: string }

/** Additive UI input, not a replacement for existing extracted evaluations.
 * Municipalities come from the complete registry, never from extracted projects.
 * Counts describe only this collection batch, not nationwide completeness.
 */
export function buildCoverage(registry: Municipality[], entries: Entry[]) {
  const municipalities = new Map(registry.filter(item => /^\d{5}$/.test(item.code)).map(item => [item.code, item]));
  const seen = new Set<string>();
  const documents = entries.map(entry => {
    if (!municipalities.has(entry.source.municipalityCode)) throw new Error('Source municipality missing from registry');
    for (const value of [entry.source.url, entry.source.sourcePageUrl]) {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsafe source link');
    }
    const key = `${entry.source.municipalityCode}:${entry.source.url}`;
    if (seen.has(key)) throw new Error('Duplicate source: merge evidence explicitly before building coverage');
    seen.add(key);
    const fetched = entry.state === 'fetched';
    if (fetched && (!entry.sha256 || !/^[a-f0-9]{64}$/.test(entry.sha256) || !entry.fetchedAt || !entry.bytes || entry.bytes < 1)) {
      throw new Error('Fetched source lacks content provenance');
    }
    const legacyTransport = entry.state === 'blocked' && !entry.failureKind && entry.message?.startsWith('Transport failure');
    return {
      municipalityCode: entry.source.municipalityCode,
      title: entry.source.title,
      sourceUrl: entry.source.url,
      sourcePageUrl: entry.source.sourcePageUrl,
      sourceLinkConfirmed: true,
      acquisitionState: legacyTransport ? 'paused' as const : entry.state,
      failureKind: legacyTransport ? 'transport' as const : entry.failureKind ?? null,
      originHttpStatus: entry.httpStatus ?? null,
      proxyHttpStatus: entry.proxyHttpStatus ?? null,
      originalSaved: fetched,
      textReading: 'not_checked' as const,
      structuredExtraction: 'not_started' as const,
      // Do not map a generic metadata year or a filename into either year axis.
      evaluationYear: null,
      evaluatedFiscalYear: null,
      sourceFiscalYearMetadata: entry.source.fiscalYear,
      amountKind: entry.source.amountKind,
      sha256: fetched ? entry.sha256! : null,
      fetchedAt: fetched ? entry.fetchedAt! : null,
      byteLength: fetched ? entry.bytes! : null,
      message: entry.message ?? '',
    };
  });
  const rows = [...municipalities.values()].sort((a, b) => a.code.localeCompare(b.code)).map(item => ({
    municipalityCode: item.code, municipalityName: item.name,
    documents: documents.filter(doc => doc.municipalityCode === item.code),
  }));
  return {
    schemaVersion: 1,
    scope: 'this_collection_batch_only',
    summary: {
      searchableMunicipalities: rows.length,
      sourceLinkedMunicipalities: rows.filter(row => row.documents.length > 0).length,
      linkedDocuments: documents.length,
      originalSavedMunicipalities: rows.filter(row => row.documents.some(doc => doc.originalSaved)).length,
      originalsSaved: documents.filter(doc => doc.originalSaved).length,
      structuredMunicipalities: 0,
    },
    municipalities: rows,
  };
}
