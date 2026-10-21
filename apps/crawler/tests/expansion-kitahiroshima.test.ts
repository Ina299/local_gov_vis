import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {extractKitahiroshima} from '../src/evaluations/expansion/kitahiroshima';
const d=JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/9134792274da1a5a3ebb4dc8.json',import.meta.url),'utf8'));
test('Kitahiroshima extracts only seven named result examples without allocating aggregate totals',()=>{
 const rs=extractKitahiroshima(d);assert.equal(rs.length,7);assert.equal(rs.filter(r=>r.ratings[0].value==='要検討').length,5);assert.equal(rs.filter(r=>r.ratings[0].value==='見直し').length,2);
 assert.ok(rs.every(r=>r.evaluationYear===2025&&r.evaluatedFiscalYear===2024&&r.amounts.length===0));assert.equal(rs.at(-1)?.projectName,'都市公園整備事業');
 for(const r of rs)for(const e of [...r.evidence,...r.ratings.map(x=>x.evidence)])assert.ok(d.text.includes(e.rawText));
});
