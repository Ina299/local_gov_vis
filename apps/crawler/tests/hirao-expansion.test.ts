import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractHirao} from '../src/evaluations/expansion/hirao';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const base=new URL('../../web/public/evaluation-evidence/',import.meta.url);const m=JSON.parse(readFileSync(new URL('municipalities/35344.json',base),'utf8'));
function input(id:string):CachedInput{const s=m.sources.find((x:{id:string})=>x.id===id),d=JSON.parse(readFileSync(new URL(s.text.assetPath,base),'utf8'));return {...d,municipalityName:'平生町',format:'pdf',sourcePageUrl:s.url,fetchedAt:s.acquisition.fetchedAt};}
const a=input('07c17b9c5dd1f35b462efbb9'),b=input('0e6ac7c20397f05a58cf2c86');
test('Hirao keeps unambiguous business rating rows without inheriting policy-level outcomes',()=>{
 const x=extractHirao(a),y=extractHirao(b);assert.equal(x.length,61);assert.equal(y.length,62);
 assert.ok([...x,...y].every(p=>p.ratings.length===2&&p.amounts.length===0&&p.indicators.length===0&&p.outcomes===null));
 assert.ok(x.every(p=>p.evaluatedFiscalYear===2025&&p.evaluationYear===null));assert.ok(y.every(p=>p.evaluatedFiscalYear===2024));
 assert.ok(!y.some(p=>p.projectName==='使用済小型家電機器リ'));assert.ok(!x.some(p=>p.projectName==='農林業の活性化'));
 const tax=x.find(p=>p.projectName==='ふるさと納税推進事業')!;assert.equal(tax.ratings[0].value,'C 課題が多くあり業務の大幅な見直しが必要');
});
test('Hirao literal evidence matches and cut-off final policy is not consumed',()=>{
 for(const s of [a,b])for(const p of extractHirao(s))for(const e of [...p.evidence,...p.ratings.map(r=>r.evidence)]){const q=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(s.text.slice(+q[1],+q[2]),e.rawText);}
 assert.equal(extractHirao({...a,truncated:true}).length,59);assert.deepEqual(extractHirao({...a,municipalityCode:'35343'}),[]);
});
