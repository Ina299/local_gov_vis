/** Verify a document-by-document review ledger against immutable cached text. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from './evaluations/national-integration';

export const reviewStatuses = ['unreviewed','extracted','already_partial','held','no_individual_records','duplicate_of_structured'] as const;
export interface DocumentReview {
  documentId: string;
  code?: string;
  municipalityCode?: string;
  status: typeof reviewStatuses[number];
  reason: string;
  evidenceQuotes: string[];
  remainingScope: string;
  extractor?: string | null;
}
export function validateDocumentReview(review:DocumentReview, code:string, text:string):void {
  if ((review.code ?? review.municipalityCode) !== code) throw new Error(`Review municipality mismatch: ${review.documentId}`);
  if (!reviewStatuses.includes(review.status)) throw new Error(`Unknown review status: ${review.documentId}`);
  if (review.status === 'unreviewed') return;
  if (typeof review.reason !== 'string' || review.reason.trim().length < 12) throw new Error(`Review needs a specific reason: ${review.documentId}`);
  if (!Array.isArray(review.evidenceQuotes) || (text.length > 0 && !review.evidenceQuotes.length)) throw new Error(`Review needs literal evidence: ${review.documentId}`);
  for (const quote of review.evidenceQuotes) {
    if (typeof quote !== 'string' || !quote.length || !text.includes(quote)) throw new Error(`Review quote mismatch: ${review.documentId}`);
  }
  if (typeof review.remainingScope !== 'string' || !review.remainingScope.trim()) throw new Error(`Review must disclose remaining scope: ${review.documentId}`);
  if (review.status === 'extracted' && !review.extractor) throw new Error(`Extracted review needs implementation: ${review.documentId}`);
}

async function main() {
  const [rootArg,reviewDirArg,outputArg] = process.argv.slice(2);
  if (!rootArg || !reviewDirArg || !outputArg) throw new Error('Use <repository> <review-directory> <output-json>');
  const root=resolve(rootArg),reviewDir=resolve(reviewDirArg);
  const inventory=JSON.parse(await readFile(join(root,'data/evaluations/cached-text-inventory-batch4.json'),'utf8'));
  const reviews=new Map<string,DocumentReview>();
  const inputs=[];
  for(let n=1;n<=5;n++) {
    const path=join(reviewDir,`review-${n}.json`),bytes=await readFile(path);
    const parsed=JSON.parse(bytes.toString());
    const rows:DocumentReview[]=Array.isArray(parsed)?parsed:parsed.reviews??parsed.rows;
    if(!Array.isArray(rows))throw new Error(`Missing reviews array: ${path}`);
    for(const row of rows){if(reviews.has(row.documentId))throw new Error(`Duplicate review: ${row.documentId}`);reviews.set(row.documentId,row);}
    inputs.push({file:`review-${n}.json`,sha256:sha256(bytes),records:rows.length});
  }
  const rows: Array<DocumentReview & {municipalityCode:string;sourceUrl:string;sourceSha256:string;textSha256:string;evaluationType:string;format:string;truncated:boolean}> = [];
  for(const source of inventory.rows) {
    const review=reviews.get(source.documentId);
    if(!review)throw new Error(`Missing review: ${source.documentId}`);
    reviews.delete(source.documentId);
    const bytes=await readFile(join(root,'apps/web/public/evaluation-evidence/documents',`${source.documentId}.json`));
    const doc=JSON.parse(bytes.toString());
    if(sha256(bytes)!==source.jsonSha256 || sha256(Buffer.from(doc.text))!==source.textSha256)throw new Error(`Cached source changed: ${source.documentId}`);
    validateDocumentReview(review,source.municipalityCode,doc.text);
    rows.push({...review,municipalityCode:source.municipalityCode,sourceUrl:source.sourceUrl,sourceSha256:source.sourceSha256,textSha256:source.textSha256,evaluationType:source.evaluationType,format:source.format,truncated:source.truncated});
  }
  if(reviews.size)throw new Error('Review contains documents outside the inventory');
  const counts=Object.fromEntries(reviewStatuses.map(s=>[s,rows.filter(r=>r.status===s).length]));
  await writeFile(resolve(outputArg),JSON.stringify({schemaVersion:1,scope:'All 2,460 cached text documents; held or partial is not complete extraction',inputs,documents:rows.length,statusCounts:counts,unreviewedMunicipalities:new Set(rows.filter(r=>r.status==='unreviewed').map(r=>r.municipalityCode)).size,rows},null,2)+'\n');
  console.log(JSON.stringify({documents:rows.length,statusCounts:counts}));
  if(counts.unreviewed)process.exitCode=2;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) await main();
