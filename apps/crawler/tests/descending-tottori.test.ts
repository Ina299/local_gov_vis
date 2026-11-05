import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewTottori} from '../src/evaluations/expansion/descending-tottori';
import {tottoriRows} from '../src/evaluations/expansion/descending-tottori-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}

const configs=tottoriRows as Array<{sourceId:string;municipalityCode:string;pageId?:string;rows:unknown[]}>;
const inputs=configs.map(c=>source(c.sourceId,c.municipalityCode));
for(const c of configs)if(c.pageId&&!inputs.some(i=>i.sourceId===c.pageId))inputs.push(source(c.pageId,c.municipalityCode));
const run=(id:string)=>reviewTottori(inputs.find(i=>i.sourceId===id)!,inputs)!;
test('Tottori proposals require full pinned bodies and literal evidence; no invented numeric fields',()=>{
 let count=0;
 for(const c of configs){const i=inputs.find(i=>i.sourceId===c.sourceId)!;const r=run(c.sourceId);assert.equal(r.projects.length,c.rows.length);count+=r.projects.length;
 for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.equal(p.indicators.length,0);for(const e of p.evidence){const src=inputs.find(x=>x.sourceUrl===e.sourceUrl)!;const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}
 for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'}])assert.equal(reviewTottori(bad,inputs)!.projects.length,0);
 }assert.equal(count,234);
});
test('Kofu requires official annual link identity; Daisen keeps fiscal year unknown',()=>{
 const i=inputs.find(x=>x.sourceId==='2bab04fffc69909151f760ca')!;
 assert.equal(reviewTottori(i)!.status,'annual_identity_hold');
 assert.ok(run(i.sourceId).projects.every(p=>p.evaluatedFiscalYear===2020));
 assert.ok(run('76526b41adb250351b6efc67').projects.every(p=>p.evaluatedFiscalYear===null&&p.evaluationYear===2021));
});
test('Hiezu and Wakasa distinguish report dates from target years and do not split grouped budgets',()=>{
 const h=run('fbfd32e68a167c9c43d2298c').projects;assert.equal(h.length,35);assert.ok(h.every(p=>p.evaluatedFiscalYear===2024&&p.evaluationYear===2025));
 const w=run('e2285bc27c5e3a125f7bf646').projects;assert.equal(w.length,23);assert.ok(w.every(p=>p.evaluatedFiscalYear===2023&&p.evaluationYear===2024));
 assert.equal(w.filter(p=>p.projectName.includes('自主防災組織')).length,1);
});
