import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {extractFujikawa,extractFujikawa2019,extractFujikawa2013Subsidies} from '../src/evaluations/expansion/fujikawa';
test('Fujikawa uses final external result paragraphs, not internal ratings or repeated list rows',()=>{
 for(const [id,n,y]of [['25a96377ee851debf1af6fa7',8,2018],['2cb0bca7bc4c3a73e4c296b2',11,2013],['c5afc0ddbac4657b8eacc8bc',4,2015]] as const){
  const d=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));const rs=extractFujikawa(d);assert.equal(rs.length,n);assert.equal(new Set(rs.map(r=>r.id)).size,n);assert.ok(rs.every(r=>r.evaluationYear===y&&r.evaluatedFiscalYear===null&&r.amounts.length===0));
  for(const r of rs)assert.ok(d.text.includes(r.evidence[0].rawText));if(y===2013)assert.equal(rs[1].ratings[0].value,'Ｄ 廃止');
 }
});

test('Fujikawa subsidy results preserve final columns and school grouping',()=>{
 for(const [id,fn,count]of [['e61fc9452debe305b0c0669a',extractFujikawa2019,10],['c2999fc7e5eae048bc311cce',extractFujikawa2013Subsidies,23]] as const){
  const d=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));const rs=fn(d);assert.equal(rs.length,count);assert.equal(new Set(rs.map(r=>r.id)).size,count);for(const r of rs)for(const e of [...r.evidence,...r.ratings.map(x=>x.evidence)])assert.ok(d.text.includes(e.rawText));
  if(count===10){assert.equal(rs[2].ratings[0].value,'継続（一部改善）');assert.equal(rs[3].ratings[0].value,'縮小');}else{assert.equal(rs.find(r=>r.projectName==='ボランティア普及協力校補助金')?.ratings[0].value,'廃止');assert.ok(!rs.some(r=>r.projectName.includes('消防分団')));}
 }
});
