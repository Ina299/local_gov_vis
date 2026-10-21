import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractMisawa} from '../src/evaluations/expansion/misawa';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const ids=['6466f1c6c8d7f2626137021f','b1259e07068f5376531635ad','b39705de64cf65777b664aec','e315ddeb274a8daf0768eb6f'];
const inputs:CachedInput[]=ids.map(id=>({...JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8')),municipalityName:'三沢市',format:'pdf',fetchedAt:'2026-10-13T00:00:00Z'}));
test('Misawa excludes wrapped identity fragments and preserves full-cost versus direct-cost distinction',()=>{
 const ps=inputs.flatMap(extractMisawa);assert.equal(ps.filter(p=>p.amounts.length).length,72);
 assert.ok(ps.every(p=>!['のコミュニティ21推進事業','デイセンター運営費','福祉計画・介護保険事業'].includes(p.projectName)));
 assert.ok(ps.flatMap(p=>p.amounts).every(a=>a.kind==='fullCost'));
 assert.ok(ps.some(p=>p.amounts.some(a=>a.amountYen===0)));
 assert.ok(ps.filter(p=>p.evaluatedFiscalYear===2008).every(p=>p.evaluationYear===null&&p.ratings.length===2));
 const distinct=ps.filter(p=>p.evaluatedFiscalYear===2010&&p.projectName==='家庭教育学級運営事業費');assert.equal(distinct.length,2);assert.notEqual(distinct[0].projectCode,distinct[1].projectCode);
});
test('Misawa exact quoted fields cannot borrow adjacent grades or omit the cost definition',()=>{
 for(const input of inputs)for(const p of extractMisawa(input))for(const e of [...p.evidence,...p.amounts.map(a=>a.evidence),...p.ratings.map(r=>r.evidence)]){
  const [a,b]=e.cell!.split(':').at(-1)!.split('-').map(Number);assert.equal(input.text.slice(a,b),e.rawText);
 }
 assert.equal(extractMisawa({...inputs[0],text:inputs[0].text.replaceAll('事業費（フルコスト）＝人件費＋直接経費（国庫支出金、一般財源ほか）','')}).length,0);
 assert.equal(extractMisawa({...inputs[0],municipalityCode:'00000'}).length,0);
});
