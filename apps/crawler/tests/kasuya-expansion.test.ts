import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractKasuya} from '../src/evaluations/expansion/kasuya';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('municipalities/40349.json',root),'utf8'));
const inputs:CachedInput[]=['599c4d34f26f3c22ae5f1270','e3dcb80e8f7ebb782378e2dc'].map(id=>{
 const s=m.sources.find((x:{id:string})=>x.id===id);const d=JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));
 return {municipalityCode:'40349',municipalityName:'粕屋町',sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf',text:d.text,truncated:d.truncated};
});
test('Kasuya keeps six distinct project opinions each year and no overview or overall summary records',()=>{
 const a=extractKasuya(inputs[0]);const b=extractKasuya(inputs[1]);assert.equal(a.length,6);assert.equal(b.length,6);
 assert.ok(a.every(r=>r.evaluationYear===2022&&r.evaluatedFiscalYear===2021));assert.ok(b.every(r=>r.evaluationYear===2023&&r.evaluatedFiscalYear===2022));
 assert.equal(a[0].projectName,'情報システム管理事業');assert.equal(b[0].projectName,'災害対策事業');
 assert.ok([...a,...b].every(r=>r.purpose&&r.activities&&r.ratings.length===1&&r.ratings[0].kind==='external'));
 assert.ok([...a,...b].every(r=>r.amounts.length===0&&r.indicators.length===0&&r.outcomes===null));
 assert.ok([...a,...b].every(r=>!r.ratings[0].value.includes('■ 総 括 ■')));
});
test('Kasuya exact source quotes and truncated/incomplete opinions do not become completed projects',()=>{
 for(const input of inputs)for(const r of extractKasuya(input))for(const ev of [...r.evidence,...r.ratings.map(x=>x.evidence)]){
 const q=ev.cell!.match(/^extracted-text:chars:(\d+)-(\d+)$/)!;assert.equal(input.text.slice(Number(q[1]),Number(q[2])),ev.rawText);assert.equal(ev.sha256,input.sourceSha256);}
 assert.deepEqual(extractKasuya({...inputs[0],text:inputs[0].text.slice(0,3000),truncated:true}),[]);
 assert.deepEqual(extractKasuya({...inputs[0],municipalityCode:'00000'}),[]);
});
