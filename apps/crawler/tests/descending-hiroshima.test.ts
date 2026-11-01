import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewHiroshima} from '../src/evaluations/expansion/descending-hiroshima';
import {hiroshimaRows} from '../src/evaluations/expansion/descending-hiroshima-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}

test('Hiroshima reviewed rows bind full source identity, complete body, exact quotes and explicit years',()=>{
 for(const c of hiroshimaRows){const i=source(c.sourceId,c.municipalityCode),r=reviewHiroshima(i)!;assert.equal(r.projects.length,c.rows.length);assert.equal(new Set(r.projects.map(p=>p.id)).size,r.projects.length);for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.equal(p.indicators.length,0);for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}}for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'}])assert.equal(reviewHiroshima(bad)!.projects.length,0);assert.equal(reviewHiroshima({...i,municipalityCode:'99999'}),null);}
});

test('Kitahiroshima continues beyond the first asset and uses sheet133 actual title, not its policy header',()=>{const ps=reviewHiroshima(source('5565c33146172695cb5c5757','34369'))!.projects;assert.equal(ps.length,140);assert.ok(ps.some(p=>p.projectName==='入札制度電子化推進事業'));assert.ok(!ps.some(p=>p.projectName==='Ⅴ＿住民のための行財政運営'));assert.ok(ps.every(p=>p.evaluatedFiscalYear===2024));});
test('Sera separates taxi service aliases from existing expansion projects without rewriting earlier values',()=>{for(const id of ['e437868f5e87946c1f215df9','7ddaf70925bf3dbcd1deee78','b2404f08720894e2616e58c6'])assert.ok(!reviewHiroshima(source(id,'34462'))!.projects.some(p=>p.projectName==='せらまちタクシー'));});
test('Saka identifies the target year and concrete annual activities, never chapter labels or regex fragments',()=>{const ps=reviewHiroshima(source('7d13b86ebfc55a173ca30e38','34309'))!.projects;assert.ok(ps.length>0);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2019&&p.evaluationYear===null));for(const c of hiroshimaRows.filter(c=>c.municipalityCode==='34309'))assert.ok(!reviewHiroshima(source(c.sourceId,c.municipalityCode))!.projects.some(p=>['英語で教室','生涯スポーツの推進','計画的な事業'].includes(p.projectName)));});
test('Reviewed navigation and policy outlines produce no business rows',()=>{for(const c of hiroshimaRows.filter(c=>c.rows.length===0))assert.equal(reviewHiroshima(source(c.sourceId,c.municipalityCode))!.projects.length,0);});

test('Onomichi implementation rows exclude future school-support plans, third-party activities and financing aliases',()=>{
 for(const [id,year,count] of [['48be9ad3aad229f15735beb3',2023,9],['097054f0189853a027f9fb02',2024,7],['249f56389f65298e60bf6d47',2025,7]] as const){
  const ps=reviewHiroshima(source(id,'34205'))!.projects;
  assert.equal(ps.length,count);assert.ok(ps.every(p=>p.evaluatedFiscalYear===year&&p.evaluationYear===null));
  assert.ok(ps.some(p=>p.projectName==='特別教室等空調設備事業の推進'));
  assert.ok(!ps.some(p=>['子どもの居場所づくり事業','校内教育支援センター推進事業','文化財愛護少年団事業'].includes(p.projectName)));
  if(year===2024)assert.ok(!ps.some(p=>p.projectName==='日本遺産ゲートウェイ機能強化事業'));
 }
});
test('Fuchu same-name ICT units remain held; Miyoshi recommendations do not invent a target fiscal year',()=>{
 const f=reviewHiroshima(source('49c4562787f48283d4c44c26','34208'))!;
 assert.equal(f.projects.length,14);assert.ok(!f.projects.some(p=>p.projectName.includes('ICT')));
 const ps=reviewHiroshima(source('4b2559af3ca2033540caa856','34209'))!.projects;
 assert.equal(ps.length,8);assert.ok(ps.every(p=>p.evaluationYear===2024&&p.evaluatedFiscalYear===null));
});
