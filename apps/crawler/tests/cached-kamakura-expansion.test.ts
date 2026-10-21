import assert from 'node:assert/strict';
import { readdirSync,readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractKamakura } from '../src/evaluations/expansion/kamakura';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const dir=new URL('../../web/public/evaluation-evidence/documents/',import.meta.url);
const inputs:CachedInput[]=readdirSync(dir).map(f=>JSON.parse(readFileSync(new URL(f,dir),'utf8'))).filter(d=>d.municipalityCode==='14204').map(d=>({...d,municipalityName:'鎌倉市',format:'pdf',sourcePageUrl:d.sourceUrl,fetchedAt:'2026-10-12T00:00:00Z'}));
test('Kamakura has 129 business sheets with unique codes, excluding navigation and component rows',()=>{
 const ps=inputs.flatMap(extractKamakura);assert.equal(ps.length,129);assert.equal(new Set(ps.map(p=>p.projectCode)).size,129);
 assert.ok(ps.every(p=>[null,2024].includes(p.evaluationYear)&&p.evaluatedFiscalYear===2023&&p.amounts.length===3));
 const p=ps.find(p=>p.projectName==='就学支援事業')!;
 assert.deepEqual(p.amounts.map(a=>[a.kind,a.fiscalYear,a.amountYen]),[['actual',2023,36510000],['budget',2023,44814000],['budget',2024,28973000]]);
 assert.equal(p.ratings[0].value,'現状維持');assert.ok(p.purpose?.includes('経済的負担'));assert.ok(p.outcomes?.includes('就学援助金助成事務'));
});
test('Kamakura financial table totals independently agree with printed finance-source totals within rounding',()=>{
 for(const input of inputs){const[p]=extractKamakura(input);if(!p)continue;
  const region=input.text.slice(input.text.indexOf('国県支出金 /'),input.text.indexOf('事業費の合計'));
  // Only complete pairs; blank unlabelled finance lines are not inferred.
  const rows=[...region.matchAll(/(?:国県支出金|地方債|その他特定財源|一般財源) ([\d,]+) \/ ([\d,]+)/g)];
  if(!rows.length)continue;
  const actual=rows.reduce((n,m)=>n+Number(m[1].replaceAll(',',''))*1000,0);
  if(actual>0)assert.ok(Math.abs(actual-p.amounts[0].amountYen!)<=2000,`${p.projectCode}: ${actual}`);
 }
});
test('Kamakura exact evidence, complete source boundaries, unknown-year and truncated rejection',()=>{
 for(const input of inputs)for(const p of extractKamakura(input))for(const e of[...p.evidence,...p.amounts.map(a=>a.evidence),...p.ratings.map(r=>r.evidence)]){
  const[a,b]=e.cell!.split(':').at(-1)!.split('-').map(Number);assert.equal(input.text.slice(a,b),e.rawText);
 }
 const input=inputs.find(i=>extractKamakura(i).length)!;
 assert.equal(extractKamakura({...input,truncated:true}).length,0);
 assert.equal(extractKamakura({...input,text:input.text.replace('令和６年（2024年）','令和７年（2025年）')}).length,0);
});
