import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { CachedInput } from '../src/evaluations/expansion/shared';
import { extractKamisato } from '../src/evaluations/expansion/kamisato';
import { extractToshima } from '../src/evaluations/expansion/toshima';
function load(id:string, name:string):CachedInput {
  const d = JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));
  return {...d,municipalityName:name,format:'pdf',sourcePageUrl:d.sourceUrl,fetchedAt:'2026-10-12T00:00:00Z'};
}
const kami=load('cae717f81825be62830b0bc9','上里町');
const toshi=load('b7b2eb8e7fc28693dae05038','豊島区');

test('Kamisato preserves explicit zero actual, never divides by zero or converts empty indicators/personnel',()=>{
 const [p]=extractKamisato(kami);
 assert.equal(p.projectName,'上里町中学生体験研修参加費補助金');
 assert.equal(p.evaluationYear,2015);assert.equal(p.evaluatedFiscalYear,2015);
 assert.deepEqual(p.amounts.map(a=>[a.kind,a.fiscalYear,a.amountYen]),[['actual',2014,500000],['actual',2015,0],['budget',2016,500000]]);
 assert.equal(p.indicators.length,0);assert.equal(p.ratings.length,2);
 assert.ok(p.ratings.some(r=>r.value==='改善（関与・手続など見直し）'));
 assert.ok(p.purpose?.includes('人間形成'));assert.ok(p.activities?.includes('５万円'));
});

test('Toshima separates assessment year, actual direct costs, plans and indicator achievement rates',()=>{
 const [p]=extractToshima(toshi);
 assert.equal(p.projectCode,'0102-01');assert.equal(p.evaluationYear,2023);assert.equal(p.evaluatedFiscalYear,2022);
 assert.deepEqual(p.amounts.map(a=>[a.kind,a.fiscalYear,a.amountYen]),[['budget',2021,9000000],['actual',2021,4761000],['budget',2022,14473000],['actual',2022,12648000],['budget',2023,8253000]]);
 assert.equal(p.indicators.length,9);
 assert.deepEqual(p.indicators.filter(i=>i.name.startsWith('【成果指標】')).map(i=>[i.fiscalYear,i.target,i.actual,i.unit]),[[2021,null,'31.4','％'],[2022,'40.0','31.3','％'],[2023,'40.0',null,'％']]);
 assert.deepEqual(p.indicators.filter(i=>i.name.includes('自主企画事業')).map(i=>[i.target,i.actual]),[[null,'23'],['35','35'],['35',null]]);
 assert.ok(p.indicators.every(i=>!i.actual?.includes('%')));
 assert.equal(p.ratings.length,2);assert.ok(p.outcomes?.includes('企業連携プラットフォーム'));
 assert.ok(!p.purpose?.includes('待する効果'));
});

test('Both single-sheet extractors preserve exact evidence and reject truncated/unknown inputs',()=>{
 for(const [input,extract] of [[kami,extractKamisato],[toshi,extractToshima]] as const){
  const [p]=extract(input);
  for(const e of [...p.evidence,...p.amounts.map(a=>a.evidence),...p.indicators.map(i=>i.evidence),...p.ratings.map(r=>r.evidence)]){
   const [start,end]=e.cell!.split(':').at(-1)!.split('-').map(Number);
   assert.equal(input.text.slice(start,end),e.rawText);
  }
  assert.equal(extract({...input,truncated:true}).length,0);
  assert.equal(extract({...input,sourceId:'unknown'}).length,0);
  assert.equal(extract({...input,text:input.text.slice(0,1000)}).length,0);
 }
});
