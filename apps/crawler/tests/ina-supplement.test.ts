import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractInaSupplement} from '../src/evaluations/expansion/ina-supplement';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const base=new URL('../../web/public/evaluation-evidence/',import.meta.url);const m=JSON.parse(readFileSync(new URL('municipalities/11301.json',base),'utf8'));
const s=m.sources.find((x:{id:string})=>x.id==='ebcbb06ce4bc11a4b207d4a6'),d=JSON.parse(readFileSync(new URL(s.text.assetPath,base),'utf8'));
const input:CachedInput={...d,municipalityCode:'11301',municipalityName:'伊奈町',format:'pdf',sourcePageUrl:s.url,fetchedAt:s.acquisition.fetchedAt};
test('Ina distinct business opinions do not transfer policy-level grades or mixed budget columns',()=>{
 const rows=extractInaSupplement(input);assert.ok(rows.length>35);assert.equal(new Set(rows.map(p=>p.projectCode)).size,rows.length);
 const english=rows.find(p=>p.projectName==='英語検定促進事業')!;assert.equal(english.department,'学校教育課');assert.equal(english.ratings[0].value,'・英語力のさらなる向上に大きく期待するものです。');
 assert.equal(rows.filter(p=>p.projectName==='教育指導事業').length,1);
 assert.ok(rows.every(p=>p.evaluationYear===2025&&p.evaluatedFiscalYear===2024&&p.outcomes===null&&p.amounts.length===0&&p.indicators.length===0));
 assert.ok(rows.every(p=>p.ratings.every(r=>r.kind==='external'&&r.value.endsWith('。'))));
});
test('Ina literal evidence, wrong municipality and opinion-less input rejected',()=>{
 for(const p of extractInaSupplement(input))for(const e of [...p.evidence,...p.ratings.map(r=>r.evidence)]){const q=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(input.text.slice(+q[1],+q[2]),e.rawText);}
 assert.deepEqual(extractInaSupplement({...input,municipalityCode:'00000'}),[]);
 assert.deepEqual(extractInaSupplement({...input,text:input.text.replaceAll('【学識経験者の意見等】','【意見なし】')}),[]);
});
