import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {extractNarita} from '../src/evaluations/expansion/narita';
const d=JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/145f1cb5d278de6ca3ae42fb.json',import.meta.url),'utf8'));
test('Narita 525 final result rows match independently published aggregate counts, preserving absolute codes',()=>{
 const rs=extractNarita(d);assert.equal(rs.length,525);assert.equal(new Set(rs.map(r=>r.projectCode)).size,525);assert.ok(rs.every(r=>r.evaluationYear===2025&&r.evaluatedFiscalYear===2024));
 assert.deepEqual(rs.reduce<Record<string,number>>((a,r)=>{const v=r.ratings[0].value;a[v]=(a[v]??0)+1;return a;},{}),{'維持継続':460,'拡大':18,'事業統合':19,'縮小':2,'休止':1,'廃止':2,'終了':13,'改善・見直し':10});
 assert.ok(rs.some(r=>r.projectName==='はり、きゅう、マッサージ等施設利用者助成事業'));for(const r of rs)assert.ok(d.text.includes(r.evidence[0].rawText));
});
