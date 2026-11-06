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
 for(const p of r.projects){assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.equal(p.indicators.length,0);for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;const src=inputs.find(x=>x.sourceUrl===e.sourceUrl);assert.ok(src);assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}
 for(const bad of [{...i,text:i.text+'x'},{...i,truncated:true},{...i,sourceSha256:'x'},{...i,sourceUrl:i.sourceUrl+'x'},{...i,format:'xlsx' as const}])assert.equal(reviewOsaka(bad,inputs)!.projects.length,0);
 }assert.equal(count,199);
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

test('Taishi names actual FY2023 narrative projects without counting policy headings or next-year fire reorganization',()=>{
 const ps=run('0b7731e5313ad0a0b3fa9067').projects;assert.equal(ps.length,5);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2023&&p.evaluationYear===null&&p.amounts.length===0&&p.ratings.length===0));
 assert.deepEqual(ps.map(p=>p.projectName),['妊娠・出産・子育てよりそいサポート事業','一時預かり利用支援補助金','家庭用生ごみ処理機の無償貸与事業','山田小学校のトイレ改修1期目工事','産官学連携プロジェクト']);assert.ok(ps.every(p=>p.warnings.some(w=>w.includes('関連決算資料'))));
});
test('Katano keeps two support services, fiscal self-assessment year and calendar creation date distinct',()=>{
 const ids=['76d52d61bf0e1dca15bf1f0a','eb820635a65e4e0bb9d8d75a'];const ps=ids.flatMap(id=>run(id).projects);assert.equal(ps.length,2);assert.ok(ps.every(p=>p.evaluationYear===2025&&p.evaluatedFiscalYear===null&&p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
 assert.ok(ps.some(p=>p.projectName==='保育所等訪問支援事業'));for(const p of ps){assert.ok(p.evidence.some(e=>e.rawText==='2025年度の自己評価結果の公表について'));assert.ok(p.evidence.some(e=>e.rawText==='令和8年3月30日'));}
 for(const id of ['f07c395eb0e4bea9c2b86f61','82a82c012c4894f02db67f8b','a885d2c701096bd6b9e77fe8','8e12694cba0e345b6fe9eef6','3659085c843de0d676c53221','dbdc8ab4b48d2b9dc4af9223'])assert.ok(!configs.some(c=>c.sourceId===id));
});
test('Katano requires the bound official link page before assigning its fiscal evaluation year',()=>{
 const page=inputs.find(x=>x.sourceId==='fde431e7260866b3af5ccfd5')!;assert.ok(page);
 for(const sid of ['76d52d61bf0e1dca15bf1f0a','eb820635a65e4e0bb9d8d75a']){const i=inputs.find(x=>x.sourceId===sid)!;const rest=inputs.filter(x=>x.sourceId!==page.sourceId);assert.equal(reviewOsaka(i,rest)!.projects.length,0);
 for(const bad of [{...page,text:page.text.replace('2025年度','2024年度')},{...page,sourceSha256:'bad'},{...page,sourceUrl:page.sourceUrl+'changed'},{...page,truncated:true}])assert.equal(reviewOsaka(i,[...rest,bad])!.projects.length,0);}
});
test('Takaishi names implemented activities without copying policy scores, prior/future indicators or activity totals',()=>{
 const ps=run('fd6ee54001c2aaa097f846fd').projects;assert.equal(ps.length,15);assert.ok(ps.every(p=>p.evaluatedFiscalYear===2025&&p.evaluationYear===2026&&p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
 for(const name of ['小中連携推進支援事業','SISTⅣ事業','English Camp in Takaishi','ぴよぴよルーム','高石小学校の校庭開放事業','市民文化祭'])assert.ok(ps.some(p=>p.projectName===name),name);
 for(const name of ['学力の向上','信頼と責任のある学校づくり','社会教育施設の適正管理','54 事業','コミュニティスクール導入'])assert.ok(!ps.some(p=>p.projectName===name));
 assert.equal(ps.filter(p=>p.projectName==='公民館講座').length,1);assert.equal(ps.filter(p=>p.projectName==='アプラ「まち講座」').length,1);
});

test('Kashiwara annual activities bind departments and explicit FY2025 without treating future budgets as actuals',()=>{
 const ps=run('121aeac89c6e4a6ece040632').projects;assert.equal(ps.length,121);
 assert.ok(ps.every(p=>p.evaluatedFiscalYear===2025&&p.evaluationYear===null&&p.department&&p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
 for(const [name,department]of [['学校給食費補助事業','学務課'],['オンライン教育推進事業','指導課'],['地域福祉計画策定事業','福祉総務課'],['国際交流事業に関すること','にぎわい観光課'],['児童手当について','子育て支援課']])assert.ok(ps.some(p=>p.projectName===name&&p.department===department),name);
 const plan=ps.find(p=>p.projectName==='地域福祉計画策定事業')!;assert.ok(plan.evidence.some(e=>e.rawText.includes('令和 8 年度～令和 12 年度')));assert.equal(plan.evaluatedFiscalYear,2025);
});
test('Kashiwara excludes numeric table cells, funds, insurance aggregate and unresolved bridge identities',()=>{
 const ps=run('121aeac89c6e4a6ece040632').projects;
 for(const name of ['件（産学官連携事業（5 件）含む。）','事業所','公園等整備事業基金','介護保険事業','橋りょう維持事業','高齢者介護保険利用料軽減措置事業','福祉有償運送市町村共同運営事業','月期末手当・勤勉手当','予算','決算'])assert.ok(!ps.some(p=>p.projectName===name),name);
 assert.equal(new Set(ps.map(p=>[p.projectName,p.department,p.evaluatedFiscalYear].join('|'))).size,121);
});
test('Kashiwara needs verified continuation text rather than only the first120000 characters',()=>{
 const i=inputs.find(x=>x.sourceId==='121aeac89c6e4a6ece040632')!;assert.equal(i.text.length,196774);assert.ok(run(i.sourceId).projects.some(p=>p.evidence.some(e=>Number(e.cell!.match(/chars:(\d+)/)![1])>=120000)));
 assert.equal(reviewOsaka({...i,text:i.text.slice(0,120000)},inputs)!.status,'source_integrity_hold');
});


test('Izumisano retains one explicitly named individual comment rather than policy chapters or repeated remarks',()=>{
 const ps=run('82d10803f411f03a9aa99045').projects;assert.equal(ps.length,1);const p=ps[0];assert.equal(p.projectName,'乳幼児医療費助成事業');assert.equal(p.evaluationYear,2010);assert.equal(p.evaluatedFiscalYear,null);assert.equal(p.amounts.length,0);assert.equal(p.ratings.length,0);assert.ok(p.warnings.some(w=>w.includes('個別評価票全文ではない')));assert.ok(p.evidence.some(e=>e.rawText.includes('１次評価でＡ')));
});
