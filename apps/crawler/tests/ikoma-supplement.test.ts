import assert from 'node:assert/strict';import {readFileSync}from'node:fs';import{test}from'node:test';
import{extractIkomaSupplement}from'../src/evaluations/expansion/ikoma-supplement';import type{CachedInput}from'../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);const m=JSON.parse(readFileSync(new URL('municipalities/29209.json',root),'utf8'));
const ids=['e0461352d7085dece6c1957a','ca956ab17fc885531ffc3352','1a408a4f852bd2ca5bb5e179','02a67525a1e3497669a0ddde','a612815310b8f897e6f815f7','83ea44c58916bffdd5b36594'];
const inputs:CachedInput[]=ids.map(id=>{const s=m.sources.find((s:{id:string})=>s.id===id);const d=JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));return{...d,municipalityName:'生駒市',sourcePageUrl:s.url,sourceUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf'};});
test('Ikoma supplements management policies without conflating Roman-numbered policies or empty forms',()=>{
 const groups=inputs.map(extractIkomaSupplement);assert.deepEqual(groups.map(x=>x.length),[13,10,4,3,0,2]);
 assert.equal(new Set(groups.flat().map(x=>x.id)).size,32);assert.ok(groups.flat().every(x=>x.outcomes&&!x.amounts.length));
 assert.equal(groups[0][0].projectCode,'management:Ⅰ-1');assert.equal(groups[3][0].projectCode,'management:Ⅱ-1');
 assert.ok(groups.flat().every(x=>x.evaluationYear===null&&x.evaluatedFiscalYear===2024));
 assert.ok(inputs[4].text.includes('記載例'));assert.deepEqual(groups[4],[]);
 assert.deepEqual(groups[0][0].indicators.map(x=>[x.fiscalYear,x.target,x.actual]),[[2024,'80','158']]);
});
test('Ikoma supplement records contain exact original text and preserve missing KPI columns',()=>{
 for(const s of inputs)for(const r of extractIkomaSupplement(s))for(const e of [...r.evidence,...r.indicators.map(x=>x.evidence),...r.ratings.map(x=>x.evidence)]){const q=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(s.text.slice(+q[1],+q[2]),e.rawText);}
 assert.equal(extractIkomaSupplement({...inputs[0],truncated:true}).length,12);
 assert.deepEqual(extractIkomaSupplement({...inputs[0],sourceId:'other'}),[]);
});

test('Ikoma hyphenated disaster project IDs remain separate and defer unperformed evaluation',()=>{const rows=extractIkomaSupplement(inputs[5]);assert.deepEqual(rows.map(x=>x.projectCode),['8-5-1','8-5-2']);assert.equal(rows[1].projectName,'防災備蓄倉庫の新設');assert.ok(rows[1].evidence[0].rawText.includes('当該事業に係る取組は未完了であるため、評価は行わない。'));});
