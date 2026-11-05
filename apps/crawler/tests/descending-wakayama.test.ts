import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewWakayama} from '../src/evaluations/expansion/descending-wakayama';
import {wakayamaRows} from '../src/evaluations/expansion/descending-wakayama-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}

const configs=wakayamaRows as Array<{sourceId:string;municipalityCode:string;pageId?:string;rows:unknown[]}>;
const inputs=configs.map(c=>source(c.sourceId,c.municipalityCode));
for(const c of configs)if(c.pageId&&!inputs.some(i=>i.sourceId===c.pageId))inputs.push(source(c.pageId,c.municipalityCode));
const run=(id:string)=>reviewWakayama(inputs.find(i=>i.sourceId===id)!,inputs)!;
test('Wakayama proposals require full pinned bodies and literal evidence; no invented numeric fields',()=>{
 let count=0;
 for(const c of configs){const i=inputs.find(i=>i.sourceId===c.sourceId)!;const r=run(c.sourceId);assert.equal(r.projects.length,c.rows.length);count+=r.projects.length;
 for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.equal(p.indicators.length,0);for(const e of p.evidence){const src=inputs.find(x=>x.sourceUrl===e.sourceUrl)!;const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}
 for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'}])assert.equal(reviewWakayama(bad,inputs)!.projects.length,0);
 }assert.equal(count,95);
});

test('Taiji keeps multiyear fiscal period unknown and uses explicit post-evaluation date',()=>{const ps=run('e469190c5fba262ce6d889bd').projects;assert.equal(ps.length,1);assert.equal(ps[0].evaluatedFiscalYear,null);assert.equal(ps[0].evaluationYear,2023);assert.equal(ps[0].projectName,'都市防災総合推進事業（森浦地区）');});
test('Nachi separates demonstration from standalone delivery and never copies neighbouring KPI scores',()=>{for(const [id,year]of [['f95588cb720ca12c9c4e976b',2024],['30948c054dea18ca8a9e3908',2025]]as const){const ps=run(id).projects;assert.equal(ps.length,4);assert.ok(ps.every(p=>p.evaluatedFiscalYear===year));assert.ok(!ps.some(p=>p.projectName==='重層的支援体制整備事業'));const c=ps.find(p=>p.projectName.includes('C型'))!;assert.ok(c.evidence.some(e=>e.rawText?.includes('デモン')));assert.equal(c.ratings.length,0);}});
test('Kamitonda only selects literal individual annual businesses; Minabe donation values never become costs',()=>{const k=run('be962b7ee2fde1aacce245c1').projects;assert.equal(k.length,25);assert.ok(k.every(p=>p.evaluatedFiscalYear===2024));assert.ok(!k.some(p=>p.projectName==='学校運営'||p.projectName==='熊野高校'));for(const [id,year]of [['7ebf54218a0e6cf98ba2d467',2022],['d801563bad4c8da014a14f23',2023],['7f4562ebd29b9a39e37d752f',2024]]as const){const ps=run(id).projects;assert.equal(ps.length,1);assert.equal(ps[0].evaluatedFiscalYear,year);assert.equal(ps[0].amounts.length,0);}});
test('Minabe preserves explicit assessment names without promoting policy labels or correcting uncertain source titles',()=>{const r=run('0a955dc3b57ff4f7a5f052dc');assert.equal(r.projects.length,52);assert.ok(r.projects.every(p=>p.evaluatedFiscalYear===2024));assert.ok(!r.projects.some(p=>p.projectName==='農業振興施策'||p.projectName.includes('児童クラブ')));assert.equal(r.units.filter(x=>x.status==='identity_or_period_hold').length,1);});
