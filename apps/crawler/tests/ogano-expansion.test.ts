import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractOgano } from '../src/evaluations/expansion/ogano';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const ids=['03478d09614082fe9c326578','5418cf985c1dbb8aa7390a00','8603a10b77c276024b138235','9969a860815b38480040d889','a7b6ad317f47e9d869736e96'];
const inputs:CachedInput[]=ids.map(id=>({...JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8')),municipalityName:'小鹿野町',sourcePageUrl:'https://www.town.ogano.lg.jp/',fetchedAt:'2026-10-11T18:22:02Z',format:'pdf'}));
test('Ogano identifies complete sheets, preserves wrapped name and excludes adjacent department text',()=>{
 const records=inputs.flatMap(extractOgano);
 assert.equal(records.length,127);
 assert.equal(new Set(records.map(p=>p.id)).size,127);
 assert.equal(records.find(p=>p.projectCode==='106')?.projectName,'小学校芸術鑑賞会実施事業（前 小学校合同事業実施事業）');
 assert.ok(records.every(p=>p.department&&!p.department.includes(' ')));
 assert.ok(records.every(p=>p.evaluationYear===2025&&p.evaluatedFiscalYear===null&&p.amounts.length===0));
 assert.equal(records.filter(p=>p.ratings.length).length,78);
 assert.ok(records.flatMap(p=>p.indicators).every(i=>i.actual===null&&i.target===null));
 for(const p of records)for(const e of [...p.evidence,...p.indicators.map(i=>i.evidence),...p.ratings.map(r=>r.evidence)]){
  const text=inputs.find(i=>i.sourceUrl===e.sourceUrl)!.text;
  const [a,b]=e.cell!.split(':').at(-1)!.split('-').map(Number);
  assert.equal(text.slice(a,b),e.rawText);
 }
});
test('Ogano rejects unsupported year and final truncated sheet',()=>{
 assert.equal(extractOgano({...inputs[0],text:inputs[0].text.replaceAll('評価年度 令和 7 年度','評価年度 令和 8 年度')}).length,0);
 assert.equal(extractOgano({...inputs[0],truncated:true}).length,extractOgano(inputs[0]).length-1);
});
