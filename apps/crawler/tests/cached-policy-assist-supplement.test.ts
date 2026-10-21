import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractMatsusakaSupplement } from '../src/evaluations/expansion/matsusaka-supplement';
import { extractMinamiashigaraPlanSupplement } from '../src/evaluations/expansion/minamiashigara-plan-supplement';
import type { CachedInput } from '../src/evaluations/expansion/shared';
function input(id:string): CachedInput {
 const d=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));
 return {...d,format:'pdf',sourcePageUrl:d.sourceUrl,fetchedAt:'2026-10-12T00:00:00Z',municipalityName:'fixture'};
}
test('Matsusaka retains only closed single-line business rows and keeps zero-budget identity separate',()=>{
 const d=input('afe3c327cc1563df042a0b57'),ps=extractMatsusakaSupplement(d);
 assert.equal(d.truncated,true);assert.equal(ps.length,50);assert.equal(new Set(ps.map(p=>p.id)).size,50);
 assert.equal(ps.filter(p=>p.projectName==='親子防災キャンプの実施').length,1);
 assert.equal(ps.find(p=>p.projectName==='親子防災キャンプの実施')?.projectCode,'防災対策課:zero:2');
 assert.ok(!ps.some(p=>p.projectName==='社会保障・税番号制度システム'));
 assert.ok(ps.every(p=>p.evaluationYear===null&&p.evaluatedFiscalYear===2024));
 const cut=d.text.indexOf('【広報広聴課】事務・事業管理シート');
 const tail=d.text.slice(0,cut)+'【広報広聴課】事務・事業管理シート\n'+d.text.slice(cut).split('\n').slice(1,9).join('\n');
 assert.equal(extractMatsusakaSupplement({...d,text:tail}).length,3);
 assert.deepEqual(extractMatsusakaSupplement({...d,text:d.text.replaceAll('令和６年度 令和７年度','令和５年度 令和６年度').replaceAll('令和6年度 令和7年度','令和5年度 令和6年度')}),[]);
});
test('Matsusaka final budgets are not initial budgets or actual costs; blanks are not zero',()=>{
 const ps=extractMatsusakaSupplement(input('afe3c327cc1563df042a0b57'));
 assert.equal(ps.filter(p=>p.amounts.length).length,44);
 assert.equal(ps.find(p=>p.projectName==='広報松阪発行事業')?.amounts[0].amountYen,29308000);
 assert.equal(ps.find(p=>p.projectName==='地域防災活動推進助成金')?.amounts[0].amountYen,933000);
 assert.equal(ps.find(p=>p.projectName==='親子防災キャンプの実施')?.amounts.length,0);
 assert.ok(ps.flatMap(p=>p.amounts).every(a=>a.kind==='budget'&&a.fiscalYear===2024));
});
test('Minamiashigara plan-period item ratings are distinct from broad policy ratings and annual results',()=>{
 const d=input('35bb75b0750a7331ec57c1e7'),ps=extractMinamiashigaraPlanSupplement(d);
 assert.equal(ps.length,10);assert.equal(new Set(ps.map(p=>p.id)).size,10);
 assert.ok(ps.every(p=>p.evaluationYear===null&&p.evaluatedFiscalYear===null&&p.amounts.length===0&&p.indicators.length===0));
 assert.ok(ps.some(p=>p.projectName==='市民音楽祭'));assert.ok(!ps.some(p=>p.projectName==='高齢者福祉の充実'));assert.ok(!ps.some(p=>p.projectName==='南足柄ふるさと学び塾の開講'||p.projectName==='公共施設の省エネルギー化'));assert.ok(ps.every(p=>p.evidence.length===3));
 assert.ok(!ps.some(p=>p.projectName.includes('幼児教育及び保育の内容')));
 assert.deepEqual(extractMinamiashigaraPlanSupplement({...d,truncated:true}),[]);
});
test('every project, rating and budget retains exact source substrings and character positions',()=>{
 for(const[id,run]of [['afe3c327cc1563df042a0b57',extractMatsusakaSupplement],['35bb75b0750a7331ec57c1e7',extractMinamiashigaraPlanSupplement]]as const){
  const d=input(id);for(const p of run(d))for(const e of [...p.evidence,...p.amounts.map(a=>a.evidence),...p.ratings.map(r=>r.evidence)]){
   const[a,b]=e.cell!.split(':').at(-1)!.split('-').map(Number);assert.equal(d.text.slice(a,b),e.rawText);
  }
 }
});
