import {reviewBungotakada} from '../src/evaluations/expansion/descending-bungotakada';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {reviewOitaR2} from '../src/evaluations/expansion/descending-oita-r2';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function source(id:string,code:string):CachedInput{const d=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));return{municipalityCode:code,municipalityName:'test',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text:d.text,format:'pdf',truncated:false};}
test('Kokonoe accounts for41 sheets and two historical years without promoting future plan columns to actuals',()=>{const i=source('470d8bab6f9c499dfeefd122','44461'),r=reviewOitaR2(i)!;assert.equal(r.units.length,41);assert.equal(r.projects.length,82);assert.ok(r.projects.every(p=>[2020,2021].includes(p.evaluatedFiscalYear!)&&p.evaluationYear===null));assert.ok(r.projects.some(p=>p.projectName==='健康アプリ「おおいた歩得」活用促進事業'));for(const p of r.projects){assert.deepEqual(p.amounts,[]);assert.deepEqual(p.indicators,[]);for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}}assert.equal(reviewOitaR2({...i,truncated:true})!.projects.length,0);assert.equal(reviewOitaR2({...i,text:i.text.replace('〔整理番号〕41','〔整理番号〕42')})!.projects.length,0);assert.equal(reviewOitaR2({...i,text:i.text.replaceAll('Ｒ３','年度不明')})!.projects.length,0);});
test('Himeshima named programs retain the explicit execution period and omit unaligned shared ratings',()=>{const i=source('31564eed127d9666250d6163','44322'),r=reviewOitaR2(i)!;assert.equal(r.projects.length,23);assert.ok(r.projects.every(p=>p.evaluatedFiscalYear===2019&&p.evaluationYear===null&&p.ratings.length===0&&p.amounts.length===0));assert.ok(!r.projects.some(p=>p.projectName==='教育委員会の活動'));for(const p of r.projects)for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}assert.equal(reviewOitaR2({...i,text:i.text.replace('平成31年4月～令和2年3月','期間未確認')})!.projects.length,0);assert.equal(reviewOitaR2({...i,truncated:true})!.projects.length,0);});

test('Kunisaki preserves design scope and excludes shared ratings from24 exact named activities',()=>{const i=source('6345c171cf1e40e7691b3010','44214'),r=reviewOitaR2(i)!;assert.equal(r.projects.length,24);assert.ok(r.projects.some(p=>p.projectName.endsWith('の設計')));assert.ok(r.projects.every(p=>p.evaluatedFiscalYear===2023&&p.evaluationYear===2024&&p.ratings.length===0&&p.amounts.length===0));for(const p of r.projects)for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}assert.equal(reviewOitaR2({...i,text:i.text.replace('（令和５年４月～令和６年３月）','年度不明')})!.projects.length,0);assert.ok(r.units.some(u=>u.status==='individual_identity_hold'));});
test('Usa uses sheet actual years, rejects future allocations and preserves conflicting-year holds',()=>{const ids=['3b4d3f01c897a10dbd464a56','8bdd2178b1a72d223861ef21','d441078fdf491a6209e626e5','7e49d2b6a1d0ee3924ff9deb','cc979af6f0ef71352a86cabb','d3b27a6c6ec48d22ca45aba8'];const counts=[4,5,6,3,2,6];for(let n=0;n<ids.length;n++){const i=source(ids[n],'44211'),r=reviewOitaR2(i)!;assert.equal(r.projects.length,counts[n]);assert.ok(r.projects.every(p=>p.evaluatedFiscalYear===2018+n&&p.evaluationYear===null));for(const p of r.projects)for(const e of p.evidence){const m=e.cell!.match(/chars:([0-9]+)-([0-9]+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}assert.equal(reviewOitaR2({...i,truncated:true})!.projects.length,0);}assert.equal(reviewOitaR2(source(ids[3],'44211'))!.units.filter(u=>u.status==='annual_or_title_hold').length,1);assert.equal(reviewOitaR2(source(ids[4],'44211'))!.units.filter(u=>u.status==='annual_or_title_hold').length,1);});
test('Yufu reform headings retain internal separators but exclude subordinate bullets',()=>{const i=source('4b4a506b459e8be8251cd379','44213'),r=reviewOitaR2(i)!;assert.ok(r.projects.some(p=>p.projectName==='補助金交付基準の策定・運用'));assert.ok(!r.projects.some(p=>p.projectName.includes('ユーバス時刻表広告')));assert.ok(r.projects.every(p=>p.evaluatedFiscalYear===2025&&p.amounts.length===0&&p.ratings.length===0));for(const p of r.projects)for(const e of p.evidence){const m=e.cell!.match(/chars:([0-9]+)-([0-9]+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}assert.equal(reviewOitaR2({...i,text:i.text.replace('［令和７年度］','年度未確認')})!.projects.length,0);});

test('Bungotakada requires saved official annual labels and keeps period conflicts out',()=>{const page={...source('6cc80f44c4fd30315a7c5812','44209'),format:'html' as const};for(const [id,count]of [['36de4cf7cf3c09d283df4bc7',19],['4d92365077e184137cb1f126',5],['ba2781c9affe4d62e805ff88',2]] as const){const i=source(id,'44209'),r=reviewBungotakada(i,[i,page])!;assert.equal(r.projects.length,count);for(const p of r.projects){assert.equal(p.evaluationYear,null);assert.deepEqual(p.amounts,[]);for(const e of p.evidence){const src=e.sourceUrl===page.sourceUrl?page:i,m=e.cell!.match(/chars:([0-9]+)-([0-9]+)/)!;assert.equal(src.text.slice(+m[1],+m[2]),e.rawText);}}assert.equal(reviewBungotakada({...i,truncated:true},[i,page])!.projects.length,0);}const i=source('36de4cf7cf3c09d283df4bc7','44209');assert.equal(reviewBungotakada(i,[])!.projects.length,0);assert.equal(reviewBungotakada(i,[{...page,truncated:true}])!.projects.length,0);assert.equal(reviewBungotakada(i,[page])!.units.filter(u=>u.status==='annual_identity_hold').length,2);});

test('Bungotakada reviewed mappings preserve all title spans and per-row periods without duplicate funding components', async()=>{
 const {bungoRows}=await import('../src/evaluations/expansion/descending-bungotakada-map');
 const page={...source('6cc80f44c4fd30315a7c5812','44209'),format:'html' as const};
 let total=0;
 for(const config of bungoRows){
  const i=source(config.id,'44209'),r=reviewBungotakada(i,[page])!;
  assert.equal(r.projects.length,config.rows.length,config.id);total+=r.projects.length;
  for(let n=0;n<r.projects.length;n++){
   const p=r.projects[n],row=config.rows[n];assert.equal(p.projectName,row.name);assert.equal(p.evaluatedFiscalYear,row.year);assert.equal(p.evaluationYear,null);
   assert.deepEqual(p.amounts,[]);assert.deepEqual(p.ratings,[]);
   for(const e of p.evidence){const t=e.sourceUrl===page.sourceUrl?page.text:i.text,m=e.cell!.match(/chars:([0-9]+)-([0-9]+)/)!;assert.equal(t.slice(+m[1],+m[2]),e.rawText);}
   assert.equal(reviewBungotakada({...i,text:i.text.replaceAll(row.yearProof,'年度未確認')},[page])!.projects.some(p=>p.projectName===row.name&&p.evaluatedFiscalYear===row.year),false);
  }
  assert.equal(reviewBungotakada({...i,truncated:true},[page])!.projects.length,0);
 }
 assert.equal(total,154);
 const r=reviewBungotakada(source('6d65f6bd72367705c6cfafff','44209'),[])!;
 assert.deepEqual(r.projects.map(p=>p.evaluatedFiscalYear),[2023,2024,2024]);
 assert.equal(r.projects.filter(p=>p.projectName==='定額減税補足給付金事業費（調整給付）').length,1);
 assert.ok(!r.projects.some(p=>p.projectName.includes('こども加算')));
});
test('Taketa separates completed annual records from twelve carryovers and one duplicate funding portion',async()=>{
 const {reviewTaketaR2}=await import('../src/evaluations/expansion/descending-taketa-r2');const i=source('e9c37ebb6e49f39f69d90fe2','44208'),r=reviewTaketaR2(i)!;
 assert.equal(r.projects.length,3);assert.equal(r.units.length,16);assert.equal(r.units.filter(u=>u.status==='annual_identity_hold').length,12);
 assert.equal(r.projects.filter(p=>p.projectName.startsWith('学校給食費')).length,1);
 for(const p of r.projects){assert.equal(p.evaluatedFiscalYear,2025);assert.equal(p.evaluationYear,null);assert.deepEqual(p.amounts,[]);for(const e of p.evidence){const m=e.cell!.match(/chars:([0-9]+)-([0-9]+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}}
 assert.equal(reviewTaketaR2({...i,truncated:true})!.projects.length,0);
 assert.equal(reviewTaketaR2({...i,text:i.text.replaceAll('R8.3.31','期間未確認')})!.projects.length,0);
});
test('Taketa education accepts reviewed actual-year name columns and excludes examples, future sections and incomplete titles',async()=>{
 const {reviewTaketaR2}=await import('../src/evaluations/expansion/descending-taketa-r2');
 for(const [id,count,year]of [['f52f36a7b89f74bb4b36c809',27,2020],['bacbcb79d5dc5973075dd25d',42,2021],['1606322c525a744832c7ca00',60,2025]] as const){const i=source(id,'44208'),r=reviewTaketaR2(i)!;assert.equal(r.projects.length,count);assert.ok(r.units.some(u=>u.status===(year===2025?'individual_identity_hold':'layout_review')));for(const p of r.projects){assert.equal(p.evaluatedFiscalYear,year);assert.equal(p.evaluationYear,null);assert.deepEqual(p.amounts,[]);assert.deepEqual(p.ratings,[]);assert.ok(!['市内高等学校の存続','竹田中央学','学校の働き'].includes(p.projectName));for(const e of p.evidence){const m=e.cell!.match(/chars:([0-9]+)-([0-9]+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}}assert.equal(reviewTaketaR2({...i,truncated:true})!.projects.length,0);assert.equal(reviewTaketaR2({...i,text:i.text.replaceAll('年度対象','対象不明')})!.projects.length,0);}
});
test('Taketa manually reviewed interleaved rows require exact full-source hashes',async()=>{
 const {reviewTaketaR2}=await import('../src/evaluations/expansion/descending-taketa-r2');
 for(const [id,remaining]of [['f52f36a7b89f74bb4b36c809',5],['bacbcb79d5dc5973075dd25d',11],['1606322c525a744832c7ca00',16]] as const){const i=source(id,'44208');assert.equal(reviewTaketaR2({...i,text:i.text+'\nCHANGED'})!.projects.length,remaining);}
});
test('Bungotakada named KPI activities retain actual-column years, screen grant aliases and repeat rows, and fail closed on changed sources',async()=>{
 const {reviewBungoKpi}=await import('../src/evaluations/expansion/descending-bungotakada-kpi');const ids=['1954fd2f3956a0d25104ade4','0137b2aa2c7d024f32757bfa','2de21b4188e88a177e2f8a07','fd5c1cde2c0894e2d9fb8cf5'];let total=0;
 for(let n=0;n<ids.length;n++){const i=source(ids[n],'44209'),r=reviewBungoKpi(i)!;assert.equal(r.projects.length,n===0?100:50);total+=r.projects.length;assert.equal(r.projects.filter(p=>p.projectName==='乳幼児健康診査の実施').length,n===0?2:1);assert.ok(r.units.some(u=>u.status==='individual_identity_hold'));assert.ok(!r.projects.some(p=>p.projectName.includes('運動推進員')));for(const p of r.projects){assert.ok((n===0?[2020,2021]:[2021+n]).includes(p.evaluatedFiscalYear!));assert.equal(p.evaluationYear,null);assert.deepEqual(p.amounts,[]);assert.deepEqual(p.ratings,[]);for(const e of p.evidence){const m=e.cell!.match(/chars:([0-9]+)-([0-9]+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}}assert.equal(reviewBungoKpi({...i,truncated:true})!.projects.length,0);assert.equal(reviewBungoKpi({...i,text:i.text+'changed'})!.projects.length,0);}assert.equal(total,250);
});
