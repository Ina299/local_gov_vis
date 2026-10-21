import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {extractMinamiaizu} from '../src/evaluations/expansion/minamiaizu';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const cases=[['0d03216c0ac7bcb733a49ea9',6],['0e6387c92ef6fbe12b8920c5',3],['30c231a79263b979323cd749',2],['42fcd6410cab6c3f1e0e1592',3],['55f1be92890692fdf85c669c',5],['55feffe3b2c4cd9982163410',5],['74f96b7cd8f8a4d65e0f26e1',5],['788e6e41f45aafba8d8825eb',3],['a4e0c36de3b614c9307d17be',6],['e0635c9ffc9d57daa29392ae',4],['ee0abd61496710d16d186e4b',3]] as const;
function load(id:string):CachedInput{const d=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));return {...d,format:'pdf',municipalityName:'南会津町',sourcePageUrl:d.sourceUrl,fetchedAt:'2026-10-13T00:00:00Z'};}
test('Minamiaizu extracts 45 detailed project blocks after policy evaluation, excluding blank slots',()=>{
 let total=0;let amounts=0;
 for(const[id,n]of cases){const input=load(id);const records=extractMinamiaizu(input);assert.equal(records.length,n,id);total+=records.length;
 for(const r of records){amounts+=r.amounts.length;assert.equal(r.evaluationYear,2021);assert.ok(!r.evidence[0].rawText.includes('施策全体'));assert.equal((r.evidence[0].rawText.match(/^事業費 /gm)??[]).length,1);for(const e of [...r.evidence,...r.amounts.map(a=>a.evidence)])assert.ok(input.text.includes(e.rawText));}}
 assert.equal(total,45);assert.equal(amounts,176);
 const first=extractMinamiaizu(load(cases[0][0]))[0];assert.equal(first.projectName,'南郷地区水道整備事業');assert.equal(first.amounts[1].amountYen,28960000);assert.equal(first.amounts[1].fiscalYear,2020);
 const future=extractMinamiaizu(load('55f1be92890692fdf85c669c'))[1];assert.equal(future.evaluatedFiscalYear,null);assert.ok(future.amounts.every(a=>a.kind==='budget'));
});
test('Minamiaizu does not infer a missing fiscal cell or treat policy-only text as an individual project',()=>{
 const input=load(cases[0][0]);assert.equal(extractMinamiaizu({...input,text:input.text.replace('事業費 71,200 28,960 12,500 25,200','事業費 71,200 12,500 25,200')})[0].amounts.length,0);
 assert.deepEqual(extractMinamiaizu({...input,text:input.text.split('12 施策を構成する事務事業')[0]}),[]);
 assert.deepEqual(extractMinamiaizu({...input,sourceId:'unreviewed'}),[]);
});
