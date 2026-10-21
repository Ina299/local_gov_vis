import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractOtakeSupplement} from '../src/evaluations/expansion/otake-supplement';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const base=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('municipalities/34211.json',base),'utf8'));
function input(id:string):CachedInput{const s=m.sources.find((x:{id:string})=>x.id===id),d=JSON.parse(readFileSync(new URL(s.text.assetPath,base),'utf8'));return {...d,municipalityCode:'34211',municipalityName:'大竹市',format:'pdf',fetchedAt:s.acquisition.fetchedAt,sourcePageUrl:s.url};}
const sources=['0437e4f6cf934dd01b44a942','c3f2597bc26ab3e6e821a8fe','787f9d1b5361e71cf1613d40'].map(input);
test('Otake joins continuation and repeated sections, excluding policy KPI tables and combined projects',()=>{
 const rows=sources.map(s=>extractOtakeSupplement(s));assert.equal(rows[0].length,15);
 const mother=rows[1].filter(p=>p.projectName==='母子保健事業');assert.equal(mother.length,1);assert.equal(mother[0].evidence.length,2);assert.match(mother[0].outcomes!,/妊産婦歯科健康診査/);
 assert.equal(rows[1].filter(p=>p.projectName==='こども医療費助成事業').length,1);
 assert.ok(rows.flat().every(p=>p.evaluatedFiscalYear===null&&p.evaluationYear===null&&p.amounts.length===0&&p.indicators.length===0));
 assert.ok(!rows.flat().some(p=>p.projectName.includes(' ・')));
 assert.deepEqual(extractOtakeSupplement(input('1163fa2aa83dd55bc49bc932')),[]);
});
test('Otake preserves exact evidence and excludes a truncated last section',()=>{
 for(const s of sources)for(const p of extractOtakeSupplement(s))for(const e of p.evidence){const q=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(s.text.slice(+q[1],+q[2]),e.rawText);}
 assert.equal(extractOtakeSupplement({...sources[0],truncated:true}).length,14);
});

test('Otake merges same business across policy sections while retaining both sources',()=>{
 const rows=sources.flatMap(s=>extractOtakeSupplement(s,sources));
 const found=rows.filter(p=>p.projectName==='医療体制整備事業');assert.equal(found.length,1);
 assert.match(found[0].outcomes!,/産科医/);assert.match(found[0].outcomes!,/救急医療/);
 assert.equal(new Set(found[0].evidence.map(e=>e.sourceUrl)).size,2);
 assert.equal(found[0].evaluatedFiscalYear,null);
});
