import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractShowa } from '../src/evaluations/expansion/showa';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('municipalities/07446.json',root),'utf8'));
const s=m.sources.find((s:{id:string})=>s.id==='eac7acd689c8016ad16063ac');
const d=JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));
const input:CachedInput={municipalityCode:'07446',municipalityName:'昭和村',sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf',text:d.text,truncated:d.truncated};

test('Showa includes 21 actual individual sheets with separate fiscal-year costs and assessments',()=>{
 const rows=extractShowa(input);assert.equal(rows.length,21);assert.equal(new Set(rows.map(r=>r.id)).size,21);
 assert.equal(rows.reduce((n,r)=>n+r.amounts.length,0),42);assert.ok(rows.every(r=>r.ratings.length===2));
 assert.equal(rows[0].amounts[0].amountYen,16468000);assert.equal(rows[0].amounts[1].amountYen,17207000);
 assert.ok(rows.every(r=>r.amounts[0].fiscalYear===2022&&r.amounts[1].fiscalYear===2021));
 assert.ok(rows.every(r=>r.amounts.every(a=>a.kind==='actual')));
 assert.equal(rows.find(r=>r.projectCode==='1(2)①')!.amounts[0].amountYen,0);
 assert.ok(rows.every(r=>r.evaluationYear===2023&&r.evaluatedFiscalYear===2022));
 assert.equal(rows[0].ratings[0].value,'Ｃ');assert.equal(rows[0].ratings[1].value,'C');
});

test('Showa exact evidence survives column interleaving without inventing indicator values',()=>{
 for(const r of extractShowa(input)){
  assert.equal(r.indicators.length,0);
  for(const ev of [...r.evidence,...r.amounts.map(a=>a.evidence),...r.ratings.map(a=>a.evidence)]){
   const m=ev.cell!.match(/^extracted-text:chars:(\d+)-(\d+)$/)!;
   assert.equal(input.text.slice(Number(m[1]),Number(m[2])),ev.rawText);assert.equal(ev.sha256,input.sourceSha256);
  }
 }
});

test('Showa excludes trailing truncated and missing external evaluation sheets, not fills missing costs',()=>{
 assert.equal(extractShowa({...input,truncated:true}).length,20);
 assert.deepEqual(extractShowa({...input,municipalityCode:'10448'}),[]);
 assert.equal(extractShowa({...input,text:input.text.replace('外部評価 C 評価委員意見 特になし','未評価')}).length,20);
 const changed=input.text.replace('16,468 千円 17,207 千円','千円 17,207 千円');
 assert.equal(extractShowa({...input,text:changed})[0].amounts.length,0);
});
