import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{extractMarugame}from'../src/evaluations/expansion/marugame';import type{CachedInput}from'../src/evaluations/expansion/shared';
const sourceId='db0d1e8fda886d55fbade986';const d=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${sourceId}.json`,import.meta.url),'utf8'));
const input:CachedInput={municipalityCode:'37202',municipalityName:'丸亀市',sourceId,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-10-12T00:00:00Z',format:'pdf',text:d.text,truncated:d.truncated};
test('Marugame joins external opinions to same-number appendices without duplicating branches',()=>{
 const r=extractMarugame(input);assert.equal(r.length,10);assert.equal(new Set(r.map(p=>p.id)).size,10);assert(r.every(p=>p.evidence.length===2));
 assert.equal(r[7].ratings[0].value,'統合');assert.equal(r[0].projectCode,'1');assert(r.every(p=>p.evaluatedFiscalYear===null));
 assert(!r[9].evidence[0].rawText.includes('その他全般にわたる意見'));
 assert(r[7].amounts.some(a=>a.kind==='actual'&&a.fiscalYear===2009&&a.amountYen===5500000));
 for(const p of r)for(const e of [...p.evidence,...p.amounts.map(a=>a.evidence),...p.ratings.map(x=>x.evidence)]){const m=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(input.text.slice(Number(m[1]),Number(m[2])),e.rawText);}
});
test('Marugame rejects truncated inputs and does not shift incomplete finance columns',()=>{
 assert.deepEqual(extractMarugame({...input,truncated:true}),[]);
 const modified=input.text.replace('H21 5,500 5,500 0 0 0','H21 5,500 0 0 0');
 assert(!extractMarugame({...input,text:modified})[7].amounts.some(a=>a.kind==='actual'&&a.fiscalYear===2009));
});
