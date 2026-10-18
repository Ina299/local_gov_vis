import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractShimantoSupplement, extractShimantoSummarySupplement } from '../src/evaluations/expansion/shimanto-supplement';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const root = new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m = JSON.parse(readFileSync(new URL('municipalities/39412.json',root),'utf8'));
const s = m.sources.find((s:{id:string})=>s.id==='755fe25e7a7428c39d715bcb');
const d = JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));
const input:CachedInput = {...d,municipalityName:'四万十町',sourcePageUrl:s.url,sourceUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf'};
test('Shimanto R6 uses all complete individual sheets, correct fiscal years and actual costs',()=>{
 const rows=extractShimantoSupplement(input);assert.equal(rows.length,67);
 assert.deepEqual(rows.map(x=>x.projectCode),Array.from({length:67},(_,i)=>String(i+1)));
 assert.ok(rows.every(x=>x.evaluationYear===2024&&x.evaluatedFiscalYear===2023&&x.ratings.length===1));
 assert.equal(rows[0].amounts[0].amountYen,10526000);assert.equal(rows[3].amounts[0].amountYen,0);
 assert.equal(rows[4].amounts.length,0);assert.equal(rows[7].amounts.length,0);
 assert.ok(rows[21].warnings.some(x=>x.includes('共通費用')));assert.equal(rows[21].amounts.length,0);assert.equal(rows[31].amounts.length,0);
 assert.equal(rows[21].projectName,'観光交流拠点施設整備事業');assert.equal(rows[31].projectName,'松葉川温泉改修事業');
 const pattern=/【計画額】 27,484 27,484\n【実績額】 1,041 1,041/;
 assert.match(rows[21].evidence[0].rawText,pattern);assert.match(rows[31].evidence[0].rawText,pattern);
});
test('Shimanto supplement preserves exact evidence and refuses incomplete last sheet',()=>{
 for(const r of extractShimantoSupplement(input))for(const e of [...r.evidence,...r.amounts.map(x=>x.evidence),...r.ratings.map(x=>x.evidence)]){const q=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(input.text.slice(+q[1],+q[2]),e.rawText);}
 assert.equal(extractShimantoSupplement({...input,text:input.text.slice(0,input.text.lastIndexOf('- 事業番号 67 -')),truncated:true}).length,66);
 assert.deepEqual(extractShimantoSupplement({...input,sourceId:'6c150492b4c9efb9e907f56e'}),[]);
});

test('R4 result summary adds exactly three complete post-cutoff rows, not 56 repeated sheets',()=>{
 const src=m.sources.find((x:{id:string})=>x.id==='fec18b909939dd775cf2d8de');
 const doc=JSON.parse(readFileSync(new URL(src.text.assetPath,root),'utf8'));
 const q:CachedInput={...input,...doc,sourceId:src.id,sourceUrl:src.url,sourcePageUrl:src.url,sourceSha256:src.acquisition.sourceSha256};
 const rows=extractShimantoSummarySupplement(q);
 assert.deepEqual(rows.map(x=>x.projectName),['人材育成推進事業「未来塾」','人材育成推進事業「四万十塾」','人材育成推進事業「産業振興塾」']);
 assert.deepEqual(rows.map(x=>x.ratings[0].value),['A 改善して継続','A 改善して継続','E 改善して継続']);
 assert.ok(rows.every(x=>x.evaluationYear===2022&&x.evaluatedFiscalYear===2021&&x.amounts.length===0));
 for(const r of rows)for(const e of r.evidence){const v=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(q.text.slice(+v[1],+v[2]),e.rawText);}
});
