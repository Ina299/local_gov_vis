import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {auditEnrichmentReviews} from '../src/audit-enrichment-reviews';
import {auditEnrichedEvaluations} from '../src/audit-enriched-evaluations';
const root=resolve(import.meta.dirname,'../../..');
const read=async(path:string)=>JSON.parse(await readFile(join(root,path),'utf8'));
test('published enrichment accounts for all 578 reviewed sources and preserves every existing value',async()=>{
 const manifest=await read('data/evaluations/enrichment-provenance.json');
 assert.equal(manifest.inputs.length,2);
 const originalInput=manifest.inputs.find((i:{sha256:string})=>i.sha256==='9c23bb6945c6e7dd48563240cbad65d21d1addacf6d7a695c4f29eac46d061ca');
 assert.ok(originalInput);
 const followupInput=manifest.inputs.find((i:{sha256:string})=>i.sha256!==originalInput.sha256);
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
 }finally{await rm(out,{recursive:true,force:true});}
 const audit=await auditEnrichedEvaluations(root);
 assert.deepEqual(audit,await read('data/evaluations/enrichment-statistical-audit-batch2.json'));
 assert.equal(audit.changedRecords,manifest.statistics.changedRecords);
 assert.deepEqual(audit.filledScalarFields,manifest.statistics.filledFieldsByField);
 assert.deepEqual(audit.addedArrayItems,manifest.statistics.addedArrayItemsByField);
 assert.ok(audit.substantiveFilledFields>0);
 assert.ok(audit.after.nameAndMetadataOnly<audit.before.nameAndMetadataOnly);
});
