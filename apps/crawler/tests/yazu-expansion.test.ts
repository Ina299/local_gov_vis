import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractYazu} from '../src/evaluations/expansion/yazu';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);const m=JSON.parse(readFileSync(new URL('municipalities/31329.json',root),'utf8'));
function input(id:string):CachedInput{const s=m.sources.find((x:{id:string})=>x.id===id);const d=JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));return {municipalityCode:'31329',municipalityName:'八頭町',sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf',text:d.text,truncated:d.truncated};}
const a=input('b50d11a4d77777f274824358'),b=input('c51a7e71d4b7749351c1f9ea');
test('Yazu separates two form years and excludes goal and missing-cell columns',()=>{
 const x=extractYazu(a),y=extractYazu(b);assert.equal(x.length,10);assert.equal(y.length,6);assert.equal(new Set([...x,...y].map(p=>p.id)).size,16);
 assert.ok(x.every(p=>p.evaluationYear===2025&&p.evaluatedFiscalYear===null));assert.ok(y.every(p=>p.evaluationYear===2026));
 const vacant=x.find(p=>p.projectCode==='32')!;assert.equal(vacant.amounts.find(v=>v.kind==='actual'&&v.fiscalYear===2022)!.amountYen,10952000);
 assert.ok(x.every(p=>p.amounts.every(v=>v.fiscalYear===2022||v.fiscalYear===2023)));assert.ok(y.every(p=>p.amounts.every(v=>v.fiscalYear===2023||v.fiscalYear===2024)));
 assert.equal(x.find(p=>p.projectCode==='704')!.amounts.length,0);assert.ok(y.every(p=>!p.amounts.some(v=>v.kind==='actual')));
 assert.ok([...x,...y].every(p=>p.outcomes===null&&p.indicators.length===0));
});
test('Yazu evidence resolves and truncated final sheet is not imported',()=>{
 for(const s of [a,b])for(const p of extractYazu(s))for(const e of [...p.evidence,...p.amounts.map(v=>v.evidence)]){const pos=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(s.text.slice(+pos[1],+pos[2]),e.rawText);}
 assert.equal(extractYazu({...b,truncated:true}).length,5);assert.deepEqual(extractYazu({...a,municipalityCode:'31328'}),[]);
});
