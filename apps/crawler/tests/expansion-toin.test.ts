import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractToin } from '../src/evaluations/expansion/toin';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const input:CachedInput=JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/15d69e494e3f07daf82237e8.json',import.meta.url),'utf8'));
test('Toin publishes 143 named results, excludes legend and resets department-local numbering',()=>{
 const rs=extractToin(input);assert.equal(rs.length,143);assert.equal(new Set(rs.map(r=>r.id)).size,143);
 assert.ok(rs.every(r=>r.evaluationYear===2019&&r.evaluatedFiscalYear===2018&&r.amounts.length===0));
 assert.equal(rs.filter(r=>r.ratings[0].value.startsWith('終了')).length,4);
 assert.equal(rs[0].department,'総務課');assert.equal(rs[0].projectName,'一般管理経費');
 for(const r of rs)for(const e of [...r.evidence,...r.ratings.map(x=>x.evidence)])assert.ok(input.text.includes(e.rawText));
 assert.deepEqual(extractToin({...input,municipalityCode:'24325'}),[]);
});
