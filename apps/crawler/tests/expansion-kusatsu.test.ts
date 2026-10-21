import assert from 'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';import test from'node:test';import{extractKusatsu}from'../src/evaluations/expansion/kusatsu';
const dir=new URL('../../web/public/evaluation-evidence/documents/',import.meta.url);
const inputs=readdirSync(dir).filter(n=>n.endsWith('.json')).flatMap(n=>{const d=JSON.parse(readFileSync(new URL(n,dir),'utf8'));return d.municipalityCode==='25206'?[{...d,format:'pdf' as const}]:[];});
test('Kusatsu 295 major-business units across complete/split sources, no repeated policy-list duplicates',()=>{
 const rs=inputs.flatMap(d=>extractKusatsu(d,inputs));assert.equal(rs.length,295);assert.equal(new Set(rs.map(r=>r.id)).size,295);assert.ok(rs.every(r=>r.evaluationYear===2026&&r.evaluatedFiscalYear===2025&&r.amounts.length===0));
 assert.equal(rs.filter(r=>r.projectName==='浄水場施設管理事業').length,2);assert.equal(rs.filter(r=>r.projectName==='生活支援体制整備事業').length,1);assert.equal(rs.filter(r=>r.projectName==='弾正公園運営事業').length,1);assert.ok(rs.some(r=>r.projectName==='新生児訪問事業（すこやか訪問事業（1回目））'));assert.ok(!rs.some(r=>r.projectName==='男女共同参画社会の推進'));
 for(const r of rs)for(const e of r.evidence)assert.ok(inputs.some(d=>d.text.includes(e.rawText)));
 assert.equal(extractKusatsu(inputs.find(d=>d.sourceId==='30738c19de6da455a324b42c')!,inputs).length,0);
});
