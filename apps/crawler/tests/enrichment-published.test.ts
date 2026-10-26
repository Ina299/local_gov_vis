import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {auditEnrichmentReviews} from '../src/audit-enrichment-reviews';
import {auditEnrichedEvaluations,contentCoverage} from '../src/audit-enriched-evaluations';
const root=resolve(import.meta.dirname,'../../..');
const read=async(path:string)=>JSON.parse(await readFile(join(root,path),'utf8'));
test('published enrichment accounts for all 578 reviewed sources and preserves every existing value',async()=>{
 const manifest=await read('data/evaluations/enrichment-provenance.json');
 assert.equal(manifest.inputs.length,3);
 const originalInput=manifest.inputs.find((i:{sha256:string})=>i.sha256==='9c23bb6945c6e7dd48563240cbad65d21d1addacf6d7a695c4f29eac46d061ca');
 assert.ok(originalInput);
 const followupInput=manifest.inputs.find((i:{sha256:string})=>i.sha256==='85c579bd4b728a7393b12d623229d1c0e9011ce2efff3652664400145e123a74');
 assert.ok(followupInput);
 const reviews=await auditEnrichmentReviews(root,join(root,'data/evaluations/enrichment-review-batch1'),join(root,originalInput.path));
 assert.deepEqual(reviews,await read('data/evaluations/enrichment-document-review-batch1.json'));
 assert.equal(reviews.documents,578);
 const out=await mkdtemp(join(tmpdir(),'kaizu-followup-'));
 try{
  const output=join(out,'patches.json');
  const run=spawnSync(process.execPath,['--import','tsx','apps/crawler/scripts/enrichment/kaizu-held-followup.ts',output],{cwd:root,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  assert.deepEqual(JSON.parse(await readFile(output,'utf8')),await read(followupInput.path));
  const finalInput=manifest.inputs.find((i:{sha256:string})=>i.sha256==='2f3c31f5436dce90123b43c5db6ddcb607be1051d18c1b6873ddfea7593b4063');
  assert.ok(finalInput);
  const finalRun=spawnSync(process.execPath,['--import','tsx','apps/crawler/scripts/enrichment/final-held-review.ts',output],{cwd:root,encoding:'utf8'});
  assert.equal(finalRun.status,0,finalRun.stderr);
  assert.deepEqual(JSON.parse(await readFile(output,'utf8')),await read(finalInput.path));
  const inventory=await read('data/evaluations/enrichment-held-inventory-batch2.json');
  const ledger=await read('data/evaluations/enrichment-final-held-review.json');
  assert.deepEqual(ledger.rows.map((r:any)=>r.documentId).sort(),inventory.rows.filter((r:any)=>r.exactSourceRecords>0&&r.code!=='21221').map((r:any)=>r.documentId).sort());
  assert.equal(ledger.rows.length,33);
  assert.equal(ledger.rows.filter((r:any)=>r.acceptedFields>0).length,9);
  assert.equal(ledger.rows.reduce((n:number,r:any)=>n+r.acceptedFields,0),234);
  for(const row of ledger.rows){
   assert.equal(row.reviewComplete,true);assert.ok(row.reopenCondition.length>10);
   const doc=await read('apps/web/public/evaluation-evidence/documents/'+row.documentId+'.json');
   assert.equal(doc.sourceSha256,row.sourceSha256);assert.equal(doc.textSha256,row.textSha256);
   for(const quote of row.textBoundaryEvidence)assert.ok(doc.text.includes(quote));
  }
 }finally{await rm(out,{recursive:true,force:true});}
 const audit=await auditEnrichedEvaluations(root);
 const archived=await read('data/evaluations/enrichment-statistical-audit-batch3.json');
 const phase=await read('data/evaluations/offline-source-review-batch12.json');
 const preservation=await read('data/evaluations/offline-source-preservation-batch12.json');
 const supplemental=await read('data/evaluations/supplemental-provenance.json');
 const batch=supplemental.batches.find((b:any)=>b.generatedAt===phase.generatedAt);assert.ok(batch);
 const additions=(await Promise.all(batch.inputs.map((i:any)=>read(i.path)))).flatMap(d=>d.projects);
 assert.equal(additions.length,251);assert.equal(preservation.oldRecordsPreservedExactly,92038);
 assert.equal(archived.indexSha256,phase.baselineIndexSha256);
 // The completed enrichment audit remains immutable. Append-only records contribute the
 // same coverage to both sides; every old field delta and detailed patch remains identical.
 const addCoverage=(a:any,b:any):any=>Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(k=>[k,
  typeof(a[k]??b[k])==='number'?(a[k]??0)+(b[k]??0):addCoverage(a[k]??{},b[k]??{})]));
 const delta=contentCoverage(additions);
 assert.deepEqual(audit,{...archived,baseIndexSha256:manifest.baseIndexSha256,indexSha256:preservation.indexSha256,
  generatedAt:manifest.generatedAt,before:addCoverage(archived.before,delta),after:addCoverage(archived.after,delta)});
 assert.equal(audit.changedRecords,manifest.statistics.changedRecords);
 assert.deepEqual(audit.filledScalarFields,manifest.statistics.filledFieldsByField);
 assert.deepEqual(audit.addedArrayItems,manifest.statistics.addedArrayItemsByField);
 assert.ok(audit.substantiveFilledFields>0);
 assert.ok(audit.after.nameAndMetadataOnly<audit.before.nameAndMetadataOnly);
});
