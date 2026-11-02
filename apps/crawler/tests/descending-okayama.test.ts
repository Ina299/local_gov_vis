import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewOkayama} from '../src/evaluations/expansion/descending-okayama';
import {okayamaRows} from '../src/evaluations/expansion/descending-okayama-map';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput {
 const dir=new URL('../../web/public/evaluation-evidence/',import.meta.url);
 const meta=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,dir),'utf8')).sources.find((s:{id:string})=>s.id===id);
 const d=JSON.parse(readFileSync(new URL(`documents/${id}.json`,dir),'utf8'));let text=d.text,offset=[...text].length;
 for(const c of meta.text.continuations??[]){const bytes=readFileSync(new URL(c.assetPath,dir));assert.equal(bytes.length,c.assetBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.assetSha256);const part=JSON.parse(bytes.toString());assert.equal(c.startCharacter,offset);assert.equal(part.startCharacter,offset);assert.equal(part.sourceId,id);assert.equal(part.sourceUrl,d.sourceUrl);assert.equal(part.sourceSha256,d.sourceSha256);assert.equal(createHash('sha256').update(part.text).digest('hex'),c.textSha256);text+=part.text;offset+=[...part.text].length;}
 assert.equal(offset,meta.text.characters);assert.equal(createHash('sha256').update(text).digest('hex'),meta.text.fullTextSha256??meta.text.textSha256);
 return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text,format:!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='pdftotext_from_verified_bytes'?'pdf':!['pdf','html','xlsx'].includes(meta.format)&&d.extractionMethod==='visible_html_from_verified_bytes'?'html':meta.format,truncated:false};
}

const inputs=okayamaRows.map(c=>source(c.sourceId,c.municipalityCode));
const run=(id:string)=>reviewOkayama(inputs.find(i=>i.sourceId===id)!,inputs)!;
test('Okayama cached rows bind full source identity and every original text position',()=>{
 for(const c of okayamaRows){const i=inputs.find(i=>i.sourceId===c.sourceId)!;const r=reviewOkayama(i,inputs)!;assert.equal(r.projects.length,c.rows.length);assert.equal(new Set(r.projects.map(p=>p.id)).size,r.projects.length);
  for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.equal(p.indicators.length,0);assert.ok(p.evaluatedFiscalYear!==null||p.evaluationYear!==null);for(const e of p.evidence){const src=inputs.find(x=>x.sourceUrl===e.sourceUrl)!;const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}
  for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'}])assert.equal(reviewOkayama(bad,inputs)!.projects.length,0);
 }
});
test('Kibichuo official page-year mapping requires the saved page and exact source identity',()=>{
 const i=inputs.find(i=>i.sourceId==='5ab79d373f7e5eadc546cf76')!;
 assert.equal(reviewOkayama(i)!.status,'annual_identity_hold');
 assert.equal(reviewOkayama(i,inputs.map(p=>p.sourceId==='2dee1c5c9dc70beb676e0463'?{...p,sourceSha256:'wrong'}:p))!.projects.length,0);
 assert.equal(run(i.sourceId).projects.length,10);
});
test('Kibichuo grant years never turn solely following-year rows into current-year actual projects',()=>{
 const ps=run('56a60f5479d295b9bd58bb92').projects;assert.equal(ps.length,18);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2020));
 for(const n of ['医療従事者支援事業','Ｗｅｂ会議用機器整備','新型コロナウイルス感染症対策追加給付金事業'])assert.ok(!ps.some(p=>p.projectName===n));
 assert.equal(ps.filter(p=>p.projectName==='新型コロナウイルス感染症対策小規模事業者光熱費助成事業').length,1);
 assert.ok(!run('8c5a9e65ca94354de5858f35').projects.some(p=>p.projectName.includes('交通DX')||p.projectName.includes('鳥獣対策DX')));
});
test('Kibichuo annual parent identities retain combined rows and exclude administrative or period duplicates',()=>{
 const ps=run('5f252d5404445be04073a19a').projects;assert.equal(ps.length,5);assert.equal(ps.filter(p=>p.projectName==='給食費免除').length,1);assert.ok(!ps.some(p=>p.projectName.includes('事務費')));
 const next=run('6e191575af0c690c7aa1b624').projects;assert.equal(next.length,3);assert.ok(next.every(p=>p.evaluatedFiscalYear===2024));assert.equal(next.filter(p=>p.projectName.includes('調整給付')).length,1);
});
test('Shoo retains all nineteen missing headings without recreating the sixteen production rows',()=>{
 const ps=run('24bea74e0d1280a0dc4ad7ec').projects;assert.equal(ps.length,19);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2023));
 for(const n of ['工業団地オープンファクトリー事業','「“ほどヨイ！田舎”来てみんちゃい♪勝央体験」事業','「住んでみんちゃい！」勝央町定住促進補助事業','若者の自立支援・社会参画支援事業','スポーツによる健康で元気なまちづくり'])assert.ok(ps.some(p=>p.projectName===n));
 for(const n of ['多様な人材の連携の場づくり','新規就農促進事業','情報化・技術革新への対応'])assert.ok(!ps.some(p=>p.projectName===n));
 assert.ok(ps.find(p=>p.projectName==='プロモーション専門チームの設置')!.warnings.some(w=>w.includes('未設置')));
});
test('Shoo reversed fragments reject shifted, overlapping and out-of-unit source positions',()=>{
 const c=okayamaRows.find(c=>c.sourceId==='24bea74e0d1280a0dc4ad7ec')!;
 const row=c.rows.find(r=>'titleSegments' in r&&r.titleSegments?.length===2)!;
 const segments=(row as {titleSegments:{start:number;raw:string}[]}).titleSegments;const old=segments.map(s=>({...s}));
 try{segments[0].start++;assert.throws(()=>run(c.sourceId),/segment/);segments.splice(0,segments.length,...old.map(s=>({...s})));segments[1]={...segments[0]};assert.throws(()=>run(c.sourceId),/segment/);segments.splice(0,segments.length,...old.map(s=>({...s})));segments[0].start=0;assert.throws(()=>run(c.sourceId),/segment/);}finally{segments.splice(0,segments.length,...old);}
});
test('Yakage multiyear evaluation keeps assessment year and does not invent annual costs or duplicate relocated facilities',()=>{
 const ps=run('69f1ebd7681f1cb34be02bca').projects;assert.equal(ps.length,15);assert.ok(ps.every(p=>p.evaluationYear===2023&&p.evaluatedFiscalYear===null));assert.equal(ps.filter(p=>p.projectName.includes('観光交流施設')).length,1);assert.ok(!ps.some(p=>p.projectName.includes('旧マルナカ')));
});
test('Hayashima excludes cancelled 2020 events and preserves the next-year explicit implementation',()=>{
 const old=run('0b3e06b025d9bedc6f7abd95').projects;const next=run('39bda65a47717df297fe298f').projects;
 assert.ok(!old.some(p=>p.projectName==='第３回花ござピンポン世界大会'||p.projectName==='子どもカレッジ体験事業'||p.projectName==='早島シネマ'));
 assert.ok(next.some(p=>p.projectName==='第３回花ござピンポン世界大会'&&p.evaluatedFiscalYear===2021));assert.ok(next.some(p=>p.projectName==='ハヤシネマ'));
 for(const id of ['a020e67b98e0efcb9ad080cb','aea08cca76acae0f7ee15cdd'])assert.equal(run(id).projects.length,0);
});
test('Hayashima legacy activities keep annual identities without parent or alias duplication',()=>{
 const a=run('da3562c40989d276df07b498').projects;
 assert.equal(a.filter(p=>p.projectName==='放課後はやしま塾、土曜はやしま塾'&&p.evaluatedFiscalYear===2015).length,1);
 assert.ok(!a.some(p=>p.projectName==='放課後はやしま塾'||p.projectName==='土曜はやしま塾'));
 const b=run('78d4b7d29c59ecfc97f948fd').projects;
 assert.ok(b.some(p=>p.projectName==='ボランティアパスポートの活用'&&p.evaluatedFiscalYear===2016));
 assert.ok(!b.some(p=>p.projectName==='花ござ手織り教室'||p.projectName==='夏休みワクワク子ども教室'));
 for(const id of ['4c85db758590397199ca44ae','96bd7771617749a8f18c01ea'])assert.equal(run(id).projects.length,0);
});
test('Asakuchi annual delivered-course appendices retain renamed courses and never align interleaved numbers by guess',()=>{
 const old=run('7d9e44daba8a5d9b82f19274').projects;
 assert.equal(old.filter(p=>p.projectName==='総合文化祭'&&p.evaluatedFiscalYear===2014).length,1);
 const latest=run('0d1e6358d119224a4d3c7019').projects;
 assert.ok(latest.some(p=>p.projectName==='やさしい実用書道'&&p.evaluatedFiscalYear===2018));
 assert.ok(!latest.some(p=>p.projectName==='やさしい書道'));
 for(const id of ['7d9e44daba8a5d9b82f19274','719a201c741bbd1ef25c7852','08d45ae9a61fd68fdc958d17','3715179422a3e72f71110f3f','0d1e6358d119224a4d3c7019']){
  for(const p of run(id).projects){assert.deepEqual(p.amounts,[]);assert.deepEqual(p.indicators,[]);assert.deepEqual(p.ratings,[]);assert.ok(!p.projectName.includes('受講生'));}
 }
});
test('Asakuchi distinguishes cancelled tournaments and ambiguous night observations from separately delivered activities',()=>{
 const y2018=run('0d1e6358d119224a4d3c7019').projects;
 assert.ok(!y2018.some(p=>p.projectName==='フットサル大会'));
 assert.ok(y2018.some(p=>p.projectName==='児童水泳教室'&&p.evaluatedFiscalYear===2018));
 assert.ok(y2018.find(p=>p.projectName==='市民体育祭')!.warnings.some(w=>w.includes('一地区')&&w.includes('中止')));
 const y2015=run('719a201c741bbd1ef25c7852').projects;
 assert.ok(y2015.some(p=>p.projectName==='プラネタリウムコンサート'));
 assert.ok(!y2015.some(p=>p.projectName==='国立天文台岡山天体物理観測所特別夜間観望会'));
});
test('Asakuchi fixed wrapped names retain distinct sites and annual parent scope',()=>{
 const ps=run('7d9e44daba8a5d9b82f19274').projects;
 for(const name of ['浅口市マラソン大会','アクアビクス教室（寄島）','アクアビクス教室（鴨方）','年末恒例！年越しそば打ち'])assert.equal(ps.filter(p=>p.projectName===name).length,1);
 assert.ok(!ps.some(p=>p.projectName==='ＧＷは町家においでよ'||p.projectName==='放課後学習サポート事業'));
 assert.ok(ps.some(p=>p.projectName==='学力向上Ｎｏ.１プロジェクト事業'));
});
test('Asakuchi excludes explicitly unheld league and suspended course without erasing distinct delivered rows',()=>{
 const y2015=run('719a201c741bbd1ef25c7852').projects;
 assert.ok(!y2015.some(p=>p.projectName==='フットサルリーグ'));
 assert.ok(y2015.some(p=>p.projectName==='フットサル大会'));
 const y2022=run('debea25c6ac7aa481a3d1d33').projects;
 assert.ok(!y2022.some(p=>p.projectName==='アロマのある暮らし'));
 assert.ok(y2022.some(p=>p.projectName==='バランスボールエクササイズ'));
 assert.ok(y2022.find(p=>p.projectName==='バランスボールエクササイズ')!.evidence.some(e=>e.rawText?.includes('休止')));
});
test('Asakuchi childcare preserves explicit current year and excludes following-year implementation decision',()=>{
 const y2015=run('719a201c741bbd1ef25c7852').projects;
 assert.ok(y2015.some(p=>p.projectName==='一時預かり事業'&&p.evaluatedFiscalYear===2015));
 assert.ok(!y2015.some(p=>p.projectName==='一時預かり事業（幼稚園型）'||p.projectName==='一時預かり事業(幼稚園型)'));
 const y2016=run('08d45ae9a61fd68fdc958d17').projects;
 for(const name of ['一時預かり事業(一般型)','一時預かり事業(幼稚園型)','休日保育事業','病後児保育事業','延長保育事業']){
  const p=y2016.find(p=>p.projectName===name)!;assert.ok(p);assert.equal(p.evaluatedFiscalYear,2016);assert.deepEqual(p.amounts,[]);assert.deepEqual(p.indicators,[]);assert.deepEqual(p.ratings,[]);
 }
});
test('Asakuchi later annual activity appendices do not recreate policy headings or borrow their scores',()=>{
 for(const id of ['5a2110e7de245130b1bff72f','19b4da585948ae0e1f6c3ead','cfeb3eb6925796baffbb85d3','debea25c6ac7aa481a3d1d33','e5854c4ddadd9272db7c7166','f12e80a7f4e149a44faca093','90b5410c7f774365a16a895f']){
  const ps=run(id).projects;assert.ok(ps.length>0);assert.ok(!ps.some(p=>p.projectName==='学校教育の充実'||p.projectName==='生涯学習の充実'));
  assert.equal(ps.filter(p=>p.projectName==='ゼロから始める暮らしのペン・筆ペン習字').length,1);
  for(const p of ps){assert.deepEqual(p.amounts,[]);assert.deepEqual(p.ratings,[]);assert.deepEqual(p.indicators,[]);assert.equal(p.evaluationYear,null);}
 }
 assert.ok(!run('19b4da585948ae0e1f6c3ead').projects.some(p=>p.projectName==='総合文化祭'||p.projectName==='金光キッズフェスティバル'));
});
