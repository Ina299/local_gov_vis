import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,join} from 'node:path';
import {reviewMogamiSheets,reviewTaitoSheet} from '../src/evaluations/expansion/inventory-sheets';
import {verifiedFullText} from '../src/evaluations/expansion/fulltext';
import {sha256} from '../src/evaluations/national-integration';
const root=resolve(import.meta.dirname,'../../..'),pub=join(root,'apps/web/public'),base=join(pub,'evaluation-evidence');
async function load(code:string,id:string){
 const m=JSON.parse(await readFile(join(base,`municipalities/${code}.json`),'utf8')),s=m.sources.find((s:any)=>s.id===id);
 const bytes=await readFile(join(base,s.text.assetPath));assert.equal(sha256(bytes),s.text.assetSha256);
 const d=JSON.parse(bytes.toString()),whole=await verifiedFullText(base,s,d,code);
 const idx=JSON.parse(gunzipSync(await readFile(join(root,'data/evaluations/cached-inventory-baseline-index.json.gz'))).toString());
 const row=idx.municipalities.find((r:any)=>r.municipalityCode===code),old=JSON.parse(await readFile(join(pub,row.datasetPath),'utf8'));
 return {input:{municipalityCode:code,municipalityName:m.municipalityName,sourceId:id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:d.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf' as const,text:whole.text,truncated:!whole.complete},title:s.title,prior:old.projects};
}
test('Mogami accounts for all 77 individual sheets, excludes 72 existing records and the explicit NO142 alias',async()=>{
 const results=[];
 for(const id of ['13de8a6ce5d6470c5f84ab83','e0478ac24f6040c9088eedbf']){const {input,prior}=await load('06362',id);assert.equal(prior.length,513);results.push(reviewMogamiSheets(input,prior));}
 const units=results.flatMap(x=>x.units),projects=results.flatMap(x=>x.projects);
 assert.equal(units.length,77);assert.equal(units.filter(x=>x.disposition==='existing_record_preserved').length,72);
 assert.equal(units.filter(x=>x.disposition==='explicit_duplicate').length,1);
 assert.deepEqual(projects.map(x=>x.projectCode),['3-1-1-3-1','3-2-1-2-1','3-3-5-2-1','6-1-1-1-1']);
 for(const p of projects){assert.equal(p.evaluatedFiscalYear,2023);assert.equal(p.evaluationYear,null);assert.deepEqual(p.amounts,[]);assert.deepEqual(p.indicators,[]);assert.deepEqual(p.ratings,[]);assert.ok(p.evidence[0].rawText.includes('令和6年度(現年度事業費)'));}
});
test('Mogami refuses missing sheets, changed fiscal-year labels, alias evidence and incomplete text',async()=>{
 const {input,prior}=await load('06362','13de8a6ce5d6470c5f84ab83');
 assert.throws(()=>reviewMogamiSheets({...input,truncated:true},prior));
 for(const text of [input.text.replace('№ 128','№ 999'),input.text.replaceAll('令和5年度(評価年度事業費)','令和6年度(評価年度事業費)'),input.text.replace('NO142と同じ事業であるため、事務事業評価では統合。','')])assert.throws(()=>reviewMogamiSheets({...input,text},prior));
});
test('Taito reconciles the official link title aliases without adding duplicates and refuses unknown year/chapters',async()=>{
 for(const id of ['4b2edb72a2ed731ff25c5927','70c91a8c9c5de9f416a435e7']){
  const {input,title,prior}=await load('13106',id),r=reviewTaitoSheet(input,title,prior);
  assert.equal(r.projects.length,0);assert.equal(r.units[0].existingIds?.length,1);
  const missingYear=reviewTaitoSheet({...input,text:input.text.replaceAll('[H30年度]','[対象年度不明]')},title,[]);
  assert.equal(missingYear.projects.length,0);assert.equal(missingYear.units[0].disposition,'layout_identity_hold');
  assert.equal(reviewTaitoSheet({...input,text:'政策の総合評価\n'+input.text},title,[]).projects.length,0);
 }
});
test('published inventory covers every current metadata source and every continuation with disjoint dispositions',async()=>{
 const audit=JSON.parse(await readFile(join(root,'data/evaluations/cached-inventory-review.json'),'utf8'));
 assert.equal(audit.sourceRequests,0);assert.equal(audit.existingFieldsAdded,0);assert.equal(audit.newRecords,25);
 assert.equal(audit.sourceRows,12483);assert.equal(audit.partsListed,647);assert.equal(audit.partsVerified,647);
 assert.equal(Object.values(audit.dispositions).reduce((n:any,x:any)=>n+x,0),12483);
 const ei=JSON.parse(await readFile(join(base,'index.json'),'utf8')),ids=[];
 for(const row of ei.municipalities){
  const bytes=await readFile(join(base,row.shardPath));assert.equal(sha256(bytes),row.shardSha256);const m=JSON.parse(bytes.toString());ids.push(...m.sources.map((s:any)=>`${row.municipalityCode}:${s.id}`));
  for(const source of m.sources.filter((s:any)=>s.text.status==='available')){
   const first=await readFile(join(base,source.text.assetPath));assert.equal(sha256(first),source.text.assetSha256);
   const result=await verifiedFullText(base,source,JSON.parse(first.toString()),row.municipalityCode);
   const record=audit.rows.find((r:any)=>r.municipalityCode===row.municipalityCode&&r.sourceId===source.id);
   assert.equal(sha256(Buffer.from(result.text)),record.fullTextSha256);
  }
 }
 assert.deepEqual(audit.rows.map((r:any)=>`${r.municipalityCode}:${r.sourceId}`).sort(),ids.sort());
 assert.equal(new Set(ids).size,ids.length);
 for(const r of audit.rows){if(r.closedCohorts.length)assert.equal(r.acceptedIds.length,0);if(r.parts.length)assert.equal(r.integrity,'verified');}
});
