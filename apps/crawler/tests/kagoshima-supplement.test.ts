import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractKagoshimaSupplement} from '../src/evaluations/expansion/kagoshima-supplement';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const base=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('municipalities/46201.json',base),'utf8'));
const s=m.sources.find((x:{id:string})=>x.id==='433454cefae4630ce2be53d4'),d=JSON.parse(readFileSync(new URL(s.text.assetPath,base),'utf8'));
const input:CachedInput={...d,municipalityCode:'46201',municipalityName:'鹿児島市',format:'pdf',sourcePageUrl:s.url,fetchedAt:s.acquisition.fetchedAt};
test('Kagoshima extracts 959 direction rows and excludes folded names and a deceptively complete folded department',()=>{
 const rows=extractKagoshimaSupplement(input);assert.equal(rows.length,959);assert.equal(new Set(rows.map(p=>p.id)).size,959);
 for(const code of ['25','112','145','211','272','317','326','786','803','812','813'])assert.ok(!rows.some(p=>p.projectCode===code));
 assert.equal(rows[0].projectName,'広報紙「市民のひろば」の発行');assert.equal(rows.at(-1)!.projectCode,'970');
 assert.ok(rows.every(p=>p.evaluationYear===null&&p.evaluatedFiscalYear===null&&p.amounts.length===0&&p.indicators.length===0&&p.outcomes===null));
 assert.equal(rows.find(p=>p.projectCode==='9')!.ratings[0].value,'Ｆ 廃止');
});
test('Kagoshima exact positions and isolated document guard',()=>{
 for(const p of extractKagoshimaSupplement(input))for(const e of [...p.evidence,...p.ratings.map(r=>r.evidence)]){const q=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(input.text.slice(+q[1],+q[2]),e.rawText);}
 assert.deepEqual(extractKagoshimaSupplement({...input,sourceId:'other'}),[]);
});
