import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import{extractKomagane}from'../src/evaluations/expansion/komagane';
import type{CachedInput}from'../src/evaluations/expansion/shared';
function input(sourceId:string):CachedInput{const d=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${sourceId}.json`,import.meta.url),'utf8'));return{municipalityCode:'20210',municipalityName:'駒ヶ根市',sourceId,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-10-12T00:00:00Z',format:'pdf',text:d.text,truncated:d.truncated};}
test('Komagane preserves council project opinions and excludes policy/account-wide subjects',()=>{
 const older=input('5952d6117c1aaa2c8eaafd44'),newer=input('f0eec45d1958763245b1921f');
 const a=extractKomagane(older),b=extractKomagane(newer);
 assert.equal(a.length,6);assert.equal(b.length,1);
 assert.equal(b[0].projectName,'子ども交流センター運営事業');
 assert.equal(a[0].ratings[0].value,'Ｄ');assert.equal(a[0].ratings[0].kind,'external');
 assert(!a.some(p=>p.projectName==='小・中学校教育管理事務事業'));
 assert([...a,...b].every(p=>p.amounts.length===0&&p.indicators.length===0&&p.evaluatedFiscalYear===null));
 assert(a.every(p=>!p.evidence[0].rawText.includes('Ⅵ 経過')));
 for(const [source,records]of[[older,a],[newer,b]]as const)for(const p of records)for(const e of [...p.evidence,...p.ratings.map(r=>r.evidence)]){const m=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(source.text.slice(Number(m[1]),Number(m[2])),e.rawText);}
});
test('Komagane rejects truncated sources and unrecognized identities',()=>{const a=input('5952d6117c1aaa2c8eaafd44');assert.deepEqual(extractKomagane({...a,truncated:true}),[]);assert.deepEqual(extractKomagane({...a,sourceId:'other'}),[]);});
