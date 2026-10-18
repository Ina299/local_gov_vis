import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import type {EvaluationDataset} from '../../web/src/types/evaluation';
import {mergeSupplementalDataset,importSupplementalEvaluations,verifySupplementalEvaluations,SUPPLEMENTAL_MANIFEST,supplementalRecordSha256,verifyImmutableEvaluationCore,verifySupplementalDecisionProofs} from '../src/evaluations/supplemental-integration';
import {auditAllEvaluationLayers} from '../src/audit-supplemental-evaluations';
import {verifyIntegratedEvaluations,importCachedEvaluationExpansion} from '../src/evaluations/national-integration';
const date='2026-10-13T20:00:00.000Z';const json=(x:unknown)=>Buffer.from(JSON.stringify(x)+'\n');
function dataset(code='01100',year=2024):EvaluationDataset {
 const url=`https://example.jp/${code}/${year}.pdf`;const evidence={sourceUrl:url,sourcePageUrl:url,format:'pdf' as const,fetchedAt:date,sha256:'a'.repeat(64),rawText:'Verbatim sheet text '.repeat(10),page:null,sheet:null,cell:null};
 return{schemaVersion:1,generatedAt:date,projects:[{id:`${code}-${year}`,municipalityCode:code,municipalityName:'fixture',projectCode:'1',projectName:'fixture project',department:'Dept',evaluationYear:null,evaluatedFiscalYear:year,purpose:'purpose',activities:null,outcomes:null,amounts:[],indicators:[],ratings:[],evidence:[evidence],extractionStatus:'partial',warnings:[]}],sources:[{id:`source-${code}-${year}`,municipalityCode:code,municipalityName:'fixture',sourcePageUrl:url,evaluationYear:null,status:'partial',discoveredDocuments:1,fetchedDocuments:1,extractedProjects:1,scope:'fixture',message:'fixture',lastAttemptAt:date,lastSuccessAt:date,documents:[{url,format:'pdf',status:'partial',sha256:evidence.sha256,fetchedAt:date,projectCount:1,message:'fixture'}]}]};
}
test('appends explicitly different fiscal years without modifying input records or bytes',()=>{
 const base=dataset(),next=dataset('01100',2025),before=json(base);const result=mergeSupplementalDataset(base,next,date);
 assert.equal(result.dataset.projects.length,2);assert.deepEqual(json(base),before);assert.deepEqual(result.dataset.projects[0],base.projects[0]);
 assert.equal(result.dataset.sources.reduce((n,s)=>n+s.extractedProjects,0),2);
});
test('reruns and proven reprints do not count; same-ID improvements fail closed',()=>{
 const base=dataset();assert.equal(mergeSupplementalDataset(base,structuredClone(base),date).decisions[0].status,'replayed');
 const reprint=structuredClone(base);reprint.projects[0].id='other-id';assert.equal(mergeSupplementalDataset(base,reprint,date).decisions[0].status,'replayed');
 reprint.projects[0].outcomes='newly extracted outcome';assert.throws(()=>mergeSupplementalDataset(base,reprint,date),/Identity collision/);
 reprint.projects[0].id=base.projects[0].id;assert.throws(()=>mergeSupplementalDataset(base,reprint,date),/Correction\/improvement/);
});
test('same-year aliases and unknown-year names stop, different departments and years remain distinct',()=>{
 const base=dataset(),next=dataset();next.projects[0].id='different';next.projects[0].projectCode='2';next.projects[0].purpose='different';
 assert.throws(()=>mergeSupplementalDataset(base,next,date),/Identity collision/);
 const shared=structuredClone(base.projects[0].evidence[0]);next.projects[0].purpose=base.projects[0].purpose;next.projects[0].evidence=[{...shared,rawText:'Different primary sheet '.repeat(10)},shared];base.projects[0].evidence.push(shared);
 assert.throws(()=>mergeSupplementalDataset(base,next,date),/Identity collision/);
 next.projects[0].evaluatedFiscalYear=null;assert.throws(()=>mergeSupplementalDataset(base,next,date),/unknown period/);
 next.projects[0].evaluatedFiscalYear=2024;next.projects[0].department='Other';assert.equal(mergeSupplementalDataset(base,next,date).dataset.projects.length,2);
});
test('reviewed distinct businesses require bound IDs, record hashes and exact source quotes',()=>{
 const base=dataset(),next=dataset();next.projects[0].id='distinct';next.projects[0].projectCode='2';next.projects[0].purpose='Different municipal activity';
 const old=base.projects[0],incoming=next.projects[0];const e=old.evidence[0];
 const decision={id:'review-1',municipalityCode:'01100',existingId:old.id,incomingId:incoming.id,existingRecordSha256:supplementalRecordSha256(old),incomingRecordSha256:supplementalRecordSha256(incoming),reason:'Official project codes and activity descriptions establish distinct evaluation units.',existingEvidence:{sourceUrl:e.sourceUrl,sha256:e.sha256,quote:e.rawText},incomingEvidence:{sourceUrl:e.sourceUrl,sha256:e.sha256,quote:e.rawText}};
 const result=mergeSupplementalDataset(base,next,date,[decision]);assert.equal(result.dataset.projects.length,2);assert.deepEqual(result.decisions[0].distinctDecisionIds,['review-1']);
 assert.equal(mergeSupplementalDataset(result.dataset,next,date,[decision]).decisions[0].status,'replayed');
 assert.throws(()=>mergeSupplementalDataset(base,next,date,[{...decision,incomingRecordSha256:'b'.repeat(64)}]),/identity mismatch/);
 assert.throws(()=>mergeSupplementalDataset(base,next,date,[{...decision,incomingEvidence:{...decision.incomingEvidence,quote:'not actually present in the original source text'}}]),/quote is not supported/);
});
test('new records may reuse a document with recalculated ownership; unsupported evidence is rejected',()=>{
 const base=dataset(),next=dataset();next.projects[0].id='new';next.projects[0].projectCode='2';next.projects[0].projectName='other';
 const merged=mergeSupplementalDataset(base,next,date).dataset;assert.equal(merged.sources.length,1);assert.equal(merged.sources[0].documents[0].projectCount,2);
 next.projects[0].evidence[0].sourceUrl='https://missing.jp/';assert.throws(()=>mergeSupplementalDataset(base,next,date),/Missing\/ambiguous/);
});
test('filesystem overlay keeps immutable core assets, handles new and existing municipalities, reruns, tamper and correction',async()=>{
 const root=resolve(import.meta.dirname,'../../..');const current=await verifyImmutableEvaluationCore(root);
 const temp=await mkdtemp(join(tmpdir(),'supplemental-'));const target=join(temp,'repo');
 try{
  await mkdir(join(target,'apps/web/public'),{recursive:true});await mkdir(join(target,'data/evaluations'),{recursive:true});
  await cp(join(root,'apps/web/public/evaluations-municipal'),join(target,'apps/web/public/evaluations-municipal'),{recursive:true});
  for(const p of ['apps/web/public/evaluations.json','data/evaluations/evaluations.json','data/evaluations/integration-provenance.json','data/evaluations/cached-expansion-provenance.json'])await cp(join(root,p),join(target,p));
  await writeFile(join(target,'apps/web/public/evaluations-index.json'),current.indexBytes);
  const old=current.index.municipalities.find(r=>r.datasetPath)!;const fresh=current.index.municipalities.find(r=>!r.datasetPath)!;
  const input=join(temp,'input');await mkdir(input);
  for(const row of [old,fresh]){const d=dataset(row.municipalityCode,2026);d.projects[0].municipalityName=row.municipalityName;d.sources[0].municipalityName=row.municipalityName;await writeFile(join(input,`${row.municipalityCode}.json`),json(d));}
  const after=await importSupplementalEvaluations({root:target,sourceDirectory:input,generatedAt:date});
  const audit=await auditAllEvaluationLayers(target);assert.equal(audit.supplemental.acceptedRecords,2);assert.equal(audit.supplementalAdded.records,2);assert.equal(audit.immutableCore.records,current.index.primaryEvaluationRecords);assert.equal(audit.supplemental.correctionsApplied,0);
  assert.equal(after.index.primaryMunicipalities,current.index.primaryMunicipalities+1);assert.equal(after.index.primaryEvaluationRecords,current.index.primaryEvaluationRecords+2);
  assert.deepEqual(after.index.cohorts?.supplemental,{primaryMunicipalities:1,primaryEvaluationRecords:2,existingMunicipalities:1});
  for(const [code,bytes]of current.shards)assert.deepEqual(await readFile(join(target,`apps/web/public/evaluations-municipal/${code}.json`)),bytes);
  for(const p of ['data/evaluations/integration-provenance.json','data/evaluations/cached-expansion-provenance.json'])assert.deepEqual(await readFile(join(root,p)),await readFile(join(target,p)));
  const beforeManifest=await readFile(join(target,SUPPLEMENTAL_MANIFEST));const rerun=await importSupplementalEvaluations({root:target,sourceDirectory:input,generatedAt:'2026-10-14T00:00:00Z'});
  assert.deepEqual(rerun.indexBytes,after.indexBytes);assert.deepEqual(await readFile(join(target,SUPPLEMENTAL_MANIFEST)),beforeManifest);
  await assert.rejects(importCachedEvaluationExpansion({root:target,sourceDirectory:input,generatedAt:date}),/Supplemental overlay exists/);
  const changed=JSON.parse((await readFile(join(input,`${old.municipalityCode}.json`))).toString());changed.projects[0].purpose='corrected';await writeFile(join(input,`${old.municipalityCode}.json`),json(changed));
  await assert.rejects(importSupplementalEvaluations({root:target,sourceDirectory:input,generatedAt:date}),/Correction\/improvement/);
  assert.deepEqual((await verifySupplementalEvaluations(target)).indexBytes,after.indexBytes);
  const composed=after.index.municipalities.find(r=>r.municipalityCode===old.municipalityCode)!;await writeFile(join(target,'apps/web/public',composed.datasetPath!),'{}');
  await assert.rejects(verifyIntegratedEvaluations(target),/Composed shard mismatch/);
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('cached period proofs require authenticated source chains and an opaque verified context',async()=>{
 const id='90fcadc136d59899591dc67d',code='47213';
 // Resolve fixture from the test module rather than process working directory.
 const fixture=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const doc=JSON.parse(await readFile(new URL(`documents/${id}.json`,fixture),'utf8'));
 const base=dataset(code),next=dataset(code);next.projects[0].id='separate-facility';next.projects[0].projectCode='2';next.projects[0].purpose='Distinct reviewed management period';
 for(const ds of [base,next]){const e=ds.projects[0].evidence[0];e.sourceUrl=doc.sourceUrl;e.sha256=doc.sourceSha256;e.rawText='Fiscal-year heading was not retained in this frozen record';ds.sources[0].documents[0].url=doc.sourceUrl;ds.sources[0].documents[0].sha256=doc.sourceSha256;}
 const proof={sourceUrl:doc.sourceUrl,sha256:doc.sourceSha256,quote:'評価対象期間 R6.4.1 ～ R7.3.31',cachedDocument:{sourceId:id,textSha256:doc.textSha256}};
 const decision={id:'cache-proof-review',municipalityCode:code,existingId:base.projects[0].id,incomingId:next.projects[0].id,existingRecordSha256:supplementalRecordSha256(base.projects[0]),incomingRecordSha256:supplementalRecordSha256(next.projects[0]),reason:'Reviewer compares the exact cached assessment periods and confirms distinct units.',existingEvidence:proof,incomingEvidence:proof};
 assert.throws(()=>mergeSupplementalDataset(base,next,date,[decision]),/not verified/);
 assert.throws(()=>mergeSupplementalDataset(base,next,date,[decision],{kind:'verified-cached-decision-proofs'}),/not verified/);
 const temp=await mkdtemp(join(tmpdir(),'cached-decision-proof-'));
 try{
  const dir=join(temp,'apps/web/public/evaluation-evidence');await mkdir(join(dir,'municipalities'),{recursive:true});await mkdir(join(dir,'documents'));
  for(const file of ['index.json',`municipalities/${code}.json`,`documents/${id}.json`])await writeFile(join(dir,file),await readFile(new URL(file,fixture)));
  const context=await verifySupplementalDecisionProofs(temp,[decision]);assert.equal(mergeSupplementalDataset(base,next,date,[decision],context).dataset.projects.length,2);
  const changed=structuredClone(decision);changed.existingEvidence.quote='評価対象期間 R5.4.1 ～ R6.3.31';
  await assert.rejects(verifySupplementalDecisionProofs(temp,[changed]),/not an exact/);
  assert.throws(()=>mergeSupplementalDataset(base,next,date,[changed],context),/not verified/);
  const wrongHash=structuredClone(decision);wrongHash.existingEvidence.cachedDocument.textSha256='f'.repeat(64);await assert.rejects(verifySupplementalDecisionProofs(temp,[wrongHash]),/text identity/);
  await writeFile(join(dir,`documents/${id}.json`),JSON.stringify({...doc,text:doc.text.replace('R6.4.1','R5.4.1')}));
  await assert.rejects(verifySupplementalDecisionProofs(temp,[decision]),/document hash mismatch/);
 }finally{await rm(temp,{recursive:true,force:true});}
});
