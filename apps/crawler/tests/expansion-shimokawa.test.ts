import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {extractShimokawa} from '../src/evaluations/expansion/shimokawa';
const d=JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/a7613ca56e9a7ffb5fa6adc8.json',import.meta.url),'utf8'));
test('Shimokawa names project opinions, excludes policy headings and out-of-scope appendix',()=>{
 const rs=extractShimokawa(d);assert.equal(rs.length,18);assert.equal(new Set(rs.map(r=>r.id)).size,18);
 assert.ok(rs.every(r=>r.evaluationYear===2025&&r.evaluatedFiscalYear===2024&&r.amounts.length===0));
 assert.equal(rs.filter(r=>r.warnings.some(w=>w.startsWith('二つ'))).length,2);
 for(const r of rs){assert.ok(d.text.includes(r.evidence[0].rawText));assert.ok(!r.outcomes?.includes('その他'));assert.ok(!r.outcomes?.includes('施策項目'));}
});
