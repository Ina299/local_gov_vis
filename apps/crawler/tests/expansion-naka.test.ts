import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {extractNaka} from '../src/evaluations/expansion/naka';
const d=JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/e37268949319129dd4706386.json',import.meta.url),'utf8'));
test('Naka reconstructs wrapped names and groups identical department/name rows without policy identifiers',()=>{
 const rs=extractNaka(d);assert.equal(rs.length,158);assert.equal(rs.reduce((n,r)=>n+r.evidence.length,0),160);assert.equal(new Set(rs.map(r=>r.id)).size,158);
 assert.ok(rs.every(r=>r.evaluationYear===2025&&r.evaluatedFiscalYear===null&&r.projectCode===null));assert.ok(rs.some(r=>r.projectName==='いい那珂暮らし応援子育て世帯住宅取得助成事業'));
 for(const r of rs)for(const e of r.evidence)assert.ok(d.text.includes(e.rawText));
});
