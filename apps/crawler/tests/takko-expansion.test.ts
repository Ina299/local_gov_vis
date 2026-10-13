import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractTakko} from '../src/evaluations/expansion/takko';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('municipalities/02443.json',root),'utf8'));
const s=m.sources.find((x:{id:string})=>x.id==='a5546e8b4ace5a2dc60ad473');
const d=JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));
const input:CachedInput={municipalityCode:'02443',municipalityName:'田子町',sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf',text:d.text,truncated:d.truncated};
test('Takko only 43 numbered complete individual sheets, not overview/adviser narratives',()=>{
 const rows=extractTakko(input);assert.equal(rows.length,43);assert.equal(new Set(rows.map(r=>r.id)).size,43);
 assert.equal(rows[0].projectName,'学校評議員事業');assert.equal(rows.at(-1)!.projectName,'給食センター改修等事業');
 assert.ok(rows.every(r=>r.evaluatedFiscalYear===2024&&r.evaluationYear===2025));
 assert.ok(rows.every(r=>r.amounts.length===0&&r.indicators.length===0&&r.ratings.length===1&&r.ratings[0].kind==='self'));
 assert.equal(rows[0].ratings[0].value,'○');assert.equal(rows[1].ratings[0].value,'◎');
 assert.ok(!rows.at(-1)!.evidence[0].rawText.includes('◆ 教育委員会活動'));
});
test('Takko literal evidence resolves and partial project sheet is rejected',()=>{
 for(const r of extractTakko(input))for(const ev of [...r.evidence,...r.ratings.map(x=>x.evidence)]){
 const q=ev.cell!.match(/^extracted-text:chars:(\d+)-(\d+)$/)!;assert.equal(input.text.slice(Number(q[1]),Number(q[2])),ev.rawText);assert.equal(ev.sha256,input.sourceSha256);}
 assert.deepEqual(extractTakko({...input,municipalityCode:'05346'}),[]);
 const cut=input.text.slice(0,input.text.indexOf('事業名 43')+20);
 assert.equal(extractTakko({...input,text:cut,truncated:true}).length,42);
});
