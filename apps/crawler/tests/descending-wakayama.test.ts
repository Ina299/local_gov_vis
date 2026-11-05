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
 }assert.equal(count,1963);
});

test('Taiji keeps multiyear fiscal period unknown and uses explicit post-evaluation date',()=>{const ps=run('e469190c5fba262ce6d889bd').projects;assert.equal(ps.length,1);assert.equal(ps[0].evaluatedFiscalYear,null);assert.equal(ps[0].evaluationYear,2023);assert.equal(ps[0].projectName,'都市防災総合推進事業（森浦地区）');});
test('Nachi separates demonstration from standalone delivery and never copies neighbouring KPI scores',()=>{for(const [id,year]of [['f95588cb720ca12c9c4e976b',2024],['30948c054dea18ca8a9e3908',2025]]as const){const ps=run(id).projects;assert.equal(ps.length,4);assert.ok(ps.every(p=>p.evaluatedFiscalYear===year));assert.ok(!ps.some(p=>p.projectName==='重層的支援体制整備事業'));const c=ps.find(p=>p.projectName.includes('C型'))!;assert.ok(c.evidence.some(e=>e.rawText?.includes('デモン')));assert.equal(c.ratings.length,0);}});
test('Kamitonda only selects literal individual annual businesses; Minabe donation values never become costs',()=>{const k=run('be962b7ee2fde1aacce245c1').projects;assert.equal(k.length,25);assert.ok(k.every(p=>p.evaluatedFiscalYear===2024));assert.ok(!k.some(p=>p.projectName==='学校運営'||p.projectName==='熊野高校'));for(const [id,year]of [['7ebf54218a0e6cf98ba2d467',2022],['d801563bad4c8da014a14f23',2023],['7f4562ebd29b9a39e37d752f',2024]]as const){const ps=run(id).projects;assert.equal(ps.length,1);assert.equal(ps[0].evaluatedFiscalYear,year);assert.equal(ps[0].amounts.length,0);}});
test('Minabe preserves explicit assessment names without promoting policy labels or correcting uncertain source titles',()=>{const r=run('0a955dc3b57ff4f7a5f052dc');assert.equal(r.projects.length,52);assert.ok(r.projects.every(p=>p.evaluatedFiscalYear===2024));assert.ok(!r.projects.some(p=>p.projectName==='農業振興施策'||p.projectName.includes('児童クラブ')));assert.equal(r.units.filter(x=>x.status==='identity_or_period_hold').length,1);});

test('Minabe grant years retain exact official prior-year context and reject changed context offsets',()=>{
 const id='66732ce32d96c7ed3b77f945';const i=inputs.find(x=>x.sourceId===id)!;const ps=run(id).projects;assert.equal(ps.length,3);
 for(const p of ps){assert.equal(p.evaluatedFiscalYear,2016);assert.equal(p.evaluationYear,2017);assert.ok(p.evidence.some(e=>e.rawText?.includes('平成29年度効果検証')&&e.rawText.includes('前年度')));}
 assert.equal(reviewWakayama(i,inputs.filter(x=>x.sourceId!=='9b158c2bd70e074294b50996'))!.projects.length,0);
 const c=wakayamaRows.find(x=>x.sourceId===id)! as {pageYearContextStart:number};const saved=c.pageYearContextStart;
 try{c.pageYearContextStart=saved+1;assert.equal(run(id).status,'annual_identity_hold');assert.equal(run(id).projects.length,0);}finally{c.pageYearContextStart=saved;}
});
test('Shirahama row dates override cover year and administrative funding is not a separate business',()=>{
 const ps=run('eeea4a05cdb050792ff40c05').projects;assert.equal(ps.length,10);assert.equal(ps.filter(p=>p.evaluatedFiscalYear===2022).length,2);
 const later=run('0a4b8efd48ed540838513c8e').projects;assert.equal(later.length,1);assert.equal(later[0].evaluatedFiscalYear,2025);assert.equal(later[0].projectName,'物価高騰対策観光誘客等事業');
 assert.equal(run('f62820c72342571a37c83bb4').projects.length,0);
});

test('Kudoyama repeated title prefixes bind distinct sheets and carryover funding never replaces explicit dates',()=>{
 const ps=run('506df98d0f1bb6a9d5329fc9').projects;assert.equal(ps.length,54);assert.equal(new Set(ps.map(p=>p.id)).size,54);
 assert.ok(ps.some(p=>p.projectName==='遠隔・オンライン学習の環境整備事業'));
 assert.ok(ps.some(p=>p.projectName==='遠隔・オンライン学習の環境整備、GIGAスクール構想への支援事業'));
 assert.equal(ps.find(p=>p.projectName==='地域防災計画改訂業務')!.evaluatedFiscalYear,2021);
 assert.ok(!ps.some(p=>p.projectName==='防災備蓄倉庫建設事業'));
});
test('Kimino uses46 complete named assessments without inventing the aggregate47th; Koya retains nonexecution and subsidy context',()=>{
 const k=run('6dd3e323e7a70b5d69dac11d');assert.equal(k.projects.length,46);assert.ok(k.projects.every(p=>p.evaluatedFiscalYear===2018&&p.evaluationYear===2019));assert.ok(k.units.some(u=>u.status==='identity_or_period_hold'));
 const ps=run('1dbf0b3a93e3a810ec2b4758').projects;assert.equal(ps.length,10);assert.ok(ps.find(p=>p.projectName==='歴史的まちなみ整備事業')!.evidence.some(e=>e.rawText?.includes('事業主体：（宗）金剛峯寺')));
});
test('Gobo rejects unresolved anniversary-year conflicts and resolves displaced headers only at exact saved positions',()=>{
 const ps=run('60d72a16f7ea392161605e17').projects;assert.equal(ps.length,120);assert.ok(!ps.some(p=>p.projectName==='NHK「のど自慢」'));assert.ok(ps.some(p=>p.projectName.includes('【繰越】住民税均等割のみ')));
 const old=run('c8fb9e713808ff1660f50c2c').projects;assert.equal(old.length,131);assert.ok(old.some(p=>p.projectName==='一時保育事業'));assert.ok(old.every(p=>!['年','前','決算額','事業内容'].includes(p.projectName)));
});
test('Arida continuation-backed annual activities exclude internal financing and same-name components',()=>{
 for(const [id,year,count]of [['39c803206cde4f1dde77d09c',2025,229],['66e4e0b41e364b58ca0f3bd2',2021,236]]as const){const i=inputs.find(x=>x.sourceId===id)!;assert.ok(i.text.length>120000);const ps=run(id).projects;assert.equal(ps.length,count);assert.equal(new Set(ps.map(p=>p.projectName)).size,count);assert.ok(ps.every(p=>p.evaluatedFiscalYear===year&&!/積立|繰出|償還|利子支払|予備費|事業人件費/.test(p.projectName)));assert.equal(reviewWakayama({...i,text:i.text.slice(0,120000)},inputs)!.projects.length,0);}
});
