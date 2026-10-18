import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractNagatoSupplement } from '../src/evaluations/expansion/nagato-supplement';
import { extractImizu } from '../src/evaluations/expansion/imizu';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const load=(id:string):CachedInput=>JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));
test('Nagato 2024 complete evaluated sheets preserve actual 2023 amounts and exclude truncated end',()=>{
 const d=load('057374058fcf0e556f7429de'),rs=extractNagatoSupplement(d);assert.equal(rs.length,128);assert.equal(new Set(rs.map(r=>r.id)).size,128);
 assert.equal(rs[0].amounts[0].amountYen,5750607);assert.ok(rs.every(r=>r.evaluationYear===2024&&r.evaluatedFiscalYear===2023&&r.amounts[0]?.kind==='actual'));
 assert.ok(!rs.some(r=>r.projectName==='地籍調査事業'));for(const r of rs)for(const e of [...r.evidence,...r.amounts.map(x=>x.evidence)])assert.ok(d.text.includes(e.rawText));
});
test('Imizu detailed project blocks include absent department and omit truncated final project and table rows',()=>{
 const d=load('be9bd33d81027745ec21accb'),rs=extractImizu(d);assert.equal(rs.length,109);assert.equal(new Set(rs.map(r=>r.id)).size,109);
 assert.ok(rs.some(r=>r.projectName==='財産管理費'&&r.department===null));assert.ok(rs.some(r=>r.projectName==='斎場管理費'));assert.ok(rs.every(r=>r.amounts.length===0&&r.evaluatedFiscalYear===2024));
 for(const r of rs){assert.ok(d.text.includes(r.evidence[0].rawText));assert.equal((r.evidence[0].rawText.match(/^事業名 .+? （/gm)??[]).length,1);}
});
