import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewEhime} from '../src/evaluations/expansion/descending-ehime';
import {ehimeRows} from '../src/evaluations/expansion/descending-ehime-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}
test('Ehime literal review fails closed on source/hash/body changes and preserves exact evidence',()=>{
 for(const c of ehimeRows){const i=source(c.sourceId,c.municipalityCode),inputs:CachedInput[]=[],r=reviewEhime(i,inputs)!;for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.indicators.length,0);assert.equal(p.ratings.length,0);for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;const src=[i,...inputs].find(x=>x.sourceUrl===e.sourceUrl)!;assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'}])assert.equal(reviewEhime(bad)!.projects.length,0);assert.equal(reviewEhime({...i,municipalityCode:'38205'}),null);}
});
test('Kuma execution-year evidence overrides the FY2020 funding heading for two complete sheets',()=>{const ps=reviewEhime(source('332b06da43ee53d13b56ba7f','38386'))!.projects;assert.equal(ps.length,39);assert.equal(ps.filter(p=>p.evaluatedFiscalYear===2021).length,2);assert.equal(ps.filter(p=>p.evaluatedFiscalYear===2020).length,37);assert.ok(!ps.some(p=>/サテライト|庁内テレワーク/.test(p.projectName)));});
test('Shikokuchuo continuation must reconstruct the complete text before acceptance',()=>{const i=source('f28a336a69ac389688b01c30','38213');assert.ok([...i.text].length>120000);assert.ok(reviewEhime(i)!.projects.length>0);assert.equal(reviewEhime({...i,text:[...i.text].slice(0,120000).join('')})!.projects.length,0);});
test('Uwajima combined district title is not split into additional district projects',()=>{const ps=reviewEhime(source('d9501d144da0a7dc3716437c','38203'))!.projects;assert.equal(ps.length,63);assert.ok(ps.some(p=>p.projectName==='結婚推進事業'));assert.ok(ps.some(p=>p.projectName.includes('吉田地区・三間地区')));assert.ok(!ps.some(p=>/^吉田地区学校給食/.test(p.projectName)));});
test('Page-number-only Uwajima cache cannot support any project',()=>{const r=reviewEhime(source('895296055a177d65ce4c4081','38203'))!;assert.equal(r.projects.length,0);assert.ok(r.units.length>0);});
test('Yawatahama split chapter and duplicate book do not repeat complete-book projects',()=>{for(const id of ['7a4af0315aa140e0cdde4beb','51f3e45921f0b1a8a4f0ed6f'])assert.equal(reviewEhime(source(id,'38204'))!.projects.length,0);assert.equal(reviewEhime(source('9f2be360e1ea30bc7c6141e1','38204'))!.projects.length,19);});
