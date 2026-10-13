import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractIkoma } from '../src/evaluations/expansion/ikoma';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const sourceId='69bdd8b2f2ff0884bc669059';
const doc=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${sourceId}.json`,import.meta.url),'utf8'));
const input:CachedInput={municipalityCode:'29209',municipalityName:'生駒市',sourceId,sourceUrl:doc.sourceUrl,sourcePageUrl:doc.sourceUrl,
 sourceSha256:doc.sourceSha256,fetchedAt:'2026-10-12T00:00:00Z',format:'pdf',text:doc.text,truncated:doc.truncated};
test('Ikoma individual sheets retain policy-specific identity and never classify estimated actual as actual',()=>{
 const records=extractIkoma(input);
 assert.equal(records.length,17);
 const first=records[0];
 assert.equal(first.projectCode,'4-10');
 assert.equal(first.projectName,'講師不足対策');
 assert.equal(first.evaluatedFiscalYear,2024);
 assert.deepEqual(first.amounts.map(a=>[a.kind,a.fiscalYear,a.amountYen]),[['actual',2023,0],['budget',2024,216000],['budget',2025,68000]]);
 assert.equal(first.indicators[0].target,'150人');
 assert.equal(first.indicators[0].actual,'２３０人');
 assert(first.outcomes?.includes('年度内中に埋めることができた'));
 for(const p of records)for(const e of [...p.evidence,...p.amounts.map(a=>a.evidence),...p.indicators.map(i=>i.evidence),...p.ratings.map(r=>r.evidence)]){
  const pos=e.cell!.match(/chars:(\d+)-(\d+)$/)!;
  assert.equal(input.text.slice(Number(pos[1]),Number(pos[2])),e.rawText);
 }
});
test('Ikoma does not shift missing cost columns or accept truncated sheets',()=>{
 assert.deepEqual(extractIkoma({...input,truncated:true}),[]);
 const modified=input.text.replace('事業費（千円） 0 216 24 68','事業費（千円） 216 24 68');
 assert.equal(extractIkoma({...input,text:modified})[0].amounts.length,0);
 assert.deepEqual(extractIkoma({...input,text:'基本的施策４ 学校・教育\n事業一覧\n講師不足対策'}),[]);
});
test('Ikoma deduplicates source reprints without losing evidence and retains cost conflicts as unknown',()=>{
 const duplicate={...input,sourceId:'zz-copy',sourceUrl:input.sourceUrl+'?copy=1'};
 const records=extractIkoma(input,[input,duplicate]);
 assert.equal(records.length,17);
 assert.equal(extractIkoma(duplicate,[input,duplicate]).length,0);
 assert(records[0].evidence.some(e=>e.sourceUrl===duplicate.sourceUrl));
 assert.equal(records[0].amounts.length,3);
 const conflict={...duplicate,text:duplicate.text.replace('事業費（千円） 0 216 24 68','事業費（千円） 0 999 24 68')};
 const conflictRecords=extractIkoma(input,[input,conflict]);
 assert(!conflictRecords[0].amounts.some(a=>a.kind==='budget'&&a.fiscalYear===2024));
 assert(conflictRecords[0].warnings.some(w=>w.includes('競合')));
});
