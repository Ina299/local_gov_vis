import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractChikushino} from '../src/evaluations/expansion/chikushino';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('municipalities/40217.json',root),'utf8'));
const s=m.sources.find((x:{id:string})=>x.id==='317686041bd6c1a21d235417');const d=JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));
const input:CachedInput={municipalityCode:'40217',municipalityName:'筑紫野市',sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf',text:d.text,truncated:d.truncated};
test('Chikushino extracts eight individually numbered opinions without counting requested measures as projects',()=>{
 const rows=extractChikushino(input);assert.equal(rows.length,8);assert.equal(new Set(rows.map(r=>r.id)).size,8);
 assert.equal(rows[0].projectName,'コミュニティ運営協議会補助事業');assert.equal(rows[7].ratings[0].value,'廃止又は見直し');
 assert.equal(rows.filter(r=>r.ratings[0].value==='見直し').length,5);assert.equal(rows.filter(r=>r.ratings[0].value==='維持').length,2);
 assert.ok(rows.every(r=>r.evaluationYear===2025&&r.evaluatedFiscalYear===null));
 assert.ok(rows.every(r=>r.amounts.length===0&&r.indicators.length===0&&r.outcomes===null&&r.activities===null));
 assert.ok(rows.every(r=>r.ratings.length===2&&r.ratings.every(x=>x.kind==='external')));
 assert.match(rows[0].evidence[1].rawText,/交付要綱の見直しについて/);
 assert.ok(!rows[0].ratings[1].value.includes('（１）交付要綱'));
});
test('Chikushino source evidence is literal and incomplete final opinion is excluded',()=>{
 for(const r of extractChikushino(input))for(const e of [...r.evidence,...r.ratings.map(x=>x.evidence)]){
 const q=e.cell!.match(/^extracted-text:chars:(\d+)-(\d+)$/)!;assert.equal(input.text.slice(Number(q[1]),Number(q[2])),e.rawText);assert.equal(e.sha256,input.sourceSha256);}
 assert.equal(extractChikushino({...input,truncated:true}).length,7);
 assert.deepEqual(extractChikushino({...input,municipalityCode:'00000'}),[]);
 const text=input.text.slice(0,input.text.indexOf('№２')).replaceAll('検討方針','未記載');
 assert.deepEqual(extractChikushino({...input,text}),[]);
});
