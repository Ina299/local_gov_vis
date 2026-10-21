import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {extractRokunohe} from '../src/evaluations/expansion/rokunohe';
const d=JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/1125988243068b731e00f1c0.json',import.meta.url),'utf8'));
test('Rokunohe keeps 32 distinct school activity evaluations and excludes policy bundles and appendix',()=>{
 const rs=extractRokunohe(d);assert.equal(rs.length,32);assert.equal(new Set(rs.map(r=>r.id)).size,32);assert.ok(rs.every(r=>r.evaluationYear===2021&&r.evaluatedFiscalYear===2020));
 assert.equal(rs[0].projectName,'学校教育等協議会事業');assert.equal(rs.at(-1)?.projectName,'学校環境整備事業');assert.ok(rs.every(r=>!r.projectName.includes('社会教育推進体制')));
 for(const r of rs){assert.ok(d.text.includes(r.evidence[0].rawText));assert.ok(!r.outcomes?.includes('実施要綱'));}
});
