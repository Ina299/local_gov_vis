import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractMiura} from '../src/evaluations/expansion/miura';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('municipalities/14210.json',root),'utf8'));
const s=m.sources.find((x:{id:string})=>x.id==='854bb8045dd409b2016516ef');const d=JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));
const input:CachedInput={municipalityCode:'14210',municipalityName:'三浦市',sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf',text:d.text,truncated:d.truncated};
test('Miura imports 14 individual sheets, distinguishes forecast cost and both explicit years',()=>{
 const rows=extractMiura(input);assert.equal(rows.length,14);assert.equal(new Set(rows.map(r=>r.id)).size,14);
 assert.equal(rows[1].projectName,'中学校施設整備事業');assert.equal(rows.at(-1)!.projectName,'青少年指導員活動事業');
 assert.ok(rows.every(r=>r.evaluationYear===2026&&r.evaluatedFiscalYear===2025&&r.activities&&r.ratings.length===3));
 assert.ok(rows.every(r=>r.ratings.every(x=>x.kind==='self'&&x.label.startsWith('教育委員会総合評価'))));
 assert.ok(rows.every(r=>!r.amounts.length&&!r.indicators.length&&r.outcomes===null));
 assert.ok(!rows.at(-1)!.evidence[0].rawText.includes('教育委員会会議'));
});
test('Miura evidence is exact and an unfinished sheet is omitted',()=>{
 for(const r of extractMiura(input))for(const e of [...r.evidence,...r.ratings.map(x=>x.evidence)]){const q=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(input.text.slice(+q[1],+q[2]),e.rawText);}
 const first=input.text.indexOf('No. 事業名 部門');assert.deepEqual(extractMiura({...input,text:input.text.slice(0,first+200),truncated:true}),[]);
 assert.deepEqual(extractMiura({...input,municipalityCode:'00000'}),[]);
});
