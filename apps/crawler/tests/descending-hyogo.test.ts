import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewHyogo} from '../src/evaluations/expansion/descending-hyogo';
import {hyogoRows} from '../src/evaluations/expansion/descending-hyogo-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}

const configs=hyogoRows as Array<{sourceId:string;municipalityCode:string;pageId?:string;rows:unknown[]}>;
const inputs=configs.map(c=>source(c.sourceId,c.municipalityCode));
for(const c of configs)if(c.pageId&&!inputs.some(i=>i.sourceId===c.pageId))inputs.push(source(c.pageId,c.municipalityCode));
const run=(id:string)=>reviewHyogo(inputs.find(i=>i.sourceId===id)!,inputs)!;
test('Hyogo proposals require full pinned bodies and literal evidence; no invented numeric fields',()=>{
 let count=0;
 for(const c of configs){const i=inputs.find(i=>i.sourceId===c.sourceId)!;const r=run(c.sourceId);assert.equal(r.projects.length,c.rows.length);count+=r.projects.length;
 for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.equal(p.indicators.length,0);for(const e of p.evidence){const src=inputs.find(x=>x.sourceUrl===e.sourceUrl)!;const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}
 for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'}])assert.equal(reviewHyogo(bad,inputs)!.projects.length,0);
 }assert.equal(count,1858);
});



test('Inami complete annual sheets exclude next-year wholly carried-over projects',()=>{
 const ps=run('5ab9e8fdc9ee5aee927abad4').projects;assert.equal(ps.length,78);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2024&&p.evaluationYear===null));
 for(const n of ['稲美北東部地区整備計画等策定事業','稲美中央公園全体構想策定事業','中学校エレベーター設置（実施設計）事業','いなみ野体育センター空調設備基礎調査事業'])assert.ok(!ps.some(p=>p.projectName===n));
 assert.ok(ps.some(p=>p.projectName==='重度障害者医療費助成・高齢重度障害者医療費助成事業'));assert.ok(ps.some(p=>p.projectName==='住民税非課税世帯等に対する臨時特別給付金給付事業'));assert.ok(!ps.some(p=>p.projectName.includes('担当課')));
});
for(const [sid,year,report,count]of [['4bad4f3ba197da937016a6b6',2007,2008,111],['01158a23769d3c9a13f766b0',2010,2011,107],['478fffb21426ff6ed1ab23d2',2011,2012,96],['5f2c88c7936da920a44d4983',2012,2013,105]]as const)test(`Inagawa ${year} explicit target/report years and complete names only`,()=>{
 const ps=run(sid).projects;assert.equal(ps.length,count);assert.ok(ps.every(p=>p.evaluatedFiscalYear===year&&p.evaluationYear===report));assert.equal(new Set(ps.map(p=>p.projectName.normalize('NFKC').replace(/\s+/g,''))).size,count);
 assert.ok(!ps.some(p=>['り事業','業','ト事業','本町対岸遺跡及び大坂口番所推定地詳','（再掲）'].includes(p.projectName)));assert.ok(ps.every(p=>p.projectCode===null&&p.department===null));
});
test('Sasayama list identities do not inherit policy grades or invent carryover/year associations',()=>{
 for(const [sid,year,count]of [['90572ac34172e092a07cf972',2017,160],['3e2156f671a70a8fdecfde82',2018,171],['eb4a71343dcae9331ff18190',2016,174],['e3878ade2f60c5c03a968b0d',2015,26],['c32aaab46573f93e222931e3',2014,62]]as const){
  const ps=run(sid).projects;assert.equal(ps.length,count);assert.ok(ps.every(p=>p.evaluatedFiscalYear===year&&p.warnings.some(w=>w.includes('List-level identity'))));assert.ok(ps.every(p=>!p.projectName.includes('繰越')&&!/\d,\d/.test(p.projectName)));
  assert.ok(!ps.some(p=>['下水道事業','市単独事業','事業名','事業コード','地域支援事業償還金','高額医療費共同事業拠出金','県営土地改良事業'].includes(p.projectName)));if(year<2017)assert.ok(ps.every(p=>p.evaluationYear===null));
 }
});
test('Awaji budget related materials and joint cross-year grants remain outside evaluation candidates',()=>{
 for(const id of ['f6ccf980b9afe5dc9e7e7721','d01430eaa02afdc1bfc0df18','a6b5f27b09a38a95f6676b0f','29d969ee5bf4fd4184f5e0ec','efb6a2b57bb7def5b4c8241f'])assert.ok(!configs.some(c=>c.sourceId===id));
});
for(const [sid,year,count]of [['2f361c684fbe2856437d9689',2011,201],['6173941d80f4f6da1b453e54',2010,207],['b8285a353df66a1b3da8cf7a',2009,211],['ac5332c108d6aa6f063dfe6c',2008,3]]as const)test(`Sasayama ${year} complete annual names reject fragment and numeric-column inference`,()=>{
 const ps=run(sid).projects;assert.equal(ps.length,count);assert.ok(ps.every(p=>p.evaluatedFiscalYear===year&&p.evaluationYear===null));assert.equal(new Set(ps.map(p=>p.projectName.normalize('NFKC').replace(/\s+/g,''))).size,count);
 assert.ok(!ps.some(p=>['備補助金事務事業','制事業','金事業','事業','負担軽減事業','助事業','事務事業','局事業','理事業','ト」事業','助成事業','会事業','援協議会事業','支援事業','研究事業','各助成金事業','各負担金事業','県営土地改良事業'].includes(p.projectName)));
});
test('Sasayama FY2007 keeps wrapped title qualifiers and rejects descriptions posing as titles',()=>{
 const ps=run('f54a43aebbed7ce3b3271439').projects;assert.equal(ps.length,94);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2007&&p.evaluationYear===2008));
 for(const n of ['放課後児童対策事業（民営）','食文化センター事業（各種料理教室）','こんだ薬師温泉施設運営事業','本庁舎・第2庁舎管理事務','篠山体育振興会事務局事務','災害情報の収集･管理業務'])assert.ok(ps.some(p=>p.projectName===n));
 for(const n of ['放課後児童対策事業','こんだ薬師温泉施設運営支援','本庁舎・第2庁舎の維持管理','選挙管理委員会事務','紀支部支援事業','ラザ施設管理'])assert.ok(!ps.some(p=>p.projectName===n));
});

for(const [sid,fy,count]of [['6d11a627e95289515c8c7c93',2012,16],['99bb5bc168629657e8c4b220',2013,36]]as const)test(`Sasayama coverage supplement ${fy} preserves explicit targetperiod and omits ambiguous outcomes`,()=>{const ps=run(sid).projects;assert.equal(ps.length,count);assert.ok(ps.every(p=>p.evaluatedFiscalYear===fy&&p.evaluationYear===null&&p.warnings.some(w=>w.includes('Coverage supplement'))));});
