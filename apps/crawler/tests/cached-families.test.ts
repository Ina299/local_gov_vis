import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {bindings,materializeBinding} from '../src/evaluations/expansion/families/registry';
import {verifiedFullText} from '../src/evaluations/expansion/fulltext';
import {sha256} from '../src/evaluations/national-integration';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const root=resolve(import.meta.dirname,'../../..'),base=join(root,'apps/web/public/evaluation-evidence');
const contexts=new Map<string,Promise<CachedInput[]>>();
function load(code:string){if(!contexts.has(code))contexts.set(code,(async()=>{
 const m=JSON.parse(await readFile(join(base,`municipalities/${code}.json`),'utf8')),all:CachedInput[]=[];
 for(const s of m.sources.filter((s:any)=>s.text.status==='available'&&s.verification.status==='verified')){
  const bytes=await readFile(join(base,s.text.assetPath));assert.equal(sha256(bytes),s.text.assetSha256);
  const d=JSON.parse(bytes.toString()),full=await verifiedFullText(base,s,d,code);
  all.push({municipalityCode:code,municipalityName:m.municipalityName,sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:d.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf',text:full.text,truncated:!full.complete});
 }return all;
})());return contexts.get(code)!;}
test('all reviewed families reproduce only literal individual names and bound years, without policy amounts or ratings',async()=>{
 assert.equal(bindings.length,4900);let count=0;
 for(const code of new Set(bindings.map(b=>b.municipalityCode))){const all=await load(code);
  for(const b of bindings.filter(b=>b.municipalityCode===code)){
   const input=all.find(x=>x.sourceId===b.sourceId)!;if(b.identityHold){assert.throws(()=>materializeBinding(b,input,all),/identity hold/);continue;}const p=materializeBinding(b,input,all);
   assert.equal(p.projectName,b.name);assert.equal(p.evaluatedFiscalYear,b.fiscalYear);assert.equal(p.evaluationYear,b.evaluationYear);
   assert.deepEqual([p.amounts,p.ratings,p.indicators],[[],[],[]]);assert.deepEqual([p.purpose,p.activities,p.outcomes],[null,null,null]);count++;
  }
 }assert.equal(count,4781);
});
test('family bindings reject wrong offsets, altered names/years, missing continuation and changed source bytes',async()=>{
 const b=bindings.find(b=>b.family==='nakashibetsu-explicit-business-list')!,all=await load(b.municipalityCode),input=all.find(x=>x.sourceId===b.sourceId)!;
 for(const bad of [{...input,truncated:true},{...input,text:input.text.slice(0,120000)},{...input,sourceSha256:'0'.repeat(64)}])assert.throws(()=>materializeBinding(b,bad,all));
 assert.throws(()=>materializeBinding({...b,name:b.name+'未確認'},input,all));
 assert.throws(()=>materializeBinding({...b,titles:[{...b.titles[0],start:b.titles[0].start+1}]},input,all));
 assert.throws(()=>materializeBinding({...b,fiscalYear:2026},input,all));
 assert.throws(()=>materializeBinding({...b,periods:b.periods.map(p=>({...p,year:2026}))},input,all));
});
test('context-bound target years require the verified official context and Hanamaki same-name identities retain distinct literal codes/departments',async()=>{
 const b=bindings.find(b=>b.municipalityCode==='11343')!,all=await load(b.municipalityCode),input=all.find(x=>x.sourceId===b.sourceId)!;
 assert.throws(()=>materializeBinding(b,input,[input]));assert.equal(materializeBinding(b,input,all).evaluationYear,null);
 const hs=bindings.filter(b=>b.municipalityCode==='03205'),hc=await load('03205');assert.equal(hs.length,2);
 const ps=hs.map(b=>materializeBinding(b,hc.find(x=>x.sourceId===b.sourceId)!,hc));assert.equal(new Set(ps.map(p=>p.id)).size,2);assert.equal(new Set(ps.map(p=>p.department)).size,2);assert.deepEqual(ps.map(p=>p.projectCode).sort(),['104360','104480']);
});
test('family ledger retains all 4,375 queue sources and separates source review from accepted records',async()=>{
 const audit=JSON.parse(await readFile(join(root,'data/evaluations/cached-family-review.json'),'utf8'));
 const inv=JSON.parse(await readFile(join(root,'data/evaluations/cached-inventory-review.json'),'utf8'));
 const eligible=new Set(['individual_layout_review','referenced_source_coverage_unproven','content_type_review']);
 const queue=inv.rows.filter((r:any)=>eligible.has(r.disposition));
 assert.equal(audit.queueSources,4375);assert.equal(audit.newRecords,4748);assert.equal(audit.sourceRequests,0);assert.equal(audit.existingFieldsAdded,0);
 assert.deepEqual(audit.rows.map((r:any)=>`${r.municipalityCode}:${r.sourceId}`).sort(),queue.map((r:any)=>`${r.municipalityCode}:${r.sourceId}`).sort());
 assert.equal(audit.rows.flatMap((r:any)=>r.acceptedIds??[]).length,4748);
 assert.equal(audit.rows.flatMap((r:any)=>r.units??[]).filter((u:any)=>u.status==='identity_hold').length,119);
 const held=audit.rows.flatMap((r:any)=>r.holds??[]);assert.equal(held.length,33);
 assert.ok(held.every((h:any)=>/collision|duplicate|period/i.test(h.reason)));
 for(const r of audit.rows){const old=queue.find((x:any)=>x.sourceId===r.sourceId&&x.municipalityCode===r.municipalityCode);assert.ok(r.sourceReview);assert.equal(r.sourceReview.sourceSha256,old.sourceSha256);assert.equal(r.sourceReview.fullTextSha256,old.fullTextSha256);}
});
test('Honjo carryover budget rows sharing the ordinary business identity remain held, not extra annual businesses',async()=>{
 const groups=JSON.parse(await readFile(join(root,'data/evaluations/cached-family-review-inputs/honjo-carryover-identity-review.json'),'utf8'));
 assert.equal(groups.length,116);const all=await load('11211');let held=0;
 for(const group of groups){const plain=group.variants.find((v:any)=>v.name===group.baseName);assert.ok(plain);
  for(const v of group.variants){const b=bindings.find(b=>b.sourceId===v.sourceId&&b.titles[0].start===v.title.start)!;assert.ok(b);const input=all.find(x=>x.sourceId===v.sourceId)!;
   assert.ok(input.text.includes(v.header));assert.ok(v.header.includes(v.budgetCode));assert.equal(v.budgetCode.slice(-6),plain.budgetCode.slice(-6));assert.equal(b.fiscalYear,group.fiscalYear);
   if(v.name===group.baseName)assert.equal(b.identityHold,undefined);else{assert.ok(b.identityHold);assert.throws(()=>materializeBinding(b,input,all),/identity hold/);held++;}
  }
 }assert.equal(held,119);
});
