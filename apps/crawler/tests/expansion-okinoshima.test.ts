import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {extractOkinoshima} from '../src/evaluations/expansion/okinoshima';
const d=JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/a69309985f3ab992cefbb676.json',import.meta.url),'utf8'));
test('Okinoshima uses 16 individual evaluation units rather than summary counts or component schools',()=>{
 const rs=extractOkinoshima(d);assert.equal(rs.length,16);assert.ok(rs.every(r=>r.evaluationYear===2025&&r.evaluatedFiscalYear===2024&&r.ratings.length===1));assert.equal(rs.filter(r=>r.ratings[0].value==='現状維持').length,12);assert.equal(rs.filter(r=>r.ratings[0].value==='手法・内容の見直し').length,4);
 assert.ok(rs.some(r=>r.projectName==='小学校一般管理運営事業・中学校一般管理運営事業'));for(const r of rs)for(const e of [...r.evidence,...r.ratings.map(x=>x.evidence)])assert.ok(d.text.includes(e.rawText));
});
