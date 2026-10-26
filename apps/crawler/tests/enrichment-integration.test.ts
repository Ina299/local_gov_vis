import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,cp,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {assertExplicitYear,composeEnrichment,readCachedProof,importEnrichment,verifyEnrichedEvaluations,readEnrichmentBase,ENRICHMENT_MANIFEST,type EnrichmentPatch} from '../src/evaluations/enrichment-integration';
import {sha256,type IntegrationAssets} from '../src/evaluations/national-integration';
import {supplementalRecordSha256,importSupplementalEvaluations} from '../src/evaluations/supplemental-integration';
const root=resolve(import.meta.dirname,'../../..'),date='2026-10-18T00:00:00Z';
const json=(v:unknown)=>Buffer.from(JSON.stringify(v)+'\n');
async function fixture(){
 let indexBytes=await readFile(join(root,'apps/web/public/evaluations-index.json'));
 try{indexBytes=json(JSON.parse(await readFile(join(root,ENRICHMENT_MANIFEST),'utf8')).baseIndex);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const index=JSON.parse(indexBytes.toString()),row=index.municipalities.find((r:any)=>r.municipalityCode==='20206');
 const bytes=await readFile(join(root,'apps/web/public',row.datasetPath)),d=JSON.parse(bytes.toString()),p=d.projects[0];
 const municipal=JSON.parse(await readFile(join(root,'apps/web/public/evaluation-evidence/municipalities/20206.json'),'utf8'));
 const source=municipal.sources.find((s:any)=>s.url===p.evidence[0].sourceUrl||s.sourceUrl===p.evidence[0].sourceUrl);
 const proof=await readCachedProof(root,'20206',source.id,p.evidence[0].rawText);
 const patch:EnrichmentPatch={id:'test',municipalityCode:'20206',projectId:p.id,beforeRecordSha256:supplementalRecordSha256(p),identity:{reason:'The exact project name and original source identify this existing business record.',proofs:[proof]},set:{purpose:{value:proof.quote,proofs:[proof]}}};
 return{base:{index,indexBytes,shards:new Map([['20206',bytes]])}as IntegrationAssets,patch,p,bytes};
}
function input(patches:EnrichmentPatch[]){const b=json({schemaVersion:1,generatedAt:date,patches});return new Map([[sha256(b),b]]);}
test('enrichment combines same-base patches without record creation or immutable input changes',async()=>{
 const{base,patch,p,bytes}=await fixture(),other=structuredClone(patch);other.id='second';other.set={activities:other.set!.purpose};
 const out=await composeEnrichment(root,base,input([patch,other]),date),d=JSON.parse(out.composed.get('20206')!.toString());
 assert.equal(d.projects.length,JSON.parse(bytes.toString()).projects.length);assert.equal(d.projects[0].id,p.id);assert.equal(d.projects[0].purpose,patch.set!.purpose!.value);assert.equal(d.projects[0].activities,d.projects[0].purpose);assert.ok(base.shards.get('20206')!.equals(bytes));assert.equal(out.manifest.statistics.filledFields,2);assert.equal(out.manifest.statistics.changedRecords,1);
});
test('enrichment rejects stale hashes, replacement, nonliteral text and tampered proof offsets/hash',async()=>{
 const{base,patch}=await fixture();
 for(const mutate of [(p:EnrichmentPatch)=>p.beforeRecordSha256='a'.repeat(64),(p:EnrichmentPatch)=>p.set={evaluationYear:{value:2021,proofs:p.identity.proofs}},(p:EnrichmentPatch)=>p.set!.purpose!.value='invented',(p:EnrichmentPatch)=>p.identity.proofs[0].cell='extracted-text:chars:0-8',(p:EnrichmentPatch)=>p.identity.proofs[0].textSha256='a'.repeat(64)]){const next=structuredClone(patch);mutate(next);await assert.rejects(()=>composeEnrichment(root,base,input([next]),date));}
});
test('same-field equality is counted once; conflicting literal values and unproved years fail',async()=>{
 const{base,patch}=await fixture(),other=structuredClone(patch);other.id='second';
 assert.equal((await composeEnrichment(root,base,input([patch,other]),date)).manifest.statistics.filledFields,1);
 other.set!.purpose!.value=other.set!.purpose!.value.slice(0,10);await assert.rejects(()=>composeEnrichment(root,base,input([patch,other]),date),/Conflicting/);
 other.set={evaluationYear:{value:2099,proofs:other.identity.proofs}};const b=JSON.parse(base.shards.get('20206')!.toString());b.projects[0].evaluationYear=null;base.shards.set('20206',json(b));other.beforeRecordSha256=supplementalRecordSha256(b.projects[0]);await assert.rejects(()=>composeEnrichment(root,base,input([other]),date),/Year is not explicit/);
});
test('array evidence cannot smuggle unsupported fiscal years or amount conversion',async()=>{
 const{base,patch,p}=await fixture();const q=patch.identity.proofs[0];
 const evidence={...p.evidence[0],cell:q.cell,rawText:q.quote};
 patch.set=undefined;patch.append={amounts:[{value:{kind:'budget',fiscalYear:2099,amountYen:13905000,rawValue:'13,905',rawUnit:'千円',evidence},proofs:[q]}]};
 await assert.rejects(()=>composeEnrichment(root,base,input([patch]),date),/Year is not explicit/);
 patch.append.amounts![0].value.fiscalYear=null;patch.append.amounts![0].value.amountYen=13905;
 await assert.rejects(()=>composeEnrichment(root,base,input([patch]),date),/unit conversion/);
});
test('filesystem enrichment replays preserved base, is idempotent, and rejects output tampering',async()=>{
 const{patch,base}=await fixture(),temp=await mkdtemp(join(tmpdir(),'enrichment-'));
 try{
  await mkdir(join(temp,'apps/web/public'),{recursive:true});await mkdir(join(temp,'data'),{recursive:true});
  await cp(join(root,'data/evaluations'),join(temp,'data/evaluations'),{recursive:true});
  for(const name of ['evaluations.json','evaluations-index.json','evaluations-municipal','evaluations-composed','evaluation-evidence'])await cp(join(root,'apps/web/public',name),join(temp,'apps/web/public',name),{recursive:true});
  await rm(join(temp,ENRICHMENT_MANIFEST),{force:true});await writeFile(join(temp,'apps/web/public/evaluations-index.json'),base.indexBytes);
  const before=await readEnrichmentBase(temp),path=join(temp,'patch.json');await writeFile(path,[...input([patch]).values()][0]);
  const after=await importEnrichment({root:temp,inputFiles:[path],generatedAt:date});
  assert.equal(after.index.primaryEvaluationRecords,before.index.primaryEvaluationRecords);assert.deepEqual((await readEnrichmentBase(temp)).indexBytes,before.indexBytes);
  const provenance=await readFile(join(temp,ENRICHMENT_MANIFEST));const replay=await importEnrichment({root:temp,inputFiles:[path],generatedAt:'2026-10-19T00:00:00Z'});assert.deepEqual(after.indexBytes,replay.indexBytes);assert.deepEqual(await readFile(join(temp,ENRICHMENT_MANIFEST)),provenance);
  // A later append must retain the proven enrichment and rebase its manifest, not replace the public index with the pre-enrichment layer.
  const inputDir=join(temp,'append');await mkdir(inputDir);
  const sourceDataset=JSON.parse(before.shards.get('20206')!.toString());
  const addition=structuredClone(sourceDataset.projects[0]);addition.id+='-append-fixture';addition.projectCode=null;addition.projectName='追加事業の独立したテスト個票';
  const owners=sourceDataset.sources.flatMap((s:any)=>s.documents.filter((d:any)=>d.url===addition.evidence[0].sourceUrl&&d.sha256===addition.evidence[0].sha256).map((d:any)=>({s,d})));
  assert.equal(owners.length,1);
  for(const s of sourceDataset.sources){s.extractedProjects=0;for(const d of s.documents)d.projectCount=0;}
  owners[0].s.extractedProjects=1;owners[0].d.projectCount=1;
  await writeFile(join(inputDir,'20206.json'),json({...sourceDataset,projects:[addition]}));
  const appended=await importSupplementalEvaluations({root:temp,sourceDirectory:inputDir,generatedAt:'2026-10-26T00:00:00Z'});
  assert.equal(appended.index.primaryEvaluationRecords,after.index.primaryEvaluationRecords+1);
  const retained=JSON.parse(appended.shards.get('20206')!.toString()).projects.find((p:any)=>p.id===patch.projectId);
  assert.equal(retained.purpose,patch.set!.purpose!.value);
  const rebased=JSON.parse(await readFile(join(temp,ENRICHMENT_MANIFEST),'utf8'));
  assert.deepEqual(rebased.inputs,JSON.parse(provenance.toString()).inputs);
  assert.deepEqual(rebased.statistics,JSON.parse(provenance.toString()).statistics);
  assert.deepEqual((await importSupplementalEvaluations({root:temp,sourceDirectory:inputDir,generatedAt:'2026-10-27T00:00:00Z'})).indexBytes,appended.indexBytes);
  const row=appended.index.municipalities.find(r=>r.municipalityCode==='20206')!;await writeFile(join(temp,'apps/web/public',row.datasetPath!),'{}');await assert.rejects(()=>verifyEnrichedEvaluations(temp),/shard mismatch/);
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('explicit abbreviated fiscal-year labels are accepted without inferring adjacent years',async()=>{
 const{base,patch,p}=await fixture(),b=JSON.parse(base.shards.get('20206')!.toString());b.projects[0].evaluationYear=null;base.shards.set('20206',json(b));patch.beforeRecordSha256=supplementalRecordSha256(b.projects[0]);
 const q=await readCachedProof(root,'20206',patch.identity.proofs[0].sourceId,p.evidence[2].rawText);patch.set={evaluationYear:{value:2021,proofs:[q]}};
 const result=await composeEnrichment(root,base,input([patch]),date);assert.equal(JSON.parse(result.composed.get('20206')!.toString()).projects[0].evaluationYear,2021);
 patch.set.evaluationYear!.value=2022;await assert.rejects(()=>composeEnrichment(root,base,input([patch]),date),/Year is not explicit/);
});
test('same source alone cannot bind a different project to an identity quote',async()=>{
 const{base,patch}=await fixture(),d=JSON.parse(base.shards.get('20206')!.toString());
 d.projects[0].projectName='別個の独立事業';d.projects[0].evidence=d.projects[0].evidence.map((e:any)=>({...e,rawText:'別個の独立事業の原文根拠'}));d.projects[0].amounts=[];d.projects[0].ratings=[];
 base.shards.set('20206',json(d));patch.beforeRecordSha256=supplementalRecordSha256(d.projects[0]);await assert.rejects(()=>composeEnrichment(root,base,input([patch]),date),/Same-business proof/);
});
test('inherited evidence lacking source metadata does not demand a new enrichment proof',async()=>{
 const{base,patch}=await fixture(),d=JSON.parse(base.shards.get('20206')!.toString());
 d.projects[0].evidence.push({...d.projects[0].evidence[0],sourceUrl:'https://example.jp/inherited-reference.pdf'});base.shards.set('20206',json(d));patch.beforeRecordSha256=supplementalRecordSha256(d.projects[0]);
 const result=await composeEnrichment(root,base,input([patch]),date);assert.equal(result.manifest.statistics.changedRecords,1);
});

test('abbreviated year boundaries preserve whitespace before adjacent financial columns',()=>{
 const proof=(quote:string)=>[{sourceId:'',sourceUrl:'',sourceSha256:'',textSha256:'',quote,cell:''}];
 assert.doesNotThrow(()=>assertExplicitYear(2007,proof('H19 1,952')));
 assert.doesNotThrow(()=>assertExplicitYear(2024,proof('Ｒ ６ 実施内容')));
 assert.throws(()=>assertExplicitYear(2007,proof('H190 1,952')),/not explicit/);
 assert.throws(()=>assertExplicitYear(2007,proof('AH19 1,952')),/not explicit/);
});
