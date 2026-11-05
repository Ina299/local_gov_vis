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
 }assert.equal(count,683);
});
test('Kofu requires official annual link identity; Daisen keeps fiscal year unknown',()=>{
 const i=inputs.find(x=>x.sourceId==='2bab04fffc69909151f760ca')!;
 assert.equal(reviewTottori(i)!.status,'annual_identity_hold');
 assert.ok(run(i.sourceId).projects.every(p=>p.evaluatedFiscalYear===2020));
 assert.ok(run('76526b41adb250351b6efc67').projects.every(p=>p.evaluatedFiscalYear===null&&p.evaluationYear===2021));
});
test('Hiezu and Wakasa distinguish report dates from target years and do not split grouped budgets',()=>{
 const h=run('fbfd32e68a167c9c43d2298c').projects;assert.equal(h.length,35);assert.ok(h.every(p=>p.evaluatedFiscalYear===2024&&p.evaluationYear===2025));
 const w=run('e2285bc27c5e3a125f7bf646').projects;assert.equal(w.length,24);assert.ok(w.every(p=>p.evaluatedFiscalYear===2023&&p.evaluationYear===2024));
 assert.equal(w.filter(p=>p.projectName.includes('自主防災組織')).length,1);
});

test('Kurayoshi individual implementation names retain target years without copying policy scores or amount columns',()=>{
 for(const [id,fy] of [['044b2c58791a59d43c1b5447',2023],['387c1f1cd49e410eafccfccc',2024],['bbda72c27eaf57389f5fbb9e',2022]] as const){const ps=run(id).projects;assert.ok(ps.length>25);assert.ok(ps.every(p=>p.evaluatedFiscalYear===fy));assert.ok(!ps.some(p=>p.projectName==='水道事業'||p.projectName==='県道改良事業'||p.projectName.includes('PDCA')));}
});
test('Health report date is distinct from assessed year; policy-name mentions never invent target periods',()=>{
 const ps=run('8201ce88da3d08f451e55c33').projects;assert.equal(ps.length,5);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2022&&p.evaluationYear===2024));
 const unknown=run('6fb61a81fa10754a7b1c46f2').projects.find(p=>p.projectName==='生活保護受給者就労支援事業')!;assert.equal(unknown.evaluatedFiscalYear,null);assert.equal(unknown.evaluationYear,null);
 const known=run('6fb61a81fa10754a7b1c46f2').projects.find(p=>p.projectName==='介護給付適正化事業')!;assert.equal(known.evaluatedFiscalYear,2024);
});

test('Tottori wrapped rows keep literal title fragments, excluding nonexecution, carryover and a proven alias',()=>{
 const ids=['a4798ca1a298a0f8fcef17ef','fd8f8cb63aec7733effa501e'];
 const all=ids.flatMap(id=>run(id).projects);
 assert.ok(!all.some(p=>p.projectName==='中山間地域を支える水田農業支援事業補助金'||p.projectName==='林業・木材産業強化総合対策事業費'||p.projectName==='介護給付等費用適正化事業費（事業運営費）'));
 assert.ok(all.length>10);assert.ok(all.every(p=>p.evaluatedFiscalYear===2024));
});
test('Daisen composite identities retain independent explanation names, target fiscal year and excluded rows',()=>{
 const r=run('cbf1084567037b6e4e4b44a6');assert.equal(r.projects.length,146);
 assert.ok(r.projects.some(p=>p.projectName==='こどもと楽しいまちプロジェクト事業【説明名称：こどもと楽しいまちプロジェクト委託料】'));
 assert.ok(r.projects.some(p=>p.projectName==='こどもと楽しいまちプロジェクト事業【説明名称：こどもと楽しいまちプロジェクト事業補助金】'));
 assert.ok(r.projects.every(p=>p.evaluatedFiscalYear===2020&&p.evaluationYear===2021));
 assert.equal(r.units.filter(u=>u.status==='not_evaluation_target').length,21);
 assert.equal(r.units.filter(u=>u.status==='account_identity_hold').length,1);
 assert.ok(!r.projects.some(p=>p.projectName.includes('小さな拠点促進支援')));
});
test('Daisen composed names reject altered fragment positions, synthetic names and overlapping proof',()=>{
 const c=tottoriRows.find(c=>c.sourceId==='cbf1084567037b6e4e4b44a6')!;
 const row=c.rows.find(r=>'composedTitle' in r&&r.composedTitle?.descriptionSegments.length)!;
 assert.ok('composedTitle' in row&&row.composedTitle);const proof=row.composedTitle!;
 const savedName=row.name,savedStart=proof.baseSegments[0].start;
 try{row.name+='inferred';assert.throws(()=>run(c.sourceId),/composed title identity/);}finally{row.name=savedName;}
 try{proof.baseSegments[0].start++;assert.throws(()=>run(c.sourceId),/composed title evidence/);}finally{proof.baseSegments[0].start=savedStart;}
 const saved=[...proof.baseSegments];try{proof.baseSegments.push(proof.baseSegments[0]);assert.throws(()=>run(c.sourceId),/composed title identity/);}finally{proof.baseSegments.splice(0,proof.baseSegments.length,...saved);}
});
