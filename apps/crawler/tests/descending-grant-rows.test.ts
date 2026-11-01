import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {extractDescendingGrantRows} from '../src/evaluations/expansion/descending-grant-rows';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function input(code:string,id:string):CachedInput{const d=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));return {municipalityCode:code,municipalityName:code,sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text:d.text,format:'pdf',truncated:false};}
test('six reviewed name-column rows retain evidence without cross-column amounts',()=>{
 for(const [code,id]of [['46482','1af8970080a0ae2ba9940854'],['46491','bec6f8f00321a5f3d3517e83']]){const i=input(code,id),ps=extractDescendingGrantRows(i);assert.equal(ps.length,3);for(const p of ps){assert.equal(p.evaluatedFiscalYear,2024);assert.equal(p.evaluationYear,null);assert.deepEqual(p.amounts,[]);assert.equal(p.outcomes,null);for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}}if(code==='46491')assert.ok(ps.every(p=>p.projectCode!=='7'));}
});
test('wrong source, truncated body and missing explicit year do not create grant rows',()=>{const i=input('46491','bec6f8f00321a5f3d3517e83');for(const patch of [{sourceId:'other'},{truncated:true},{text:i.text.replace('令和６年度','年度不明')}])assert.deepEqual(extractDescendingGrantRows({...i,...patch}),[]);});
test('Isa name-column review keeps 31 explicit FY2023 businesses without amounts or inferred row numbers',()=>{
 const i=input('46224','3cb26ad2ecc6811c49fb7eb2'),ps=extractDescendingGrantRows(i);assert.equal(ps.length,31);assert.equal(new Set(ps.map(p=>p.projectName)).size,31);
 for(const p of ps){assert.equal(p.evaluatedFiscalYear,2023);assert.equal(p.evaluationYear,2024);assert.equal(p.projectCode,null);assert.deepEqual(p.amounts,[]);if(p.projectName.includes('文化・スポーツ交流')){assert.ok(p.evidence[0].rawText!.includes('文化・スポーツ交流推進事業（合'));assert.ok(p.evidence[0].rawText!.includes('宿誘致事業）（臨時）'));assert.ok(p.evidence.some(e=>e.rawText==='文化・スポーツ合宿の誘致を進'));}else assert.ok(p.evidence[0].rawText!.includes(p.projectName));}
 assert.equal(ps.filter(p=>p.projectName.includes('文化・スポーツ交流')).length,1);
 assert.deepEqual(extractDescendingGrantRows({...i,text:i.text.replace('（令和５年度実施事務事業）','（対象年度不明）')}),[]);
});
test('additional grant title fragments retain printed years and no invented project codes',()=>{
 for(const [code,id,count,year]of [['46392','f7ebb002e6a580c53287a363',1,2023],['46392','2f95c71fe079e1abe1feb381',1,2024],['46452','6553773eb584b417aebf4d71',4,2023]] as const){const i=input(code,id),ps=extractDescendingGrantRows(i);assert.equal(ps.length,count);for(const p of ps){assert.equal(p.evaluatedFiscalYear,year);assert.equal(p.projectCode,null);assert.deepEqual(p.amounts,[]);}}
});
