import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractChigasaki } from '../src/evaluations/expansion/chigasaki';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const sourceId='c461260f8903dc6aa3fa0fa2';
const doc=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${sourceId}.json`,import.meta.url),'utf8'));
const input:CachedInput={municipalityCode:'14207',municipalityName:'茅ヶ崎市',sourceId,sourceUrl:doc.sourceUrl,sourcePageUrl:doc.sourceUrl,
 sourceSha256:doc.sourceSha256,fetchedAt:'2026-10-12T00:00:00Z',format:'pdf',text:doc.text,truncated:doc.truncated};
test('Chigasaki uses only actual complete sheets and leaves damaged costs unknown',()=>{
 const records=extractChigasaki(input);
 assert.equal(records.length,13);
 assert.equal(new Set(records.map(p=>p.id)).size,13);
 assert.equal(records[0].projectName,'デジタル化推進事業（電子申請の推進）');
 assert.equal(records[0].department,'企画政策部デジタル推進課');
 assert(records[0].activities?.includes('非対面・非来庁型行政サービス'));
 assert(records.every(p=>p.evaluationYear===null&&p.evaluatedFiscalYear===2024&&p.amounts.length===0&&p.ratings.length===0&&p.indicators.length===0));
 assert(records.some(p=>p.projectName==='公共下水道施設の地震対策事業'));
 assert(!records[2].evidence[0].rawText.includes('都市経済分科会'));
 for(const p of records)for(const e of p.evidence){
  const pos=e.cell!.match(/chars:(\d+)-(\d+)$/)!;
  assert.equal(input.text.slice(Number(pos[1]),Number(pos[2])),e.rawText);
 }
});
test('Chigasaki excludes contents alone and rejects truncated input',()=>{
 assert.deepEqual(extractChigasaki({...input,text:input.text.split('令和 6年度決算事業評価シート')[0]}),[]);
 assert.deepEqual(extractChigasaki({...input,truncated:true}),[]);
});
