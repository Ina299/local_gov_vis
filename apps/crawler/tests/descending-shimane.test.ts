import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewShimane} from '../src/evaluations/expansion/descending-shimane';
import {shimaneRows} from '../src/evaluations/expansion/descending-shimane-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}

const configs=shimaneRows as Array<{sourceId:string;municipalityCode:string;pageId?:string;rows:unknown[]}>;
const inputs=configs.map(c=>source(c.sourceId,c.municipalityCode));
for(const c of configs)if(c.pageId&&!inputs.some(i=>i.sourceId===c.pageId))inputs.push(source(c.pageId,c.municipalityCode));
const run=(id:string)=>reviewShimane(inputs.find(i=>i.sourceId===id)!,inputs)!;
test('Shimane proposals require full pinned bodies and literal evidence; no invented numeric fields',()=>{
 let count=0;
 for(const c of configs){const i=inputs.find(i=>i.sourceId===c.sourceId)!;const r=run(c.sourceId);assert.equal(r.projects.length,c.rows.length);count+=r.projects.length;
 for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.equal(p.indicators.length,0);for(const e of p.evidence){const src=inputs.find(x=>x.sourceUrl===e.sourceUrl)!;const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}
 for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'}])assert.equal(reviewShimane(bad,inputs)!.projects.length,0);
 }assert.equal(count,334);
});
test('Mixed-year Iinan book uses verified official evaluation page without assuming a fiscal year',()=>{
 const id='f3f9f900ab3b50634631214a';const i=inputs.find(x=>x.sourceId===id)!;
 assert.equal(reviewShimane(i)!.status,'annual_identity_hold');assert.equal(run(id).projects.length,17);
 assert.ok(run(id).projects.every(p=>p.evaluatedFiscalYear===null&&p.evaluationYear===2026));
 const bad=inputs.map(p=>p.sourceId==='ceb7a8e3630c09fcffc3f4a1'?{...p,sourceSha256:'wrong'}:p);assert.equal(reviewShimane(i,bad)!.projects.length,0);
});
test('Misato excludes policy slots and abolished activities; Gotsu retains complete continuation',()=>{
 const ps=run('3f2b6fcf3876449059f620cf').projects;assert.equal(ps.length,36);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2015));
 assert.ok(!ps.some(p=>p.projectName.includes('子ども会育成会')||p.projectName.includes('エアコン')));
 const g=run('e37ea0e383fc3735ffce1b2e').projects;assert.equal(g.length,143);assert.ok(g.some(p=>p.evidence.some(e=>Number(e.cell?.match(/chars:(\d+)/)?.[1])>120000)));
 assert.ok(g.every(p=>p.evaluatedFiscalYear===2024));
});
test('Izumo missing vertical header and Matsue nonstandard headers retain explicit fiscal years',()=>{
 const iz=run('fe9056720cb4cd8e1762108b').projects;assert.equal(iz.length,1);assert.ok(iz[0].projectName.startsWith('不登校対策事業'));assert.equal(iz[0].evaluatedFiscalYear,2022);
 assert.equal(run('6ab5323cc6d3469b3d8ea012').projects.length,2);assert.equal(run('d24a0538bf9608d515cbf1b0').projects.length,33);
});
