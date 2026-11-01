import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewTokushima} from '../src/evaluations/expansion/descending-tokushima';
import {tokushimaRows} from '../src/evaluations/expansion/descending-tokushima-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}
test('Tokushima literal review fails closed on source/hash/body changes and preserves exact evidence',()=>{
 for(const c of tokushimaRows){const i=source(c.sourceId,c.municipalityCode),inputs:CachedInput[]=c.pageId?[source(c.pageId,c.municipalityCode)]:[],r=reviewTokushima(i,inputs)!;for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.indicators.length,0);assert.equal(p.ratings.length,0);for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;const src=[i,...inputs].find(x=>x.sourceUrl===e.sourceUrl)!;assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'}])assert.equal(reviewTokushima(bad,inputs)!.projects.length,0);assert.equal(reviewTokushima({...i,municipalityCode:'99999'}),null);}
});


test('Yoshinogawa planned evaluations keep evaluation year separate from future implementation years',()=>{const ps=reviewTokushima(source('6575a0e0a713265cb847bf8f','36205'))!.projects;assert.equal(ps.length,59);assert.ok(ps.every(p=>p.evaluationYear===2025&&p.evaluatedFiscalYear===null));assert.ok(ps.some(p=>p.projectName.includes('R8募集、R9実施')));assert.ok(ps.every(p=>p.amounts.length===0&&p.ratings.length===0));});
test('Yoshinogawa wrapped titles exclude intervening description text and preserve source fragments',()=>{const ps=reviewTokushima(source('f8a31eff134f5b629c719509','36205'))!.projects;assert.equal(ps.length,198);assert.ok(ps.some(p=>p.projectName==='高齢者の保健事業と介護予防等の一体的実施'));assert.ok(ps.every(p=>p.evaluatedFiscalYear===2024&&p.evaluationYear===null));});
test('Komatsushima uses complete validated continuations and rejects initial-only text',()=>{const i=source('7d1cc95ee4fd0bce701d6dba','36203');assert.ok(i.text.length>400000);assert.equal(reviewTokushima(i)!.projects.length,233);assert.equal(reviewTokushima({...i,text:i.text.slice(0,120000)})!.projects.length,0);});
test('Katsuura intermediate table has explicit target year and does not create policy KPI projects',()=>{const ps=reviewTokushima(source('63994b5982ef4ca51cfd3a45','36301'))!.projects;assert.equal(ps.length,86);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2023&&p.indicators.length===0));});

test('Reviewed title rows have unique offsets and Kitajima grant and support contract use separate title columns',()=>{for(const c of tokushimaRows)assert.equal(new Set(c.rows.map(r=>r.start)).size,c.rows.length);const ps=reviewTokushima(source('ee5e5810b1056c9b6fc57b32','36402'))!.projects;const selected=ps.filter(p=>p.projectName.startsWith('北島町重点対策'));assert.equal(selected.length,2);assert.notEqual(selected[0].id,selected[1].id);assert.ok(selected.every(p=>p.evidence[0].rawText.startsWith('北 島 町')));});
test('Yoshinogawa short debt-collection title does not cite the individual-tax title prefix',()=>{const ps=reviewTokushima(source('f8a31eff134f5b629c719509','36205'))!.projects;const p=ps.find(p=>p.projectName==='未収金対策')!;assert.ok(p.evidence.some(e=>e.rawText.includes('住宅新築資金等貸付事業')));assert.notEqual(p.id,ps.find(p=>p.projectName==='未収金対策事業（個人市民税）')!.id);});
test('Minami accepts explicit assessment variants and bounded multiline fee headers without assigning carryovers or revenues',()=>{const ps=reviewTokushima(source('9de68dc3f1561c15e6d850ed','36387'))!.projects;assert.equal(ps.length,22);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2022&&p.evaluationYear===2023&&p.amounts.length===0));assert.ok(ps.some(p=>p.projectName==='育英奨学金貸付事業'));assert.ok(ps.some(p=>p.projectName.startsWith('日和佐中学校費／')));assert.ok(ps.some(p=>p.projectName==='海洋センター費'));});
