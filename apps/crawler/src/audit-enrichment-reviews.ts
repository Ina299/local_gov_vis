/** One-pass review accounting for the 578 partial/held cached sources. */
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from './evaluations/national-integration';
export interface EnrichmentReview {
 documentId:string;code:string;status:'enriched'|'reviewed_no_change'|'held';
 projectIds:string[];patchIds:string[];reason:string;evidenceQuotes:string[];remainingScope:string;
}
export function validateEnrichmentReview(r:EnrichmentReview,code:string,text:string){
 if(r.code!==code)throw Error(`Review municipality mismatch: ${r.documentId}`);
 if(!['enriched','reviewed_no_change','held'].includes(r.status))throw Error(`Unreviewed/invalid status: ${r.documentId}`);
 if(typeof r.reason!=='string'||r.reason.trim().length<12||typeof r.remainingScope!=='string'||!r.remainingScope.trim())throw Error(`Missing specific review scope: ${r.documentId}`);
 if(!Array.isArray(r.evidenceQuotes)||!r.evidenceQuotes.length||r.evidenceQuotes.some(q=>typeof q!=='string'||!q.length||!text.includes(q)))throw Error(`Unsupported quote: ${r.documentId}`);
 for(const field of ['projectIds','patchIds'] as const)if(!Array.isArray(r[field])||new Set(r[field]).size!==r[field].length||r[field].some(x=>typeof x!=='string'||!x))throw Error(`Invalid ${field}: ${r.documentId}`);
 if((r.status==='enriched')!==(r.patchIds.length>0))throw Error(`Patch/status mismatch: ${r.documentId}`);
}
export async function auditEnrichmentReviews(root:string,reviewDir:string,patchFile:string){
 const baseline=JSON.parse(await readFile(join(root,'data/evaluations/cached-document-review-batch6.json'),'utf8'));
 const expected=baseline.rows.filter((r:{status:string})=>['already_partial','held'].includes(r.status));
 if(expected.length!==578)throw Error('Baseline review scope changed');
 const inventory=JSON.parse(await readFile(join(root,'data/evaluations/cached-text-inventory-batch4.json'),'utf8'));
 const inv=new Map<string,any>(inventory.rows.map((r:any)=>[r.documentId,r]));
 const file=JSON.parse(await readFile(patchFile,'utf8'));
 if(file.schemaVersion!==1||!Array.isArray(file.patches))throw Error('Invalid enrichment input');
 const patches=new Map<string,any>();for(const p of file.patches){if(patches.has(p.id))throw Error('Duplicate patch ID');patches.set(p.id,p);}
 const reviews=new Map<string,EnrichmentReview>();const inputs=[];
 for(let n=1;n<=5;n++){
  const path=`review-${n}.json`,bytes=await readFile(join(reviewDir,path));const parsed=JSON.parse(bytes.toString());const rows=Array.isArray(parsed)?parsed:parsed.rows??parsed.reviews;
  if(!Array.isArray(rows))throw Error('Missing review array');
  for(const row of rows){if(reviews.has(row.documentId))throw Error('Duplicate review document');reviews.set(row.documentId,row);}
  inputs.push({path,sha256:sha256(bytes),documents:rows.length});
 }
 const rows:Array<EnrichmentReview & {previousStatus:string;sourceUrl:string;sourceSha256:string;textSha256:string}>=[];const accounted=new Set<string>();
 for(const old of expected){
  const r=reviews.get(old.documentId);if(!r)throw Error(`Missing review: ${old.documentId}`);reviews.delete(old.documentId);
  const original=inv.get(old.documentId);if(!original)throw Error('Missing immutable inventory');
  const bytes=await readFile(join(root,'apps/web/public/evaluation-evidence/documents',`${old.documentId}.json`));const doc=JSON.parse(bytes.toString());
  if(sha256(bytes)!==original.jsonSha256||sha256(Buffer.from(doc.text))!==original.textSha256||doc.municipalityCode!==old.municipalityCode)throw Error('Cached source changed');
  validateEnrichmentReview(r,old.municipalityCode,doc.text);
  for(const id of r.patchIds){
   const p=patches.get(id);if(!p||p.municipalityCode!==r.code||!r.projectIds.includes(p.projectId))throw Error(`Review patch identity mismatch: ${id}`);
   const proofs=[...(p.identity?.proofs??[]),...Object.values(p.set??{}).flatMap((x:any)=>x.proofs??[]),...Object.values(p.append??{}).flatMap((xs:any)=>xs.flatMap((x:any)=>x.proofs??[]))];
   if(!proofs.some((proof:any)=>proof.sourceId===r.documentId))throw Error(`Patch does not reference reviewed source: ${id}`);
   accounted.add(id);
  }
  rows.push({...r,previousStatus:old.status,sourceUrl:doc.sourceUrl,sourceSha256:doc.sourceSha256,textSha256:doc.textSha256});
 }
 if(reviews.size)throw Error('Review outside the assigned 578 sources');
 if([...patches.keys()].some(id=>!accounted.has(id)))throw Error('Patch missing from review ledger');
 return {schemaVersion:1,scope:'578 previously partial/held cached documents; reviewed is not complete extraction',documents:rows.length,inputs,
  statusCounts:Object.fromEntries(['enriched','reviewed_no_change','held'].map(s=>[s,rows.filter(r=>r.status===s).length])),patches:patches.size,rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [root,reviewDir,patchFile,output]=process.argv.slice(2);if(!root||!reviewDir||!patchFile||!output)throw Error('Use <root> <reviews> <patch-file> <output>');
 const result=await auditEnrichmentReviews(resolve(root),resolve(reviewDir),resolve(patchFile));await writeFile(resolve(output),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({documents:result.documents,statusCounts:result.statusCounts,patches:result.patches}));
}
