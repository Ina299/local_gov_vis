import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { CachedInput } from '../src/evaluations/expansion/shared';
import { extractMisatoSaitama } from '../src/evaluations/expansion/misato-saitama';
import { extractTaito } from '../src/evaluations/expansion/taito';
import { extractNikaho } from '../src/evaluations/expansion/nikaho';
function load(id:string,name:string):CachedInput{
 const d=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));
 return{...d,municipalityName:name,format:'pdf',sourcePageUrl:d.sourceUrl,fetchedAt:'2026-10-12T00:00:00Z'};
}
const misato=load('de5160adc1e1a29f5a6efaff','美里町');
const taito=load('d267cafeefb79fc2fed20372','台東区');
const nikaho=load('26804d000c51723a84a40007','にかほ市');

test('Misato Saitama retains one project, holds conflicting exchange counts and unspecified cost kind',()=>{
 const [p]=extractMisatoSaitama(misato);
 assert.equal(p.projectCode,'H19-A-01');assert.equal(p.evaluationYear,2007);assert.equal(p.evaluatedFiscalYear,2006);
 assert.equal(p.amounts.length,0);assert.equal(p.indicators.length,5);assert.equal(p.ratings.length,3);
 assert.deepEqual(p.indicators.filter(i=>i.name.includes('参加人数')).map(i=>i.actual),['743','903','826']);
 assert.equal(p.indicators.filter(i=>i.fiscalYear===2006&&i.name.includes('交流回数')).length,0);
 assert.ok(p.outcomes?.includes('２５回'));assert.ok(p.warnings.some(w=>w.includes('表24回')));
 assert.ok(!p.indicators.some(i=>i.name.includes('成果')));
});

test('Taito never mistakes the related RPA plan code or full cost for direct business cost',()=>{
 const [p]=extractTaito(taito);
 assert.equal(p.projectName,'行政経営推進');assert.equal(p.projectCode,null);
 assert.equal(p.evaluationYear,2019);assert.equal(p.evaluatedFiscalYear,2018);
 assert.deepEqual(p.amounts.filter(a=>a.kind==='fullCost').map(a=>[a.fiscalYear,a.amountYen]),[[2016,36797000],[2017,32444000],[2018,39330000]]);
 assert.deepEqual(p.amounts.filter(a=>a.kind==='personnel').map(a=>a.amountYen),[35668000,31005000,37911000]);
 assert.equal(p.amounts.filter(a=>a.kind==='actual').length,0);
 assert.equal(p.indicators.length,11);
 assert.deepEqual(p.indicators.filter(i=>i.name.includes('改善事業率')).map(i=>[i.fiscalYear,i.actual]),[[2016,'15.2'],[2017,'12.3'],[2018,'17.8']]);
 assert.ok(p.indicators.every(i=>i.target===null&&i.actual!=='90.2'));
 assert.equal(p.ratings.length,4);assert.ok(p.ratings.every(r=>r.value==='3'));
});

test('Nikaho uses six independent external evaluation boxes and never the 36-row nomination list',()=>{
 const ps=extractNikaho(nikaho);
 assert.equal(ps.length,6);assert.deepEqual(ps.map(p=>p.projectCode),['1','2','3','4','5','6']);
 assert.ok(ps.every(p=>p.evaluationYear===2025&&p.evaluatedFiscalYear===2024&&p.outcomes&&p.amounts.length===0&&p.indicators.length===0));
 assert.ok(ps.every(p=>p.ratings.length===1&&p.ratings[0].kind==='external'&&p.ratings[0].value==='A'));
 assert.equal(ps[1].projectName,'若者地元就職促進事業');
 assert.equal(ps.at(-1)!.projectName,'就農アドバイザー事業');
 assert.ok(ps[2].outcomes?.includes('成果指標が未設定'));
 assert.equal(extractNikaho({...nikaho,truncated:true}).length,5);
 assert.equal(extractNikaho({...nikaho,text:nikaho.text.slice(0,nikaho.text.indexOf('《令和７年７月２３日'))}).length,0);
});

test('All batch5 evidence ranges are exact and wrong or incomplete documents are excluded',()=>{
 for(const[input,extract]of[[misato,extractMisatoSaitama],[taito,extractTaito],[nikaho,extractNikaho]]as const){
  for(const p of extract(input))for(const e of[...p.evidence,...p.amounts.map(a=>a.evidence),...p.indicators.map(i=>i.evidence),...p.ratings.map(r=>r.evidence)]){
   const[start,end]=e.cell!.split(':').at(-1)!.split('-').map(Number);assert.equal(input.text.slice(start,end),e.rawText);
  }
  assert.equal(extract({...input,sourceId:'unknown'}).length,0);
  assert.equal(extract({...input,municipalityCode:'00000'}).length,0);
  assert.equal(extract({...input,text:input.text.slice(0,1000),truncated:true}).length,0);
 }
});
