import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewKyoto,distinctUjitawaraSchoolRows} from '../src/evaluations/expansion/descending-kyoto';
import {kyotoRows} from '../src/evaluations/expansion/descending-kyoto-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}

const configs=kyotoRows as Array<{sourceId:string;municipalityCode:string;pageId?:string;rows:unknown[]}>;
const inputs=configs.map(c=>source(c.sourceId,c.municipalityCode));
for(const c of configs)if(c.pageId&&!inputs.some(i=>i.sourceId===c.pageId))inputs.push(source(c.pageId,c.municipalityCode));
const run=(id:string)=>reviewKyoto(inputs.find(i=>i.sourceId===id)!,inputs)!;

test('Kyoto500 reviewed annual identities retain exact hashes and bounded title fragments',()=>{
 let n=0;const ids=new Set<string>();for(const c of configs){const i=inputs.find(x=>x.sourceId===c.sourceId)!;const r=run(c.sourceId);n+=r.projects.length;assert.equal(r.projects.length,c.rows.length);for(const p of r.projects){assert.ok(!ids.has(p.id),p.id);ids.add(p.id);assert.equal(p.amounts.length,0);assert.equal(p.indicators.length,0);assert.equal(p.ratings.length,0);for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;const src=inputs.find(x=>x.sourceUrl===e.sourceUrl)!;assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}for(const bad of [{...i,text:i.text+'x'},{...i,sourceSha256:'x'},{...i,truncated:true}])assert.equal(reviewKyoto(bad,inputs)!.projects.length,0);}assert.equal(n,500);
});
test('Ine annual conflicts and reprinted capital expenses do not produce extra records',()=>{
 const r=run('4d9cd8710cde81888a4b3639');assert.equal(r.projects.length,3);assert.ok(r.units.some(u=>u.status==='conflicting_period_hold'));assert.ok(!r.projects.some(p=>p.projectName.endsWith('活用した地域活性化計画')));
 const older=run('98b24d19a6f871f46e592860').projects;assert.equal(older.length,1);assert.equal(older[0].evaluatedFiscalYear,2020);assert.equal(older[0].amounts.length,0);assert.ok(older[0].warnings.some(w=>w.includes('事業費欄は令和元年度')));
 const first=run('d133183c0a305accd3ee1e46').projects;assert.equal(first.length,2);assert.ok(first.every(p=>p.evaluatedFiscalYear===2017&&p.evaluationYear===2018));
});
test('Ine source-linked target fiscal year requires the exact official page',()=>{
 const i=inputs.find(x=>x.sourceId==='a27f41e2af9c0dafb52b7ffc')!;assert.equal(reviewKyoto(i,[])!.projects.length,0);assert.equal(reviewKyoto(i,inputs)!.projects[0].evaluatedFiscalYear,2021);
});
test('Ujitawara69 units separate carryovers and contradictory implementation years',()=>{
 const r=run('7b58224eb7497fe73a77b31d');assert.equal(r.projects.length,62);assert.equal(r.units.length,69);assert.equal(r.units.filter(u=>u.status==='conflicting_period_hold').length,2);assert.equal(r.units.filter(u=>u.status==='duplicate_accounting_partition_hold').length,5);assert.ok(r.projects.some(p=>p.projectName==='湯屋谷配水管更新事業費（繰越）'));assert.ok(r.projects.every(p=>p.evaluatedFiscalYear===2024&&p.amounts.length===0));
});
test('Same-named primary and secondary-school sheets need exact accounting identity evidence',()=>{
 const ps=run('7b58224eb7497fe73a77b31d').projects;for(const name of ['AIドリルで学習の基本・意欲・定着推進事業費','先端プログラミング教育推進事業費']){const [a,b]=ps.filter(p=>p.projectName===name);assert.ok(a&&b);assert.ok(distinctUjitawaraSchoolRows(a,b));assert.ok(!distinctUjitawaraSchoolRows(a,a));assert.ok(!distinctUjitawaraSchoolRows({...a,id:'wrong'},b));assert.ok(!distinctUjitawaraSchoolRows({...a,evidence:[]},b));assert.ok(!distinctUjitawaraSchoolRows({...a,evaluatedFiscalYear:2023},b));assert.ok(!distinctUjitawaraSchoolRows({...a,evidence:a.evidence.map(e=>({...e,sha256:'wrong'}))},b));}
});
test('Kasagi four benefit identities retain target-year and carryover distinctions without costs',()=>{
 const ps=run('ebaf1f1b0ab21b13f9a55407').projects;assert.equal(ps.length,4);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2023&&p.amounts.length===0));assert.equal(new Set(ps.map(p=>p.projectName)).size,4);
});

test('Yawata full continuation keeps annual activity names and rejects funding, statistics and guessed amounts',()=>{
 const r=run('70cb11f7640c217cbd971c51');assert.equal(r.projects.length,313);
 assert.ok(r.projects.every(p=>p.evaluatedFiscalYear===2021&&p.evaluationYear===null&&p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
 for(const name of ['（国）','（府）','支払基金交付金','グラウンド','国補正分','一般分'])assert.ok(!r.projects.some(p=>p.projectName===name),name);
 for(const name of ['地域ケア会議推進','府道八幡インター線整備事業費負担金','木造住宅耐震改修助成','妊婦保健指導'])assert.ok(r.projects.some(p=>p.projectName===name),name);
 assert.ok(r.projects.some(p=>p.evidence.some(e=>Number(e.cell?.match(/chars:(\d+)/)?.[1])>120000)));
 assert.ok(r.units.some(u=>u.status==='identity_review_pending_hold'));
});

test('Fukuchiyama105 individual names use target2024 evaluation2025 rather than publication2026 or policy aggregates',()=>{
 const r=run('493a5f65aab317fdb7be11a1');assert.equal(r.projects.length,105);assert.equal(new Set(r.projects.map(p=>p.id)).size,105);
 assert.ok(r.projects.every(p=>p.evaluatedFiscalYear===2024&&p.evaluationYear===2025&&p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
 assert.ok(r.projects.some(p=>p.projectName==='教師用教科書・指導書購入事業（小学校）'));assert.ok(r.projects.some(p=>p.projectName==='教師用教科書・指導書購入事業（中学校）'));
 assert.ok(!r.projects.some(p=>p.projectName==='小・中学校施設環境改善事業'));assert.ok(!r.projects.some(p=>p.projectName==='公共施設の最適化'));
});
test('Fukuchiyama activity excerpts require exact matching narrative titles and offsets; combined narratives stay unassigned',()=>{
 const r=run('493a5f65aab317fdb7be11a1');assert.equal(r.projects.filter(p=>p.activities!==null).length,15);
 const c=(kyotoRows as any[]).find(c=>c.sourceId==='493a5f65aab317fdb7be11a1'),row=c.rows.find((r:any)=>r.activitiesProof),original=row.activitiesProof;
 for(const patch of [{raw:original.raw+'x'},{start:original.start+1},{title:'別事業'},{titleStart:original.titleStart+1}]){try{row.activitiesProof={...original,...patch};assert.throws(()=>run(c.sourceId),/activity narrative identity/);}finally{row.activitiesProof=original;}}
 const p=r.projects.find(p=>p.projectName==='小学校施設環境改善事業')!;assert.equal(p.activities,null);
 assert.ok(r.projects.find(p=>p.projectName==='小学校水泳指導委託事業')!.activities!.includes('小学校全１４校'));
});
