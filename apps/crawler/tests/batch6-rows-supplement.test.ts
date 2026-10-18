import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractBatch6RowsSupplement} from '../src/evaluations/expansion/batch6-rows-supplement';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const base=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const specs=[['11219','1ddd38b5f9624439f6ae412d'],['36489','087d15d5bf7f69b936ea48a8'],['14384','63faf204e9cb509818cdd624']];
function input(code:string,id:string):CachedInput{const m=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,base),'utf8'));const s=m.sources.find((x:{id:string})=>x.id===id);return {...JSON.parse(readFileSync(new URL(s.text.assetPath,base),'utf8')),municipalityCode:code,municipalityName:m.municipalityName,format:'pdf',fetchedAt:s.acquisition.fetchedAt,sourcePageUrl:s.url};}
test('single-line evaluations retain original grade, year and exact evidence',()=>{
 for(const [code,id]of specs){const s=input(code,id),rows=extractBatch6RowsSupplement(s);console.log(code,rows.length);assert.ok(rows.length>100);assert.equal(new Set(rows.map(p=>p.projectCode)).size,rows.length);
 for(const p of rows){assert.equal(p.evaluationYear,2025);assert.equal(p.evaluatedFiscalYear,code==='11219'?2024:null);assert.equal(p.outcomes,null);for(const e of p.evidence){const q=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(s.text.slice(+q[1],+q[2]),e.rawText);}}
 if(code==='11219'){assert.equal(rows[0].amounts[0].amountYen,7625000);assert.equal(rows[0].ratings[0].value,'2.継続');}
 if(code==='14384')assert.equal(rows.find(p=>p.projectCode==='115')!.projectName,'ｍａｄｅ ｉｎ ゆがわら認定事業');
 }
});
test('split names are not joined and truncated final row is excluded',()=>{
 const s=input(...specs[0] as [string,string]);const line='1 1 1 168 ファミリー・サポート・センター事業 こども支援課 7,625 a a b b b b a b A B B 2.継続';
 assert.equal(extractBatch6RowsSupplement({...s,text:line,truncated:true}).length,0);
 assert.equal(extractBatch6RowsSupplement({...s,text:line.replace('事業 こども','事業\nこども'),truncated:false}).length,0);
});

test('Ageo source-labelled total cost keeps negative signs without claiming gross spending or net formula',()=>{
 const s=input('11219','1ddd38b5f9624439f6ae412d'),rows=extractBatch6RowsSupplement(s);
 assert.equal(rows.length,477);
 for(const [code,value]of [['624',-1817000],['355',-33798000],['119',-97000]] as const){
  const p=rows.find(p=>p.projectCode===code)!;assert.equal(p.amounts[0].kind,'fullCost');assert.equal(p.amounts[0].amountYen,value);assert.equal(p.amounts[0].rawUnit,'千円');
  assert.ok(p.evidence.some(e=>e.rawText.includes('事業総コスト')&&e.rawText.includes('（千円）')));
  assert.ok(p.warnings.some(w=>w.includes('算定内訳は未確認')));assert.ok(!p.amounts.some(a=>a.kind==='actual'));
 }
 assert.equal(rows.filter(p=>p.amounts.some(a=>a.amountYen!<0)).length,3);
 assert.ok(rows.every(p=>p.warnings.some(w=>w.includes('支出決算額と同義ではありません'))));
});
