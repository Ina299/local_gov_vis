import assert from 'node:assert/strict';import {readFileSync}from'node:fs';import{test}from'node:test';
import{extractYotsukaidoSupplement as y}from'../src/evaluations/expansion/yotsukaido-supplement';import{extractSuwaSupplement as s}from'../src/evaluations/expansion/suwa-supplement';import type{CachedInput}from'../src/evaluations/expansion/shared';
function input(id:string):CachedInput{const d=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));return{...d,format:'pdf',sourcePageUrl:d.sourceUrl,fetchedAt:'2026-10-12T00:00:00Z',municipalityName:'fixture'};}
const sections:[string,number][]=[['56c3d0472e60a1c6c57751fb',2],['6d67ec9f48238197b1ce0f50',3],['90fb5c0eff46e4aaac55ab17',1],['a69ec69c5502fb0185802271',13],['ac580a95c60ebd8ad87ecee9',14],['dbcf5adaad24810fa8ecf734',2],['dd2aa1e2bc4db5a4ba3e5bf6',15]];
test('Yotsukaido reviewed full names avoid mid-word row fragments and combined-book duplicates',()=>{
 const all=sections.flatMap(([id,n])=>{const d=input(id),ps=y(d);assert.equal(ps.length,n);assert.deepEqual(y({...d,truncated:true}),[]);return ps;});
 assert.equal(all.length,50);assert.equal(new Set(all.map(p=>p.id)).size,50);assert.ok(!all.some(p=>p.projectName==='検診事業'||p.projectName==='ティ推進事業'||p.projectName==='給付事業'));
 assert.ok(all.every(p=>p.evaluationYear===2026&&p.evaluatedFiscalYear===2025&&p.amounts.length===0));
 assert.ok(all.every(p=>p.ratings.every(r=>r.label==='有効性'||r.label==='令和8年度 事業の方向性')));
 assert.deepEqual(y(input('edbd2864812ebcee374db24f')),[]);
 assert.deepEqual(y({...input(sections[0][0]),text:input(sections[0][0]).text.replaceAll('令和８年度','令和９年度')}),[]);
});
test('Suwa extracts closed 2021 final-account and direction rows, never infers wrapped departments or names',()=>{
 const d=input('15c84080811ea70453dba415'),ps=s(d);assert.equal(d.truncated,true);assert.equal(ps.length,28);assert.equal(new Set(ps.map(p=>p.id)).size,28);
 assert.equal(ps.find(p=>p.projectName==='発達支援事業')?.amounts[0].amountYen,13905000);
 assert.equal(ps.find(p=>p.projectName==='人権啓発活動事業')?.amounts[0].amountYen,0);
 assert.ok(!ps.some(p=>p.projectName==='任意事業'||p.projectName==='地球温暖化対策事業'||p.projectName==='産業連携推進事業'));
 assert.ok(ps.every(p=>p.ratings.length===2&&p.amounts.length===1&&p.amounts[0].kind==='actual'&&p.amounts[0].fiscalYear===2021));
 assert.deepEqual(s({...d,text:d.text.replaceAll('決算額','予算額')}),[]);
 const first=d.text.indexOf('13,905 こども課');assert.deepEqual(s({...d,text:d.text.slice(0,first+20)}),[]);
 assert.deepEqual(s(input('d6b6c9ae8dddc58dc91103a9')),[]);
});
test('all evidence and numeric fields are supported by exact retained text positions',()=>{
 for(const[id,run]of [...sections.map(([id])=>[id,y]as const),['15c84080811ea70453dba415',s]as const]){const d=input(id);for(const p of run(d))for(const e of [...p.evidence,...p.amounts.map(a=>a.evidence),...p.ratings.map(r=>r.evidence)]){const[a,b]=e.cell!.split(':').at(-1)!.split('-').map(Number);assert.equal(d.text.slice(a,b),e.rawText);}}
});
