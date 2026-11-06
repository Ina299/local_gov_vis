import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewOsaka} from '../src/evaluations/expansion/descending-osaka';
import {osakaRows} from '../src/evaluations/expansion/descending-osaka-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}

const configs=osakaRows as Array<{sourceId:string;municipalityCode:string;pageId?:string;rows:unknown[]}>;
const inputs=configs.map(c=>source(c.sourceId,c.municipalityCode));
for(const c of configs)if(c.pageId&&!inputs.some(i=>i.sourceId===c.pageId))inputs.push(source(c.pageId,c.municipalityCode));
const run=(id:string)=>reviewOsaka(inputs.find(i=>i.sourceId===id)!,inputs)!;
test('Osaka reviewed bodies require exact complete source identity and quote boundaries',()=>{
 let count=0;
 for(const c of configs){const i=inputs.find(i=>i.sourceId===c.sourceId)!;const r=run(c.sourceId);count+=r.projects.length;assert.equal(r.projects.length,c.rows.length);
 for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.equal(p.indicators.length,0);for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}}
 for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'},{...i,format:'xlsx' as const}])assert.equal(reviewOsaka(bad,inputs)!.projects.length,0);
 }assert.equal(count,55);
});
test('Kanan combines sports continuation sheets and excludes survey summaries and component activities',()=>{
 const r=run('a3a002ef083e6f4b17f780a2'),ps=r.projects;assert.equal(ps.length,50);assert.equal(new Set(ps.map(p=>p.projectName)).size,50);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2025&&p.evaluationYear===2026));
 assert.equal(ps.filter(p=>p.projectName==='生涯スポーツ推進事業').length,1);assert.equal(r.units.filter(u=>u.status==='duplicate_continuation').length,2);assert.equal(r.units.filter(u=>u.status==='identity_or_period_hold').length,2);
 for(const name of ['規律・規範意識の確立','学力・体力向上の取り組みの推進（「全国学力・学習状況調査」に関する結果）','しゅっぽっぽくらぶ（おやこ園）','かなんぴあプール一般開放','学校体育施設開放事業'])assert.ok(!ps.some(p=>p.projectName===name),name);
 for(const name of ['子育て支援センター事業','学校給食費無償化事業','子育て支援一時預かり事業（ぽけっとルーム）','国際化に向けた語学指導の充実（小学校）','国際化に向けた語学指導の充実（中学校）'])assert.ok(ps.some(p=>p.projectName===name),name);
});
test('Fujiidera annual designated-management services are not facility construction or invented scores',()=>{
 const codes=['97ff18da3e2cc26806b54fb9','e459737c07967c40ed87b873','60437b997164306f877fce79','e2265fcce6d30928387378b6','6145a80cc84d00c505e4583d'];const ps=codes.flatMap(id=>run(id).projects);assert.equal(ps.length,5);
 assert.ok(ps.every(p=>p.projectName.startsWith('藤井寺市立')&&p.projectName.endsWith('【説明名称：指定管理業務】')&&p.evaluatedFiscalYear===2025&&p.evaluationYear===null));
 for(const p of ps){assert.ok(p.evidence.some(e=>e.rawText==='指定管理業務'));assert.ok(p.evidence.some(e=>e.rawText===p.projectName.split('【')[0]));assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.equal(p.outcomes,null);}
});
