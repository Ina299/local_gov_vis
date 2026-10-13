import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractMiyazaki } from '../src/evaluations/expansion/miyazaki';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const sourceId='00bffc12ac6d77d39d81192c';
const doc=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${sourceId}.json`,import.meta.url),'utf8'));
const input:CachedInput={municipalityCode:'45201',municipalityName:'宮崎市',sourceId,sourceUrl:doc.sourceUrl,sourcePageUrl:doc.sourceUrl,
 sourceSha256:doc.sourceSha256,fetchedAt:'2026-10-12T00:00:00Z',format:'pdf',text:doc.text,truncated:doc.truncated};
test('Miyazaki includes complete prospective evaluations and preserves planned costs without converting them',()=>{
 const records=extractMiyazaki(input);
 assert.equal(records.length,92);
 assert.equal(new Set(records.map(r=>r.id)).size,92);
 assert.equal(records[0].projectName,'地域公共交通利便増進実施計画策定事業');
 assert.equal(records[0].evaluationYear,2025);
 assert(records.every(r=>r.evaluatedFiscalYear===null&&r.amounts.length===0));
 assert.equal(records[0].ratings[0].value,'採択');
 assert(records.some(r=>r.ratings.some(x=>x.value==='不採択')));
 assert(records[0].evidence.some(e=>e.rawText.includes('総事業費（千円） (14,500)')));
 const project=records.find(r=>r.projectName==='つなぐみやざきサポート事業（重層的支援体制整備事業）')!;
 assert.equal(project.projectCode,'14562');
 assert(project.indicators.some(i=>i.name==='【成果指標】各機関へのつなぎ件数'&&i.fiscalYear===2026&&i.target==='20'&&i.actual===null));
 for(const r of records)for(const e of [...r.evidence,...r.indicators.map(i=>i.evidence),...r.ratings.map(x=>x.evidence)]){
  const pos=e.cell!.match(/chars:(\d+)-(\d+)$/)!;
  assert.equal(input.text.slice(Number(pos[1]),Number(pos[2])),e.rawText);
 }
});
test('Miyazaki does not shift missing target columns or accept other source identities',()=>{
 assert.deepEqual(extractMiyazaki({...input,sourceId:'other'}),[]);
 const changed=input.text.replace('目標値 20 24 28 32','目標値 20 28 32');
 const record=extractMiyazaki({...input,text:changed}).find(r=>r.projectCode==='14562')!;
 const indicators=record.indicators.filter(i=>i.name==='【成果指標】各機関へのつなぎ件数');
 assert.equal(indicators.length,1);
 assert.equal(indicators[0].target,null);
 assert.equal(indicators[0].fiscalYear,null);
});
