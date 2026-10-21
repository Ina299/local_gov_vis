import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {extractUonumaSupplement} from '../src/evaluations/expansion/uonuma-supplement';
const d=JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/cc8167f2bb866446322e06a2.json',import.meta.url),'utf8'));
test('Uonuma merges policy reprints into 83 additional project results without borrowing policy indicators',()=>{
 const rs=extractUonumaSupplement(d);assert.equal(rs.length,83);assert.equal(new Set(rs.map(r=>r.projectCode)).size,83);
 assert.ok(rs.every(r=>r.evaluationYear===2022&&r.evaluatedFiscalYear===2021&&r.amounts.length===0&&r.indicators.length===0));
 assert.ok(rs.find(r=>r.projectCode==='359')!.evidence.length>1);
 assert.ok(!rs.some(r=>['39','65','189'].includes(r.projectCode!)));
 for(const r of rs)for(const e of r.evidence){assert.ok(d.text.includes(e.rawText));assert.ok(!e.rawText.includes('4-1.成果指標'));}
 assert.deepEqual(extractUonumaSupplement({...d,sourceId:'cfcf90a2f8f4d9a15f11368c'}),[]);
});
