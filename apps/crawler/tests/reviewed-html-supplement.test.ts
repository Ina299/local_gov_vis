import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{test}from'node:test';
import{extractReviewedHtmlSupplement}from'../src/evaluations/expansion/reviewed-html-supplement';import type{CachedInput}from'../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);
function input(code:string,id:string):CachedInput{const m=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,root),'utf8'));const s=m.sources.find((s:{id:string})=>s.id===id);return{...JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8')),municipalityName:m.municipalityName,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'html'};}
const inputs=[input('17204','deaf62946c78f0b70f2e0c40'),input('12221','a6ec779b2d1d72d347d1af83'),input('22344','607cb9ffeb0e7514681d82e2')];
test('Reviewed HTML retains explicit individual results, corrected votes and fiscal years',()=>{
 const r=inputs.map(s=>extractReviewedHtmlSupplement(s)[0]);assert.ok(r.every(x=>x&&!x.amounts.length));
 assert.equal(r[0].evaluationYear,2026);assert.equal(r[0].evaluatedFiscalYear,2025);assert.equal(r[0].indicators.length,3);assert.deepEqual(r[0].indicators.map(x=>[x.fiscalYear,x.actual]),[[2023,'1,045'],[2024,'1,040'],[2025,'1,054']]);
 assert.equal(r[1].ratings[0].value,'要改善：10、現行通り：2');assert.equal(r[1].evaluatedFiscalYear,null);assert.equal(r[2].projectName,'（仮称）小山スマートICアクセス道路事業');
 for(const s of inputs)for(const p of extractReviewedHtmlSupplement(s))for(const e of [...p.evidence,...p.ratings.map(x=>x.evidence),...p.indicators.map(x=>x.evidence)]){const c=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(s.text.slice(+c[1],+c[2]),e.rawText);}
 assert.deepEqual(extractReviewedHtmlSupplement({...inputs[0],sourceId:'other'}),[]);
});

test('Nakatsugawa lists five historical C ratings, not current reassessment results',()=>{const s=input('21206','3e33436381baf4b812c295a6');const r=extractReviewedHtmlSupplement(s);assert.equal(r.length,5);assert.ok(r.every(x=>x.evaluationYear===2018&&x.evaluatedFiscalYear===2017&&x.ratings[0].value==='C 縮小/見直し'));assert.equal(r[0].projectName,'地域活性化推進事業（地域一括交付金）');assert.equal(r[4].projectName,'子ども科学館事業');});

test('Hiraizumi separates five committee judgments from policy-wide preceding narrative',()=>{const s=input('03402','4af5f378885a47a121f00131');const r=extractReviewedHtmlSupplement(s);assert.equal(r.length,5);assert.deepEqual(r.map(x=>x.ratings[0].value),['現状の規模で継続','拡大して継続','拡大して継続','縮小して継続','終了']);assert.ok(r.every(x=>x.evaluationYear===2025&&x.evaluatedFiscalYear===null&&!x.amounts.length));assert.equal(r[3].projectName,'窓口業務延長事業');assert.ok(!r[0].evidence[0].rawText.includes('ふるさと納税'));});
