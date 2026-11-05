import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewKagawa,distinctKagawaSchoolSheets} from '../src/evaluations/expansion/descending-kagawa';
import {kagawaRows} from '../src/evaluations/expansion/descending-kagawa-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}
test('Kagawa literal review fails closed on source/hash/body changes and preserves exact evidence',()=>{
 for(const c of kagawaRows){const i=source(c.sourceId,c.municipalityCode),inputs:CachedInput[]=c.pageId?[source(c.pageId,c.municipalityCode)]:[],r=reviewKagawa(i,inputs)!;for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.indicators.length,0);assert.equal(p.ratings.length,0);for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;const src=[i,...inputs].find(x=>x.sourceUrl===e.sourceUrl)!;assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'}])assert.equal(reviewKagawa(bad,inputs)!.projects.length,0);assert.equal(reviewKagawa({...i,municipalityCode:'37202'}),null);}
});

test('Manno mixed-year reports require per-row year proof; later April starts are not report-year projects',()=>{const a=reviewKagawa(source('e2a82968491fe70ae45123e4','37406'))!.projects;assert.ok(a.length>0);assert.ok(a.every(p=>p.evaluatedFiscalYear!==null));assert.ok(a.some(p=>p.projectName==='病児・病後児保育事業'&&p.evaluatedFiscalYear===2015));const b=reviewKagawa(source('95a36759d028a4b21a163b9d','37406'))!.projects;assert.ok(b.some(p=>p.projectName==='お試し移住宿泊費補助金制度'&&p.evaluatedFiscalYear===2025));assert.ok(b.some(p=>p.projectName==='かりん会館の修繕事業'&&p.evaluatedFiscalYear===2024));});
test('Tadotsu funding-year annotations and same-project allocation rows do not multiply projects',()=>{const a=reviewKagawa(source('d38ac67c4c37c08e712df696','37404'))!;assert.equal(a.projects.length,39);assert.ok(a.projects.every(p=>p.evaluatedFiscalYear===2022));assert.equal(a.projects.filter(p=>p.projectName==='プレミアム付商品券販売事業').length,1);assert.ok(a.units.some(u=>u.status==='column_alignment_hold'));assert.ok(a.projects.every(p=>p.amounts.length===0));});
test('Ayagawa school meals across accounting transition stay one annual project',()=>{const a=reviewKagawa(source('6b8b388d535bc887e0754515','37387'))!.projects;assert.equal(a.length,11);assert.equal(a.filter(p=>p.projectName.includes('学校給食費')).length,1);assert.ok(a.every(p=>p.evaluatedFiscalYear===2024));assert.equal(reviewKagawa(source('8e9bc813c3a936447d9989da','37387'))!.projects.length,6);});
test('Naoshima KPI dates and festival title do not establish a book-wide fiscal year',()=>{const a=reviewKagawa(source('b8fac577cd100f547a9022f9','37364'))!;assert.equal(a.projects.length,0);assert.ok(a.units.some(u=>u.status==='annual_identity_hold'));});
test('Shodoshima uses fifteen individual sheets and target year, without splitting combined activities',()=>{const a=reviewKagawa(source('faaafc25d8d832da39e388be','37324'))!.projects;assert.equal(a.length,15);assert.ok(a.every(p=>p.evaluatedFiscalYear===2024));assert.ok(a.some(p=>p.projectName==='子育て支援拠点事業放課後児童クラブ事業'));});
test('Tonosho accepts only recoverable title fragments and retains reversed-column uncertainty',()=>{const a=reviewKagawa(source('c768f83326bbb6f6e63cfa78','37322'))!;assert.equal(a.projects.length,24);assert.ok(a.projects.every(p=>p.evaluatedFiscalYear===2024));assert.ok(a.units.some(u=>u.status==='column_alignment_hold'));assert.ok(!a.projects.some(p=>p.projectName==='中央図書館運営事業'));});
test('Higashikagawa full-book copies cannot duplicate existing annual records',()=>{assert.equal(reviewKagawa(source('ef18c74ae01e8b6876cce426','37207'))!.projects.length,0);assert.equal(reviewKagawa(source('396f484d6ad394be91a4cf20','37207'))!.projects.length,0);for(const id of ['0bada6355b1c7399916d18cd','f175b71a713f73c7f37b3261','66052d95472f1b8d27bbcafa']){const a=reviewKagawa(source(id,'37207'))!.projects;assert.equal(a.length,1);assert.equal(a[0].evaluatedFiscalYear,2023);}});

test('Sanuki three-page hospital sheets require the exact saved annual cover and preserve four identities',()=>{
 const i=source('680f6bb8d2623b9180ca2bd1','37206'),cover=source('df52ad93846580efd42de26e','37206');
 assert.equal(reviewKagawa(i)!.projects.length,0);assert.equal(reviewKagawa(i,[{...cover,text:cover.text+'x'}])!.projects.length,0);
 const ps=reviewKagawa(i,[cover])!.projects;assert.equal(ps.length,5);assert.equal(ps.filter(p=>p.projectName.startsWith('病院')).length,4);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2022));
 const later=reviewKagawa(source('8400f1428e560037d6a3bf61','37206'),[source('cb625c09117b6bec9da0a13f','37206')])!.projects;assert.equal(later.length,4);assert.ok(later.every(p=>p.evaluatedFiscalYear===2024));
});
test('Zentsuji same-name school projects retain distinct evidenced beneficiaries without changing official names',()=>{
 const ps=reviewKagawa(source('e1a0df38cf0100052ac586c5','37204'),[source('a9c3eca29decc561df1804a2','37204')])!.projects;assert.equal(ps.length,50);
 const [a,b]=ps.filter(p=>p.projectName==='パワーアップ事業');assert.ok(a&&b);assert.ok(distinctKagawaSchoolSheets(a,b));assert.ok(distinctKagawaSchoolSheets(b,a));
 assert.equal(distinctKagawaSchoolSheets(a,a),false);assert.equal(distinctKagawaSchoolSheets({...a,id:a.id+'x'},b),false);assert.equal(distinctKagawaSchoolSheets({...a,evaluatedFiscalYear:2023},b),false);assert.equal(distinctKagawaSchoolSheets({...a,evidence:a.evidence.map(e=>({...e,sha256:'x'}))},b),false);assert.equal(distinctKagawaSchoolSheets({...a,evidence:[]},b),false);
});
test('Kanonji named annual rows exclude policy headers and do not claim a cancelled event took place',()=>{
 const ps=reviewKagawa(source('205ec4932935637e58337d8d','37205'))!.projects;assert.equal(ps.length,52);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2024&&p.amounts.length===0));const p=ps.find(p=>p.projectName.includes('トライアスロン'))!;assert.ok(p.evidence.some(e=>e.rawText.includes('中止')));assert.equal(p.outcomes,null);
});
