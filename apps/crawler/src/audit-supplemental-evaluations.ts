/** Reproducible full-view audit without altering the original cached-expansion audits. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ProjectEvaluation } from '../../web/src/types/evaluation';
import { summarizeRecords, duplicateCandidates } from './audit-cached-expansion';
import { verifyIntegratedEvaluations, sha256 } from './evaluations/national-integration';
import { SUPPLEMENTAL_MANIFEST, type SupplementalManifest } from './evaluations/supplemental-integration';
export async function auditAllEvaluationLayers(root:string){
  const assets=await verifyIntegratedEvaluations(root);let manifest:SupplementalManifest|null=null;
  try{manifest=JSON.parse(await readFile(join(root,SUPPLEMENTAL_MANIFEST),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const all:ProjectEvaluation[]=[];const addedIds=new Set(manifest?.batches.flatMap(b=>b.decisions.flatMap(d=>d.records.filter(r=>r.status==='added').map(r=>r.id)))??[]);
  const municipalities=[];
  for(const row of assets.index.municipalities){if(!row.datasetPath)continue;const records:ProjectEvaluation[]=JSON.parse(assets.shards.get(row.municipalityCode)!.toString()).projects;
    all.push(...records);municipalities.push({code:row.municipalityCode,name:row.municipalityName,datasetPath:row.datasetPath,datasetSha256:row.datasetSha256,
      totals:summarizeRecords(records),supplementalAdded:summarizeRecords(records.filter(p=>addedIds.has(p.id)))});
  }
  const appended=all.filter(p=>addedIds.has(p.id));
  if(appended.length!==addedIds.size)throw new Error('Supplemental decision IDs do not match displayed projects');
  const decisions=manifest?.batches.flatMap(b=>b.decisions.flatMap(d=>d.records))??[];
  // Store each candidate record's evidence once, rather than duplicating it for every year-pair.
  const candidateRecords = new Map<string, unknown>();
  const candidates = duplicateCandidates(all).map(value => {
    const pair = value as { records: Array<{ id: string }> } & Record<string, unknown>;
    for (const record of pair.records) candidateRecords.set(record.id, record);
    return { ...pair, records: pair.records.map(record => record.id) };
  });
  const result={schemaVersion:1,offlineOnly:true,indexSha256:sha256(assets.indexBytes),indexGeneratedAt:assets.index.generatedAt,
    scope:'All displayed municipality records, including immutable original/cached cohorts and accepted supplemental records; records are not all-year unique businesses.',
    cohorts:assets.index.cohorts,totals:summarizeRecords(all),immutableCore:summarizeRecords(all.filter(p=>!addedIds.has(p.id))),supplementalAdded:summarizeRecords(appended),
    supplemental:{batches:manifest?.batches.length??0,acceptedRecords:appended.length,replayedInputs:decisions.filter(d=>d.status==='replayed').length,
      reviewedDistinctAddedRecords:decisions.filter(d=>d.status==='added'&&d.distinctDecisionIds?.length).length,
      correctionPolicy:'Corrections/improvements to an existing ID are rejected before publishing; rejected attempts are not persisted or counted as zero attempts.',
      correctionsApplied:0,originalIndexSha256:manifest?.originalIndexSha256??sha256(assets.indexBytes)},
    municipalities,duplicateCandidates:candidates,duplicateCandidateRecords:Object.fromEntries(candidateRecords),notes:[
      'Duplicate candidate pairs reference full record descriptors in duplicateCandidateRecords by ID; all  pairs are retained.',
      'Same-name collision candidates are not automatically deleted; explicit reviewed distinct decisions are preserved in supplemental provenance.',
      'Kind actual does not establish directly attributable costs or exclude personnel costs. Amounts across kinds and fiscal years are not summed.',
      'Explicit outcome actual requires a source-labelled outcome indicator and nonempty actual. Unparsed narrative evidence can remain available when separate fields are unknown.',
      'Existing cached-expansion audits continue to describe their immutable core shards; this report describes the composed display view.']};
  if(!(await readFile(join(root,'apps/web/public/evaluations-index.json'))).equals(assets.indexBytes))throw new Error('Index changed during audit');
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const output=JSON.stringify(await auditAllEvaluationLayers(resolve(process.argv[2]??'.')),null,2)+'\n';
  if(process.argv[3])await writeFile(resolve(process.argv[3]),output);else process.stdout.write(output);
}
