import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {test} from 'node:test';
import {extractSaiSupplement} from '../src/evaluations/expansion/sai-supplement';import {extractMiharuSupplement} from '../src/evaluations/expansion/miharu-supplement';import type {CachedInput} from '../src/evaluations/expansion/shared';
const base=new URL('../../web/public/evaluation-evidence/',import.meta.url);
function input(code:string,id:string):CachedInput{const m=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,base),'utf8')),s=m.sources.find((x:{id:string})=>x.id===id);return {...JSON.parse(readFileSync(new URL(s.text.assetPath,base),'utf8')),municipalityCode:code,municipalityName:m.municipalityName,format:'pdf',fetchedAt:s.acquisition.fetchedAt,sourcePageUrl:s.url};}
test('education supplements exclude headings and retain evidence',()=>{
 for(const [s,fn]of [[input('02426','b4a1949692f9aa08f6d91cde'),extractSaiSupplement],[input('07521','c16dd8c5214a3a513d2167a2'),extractMiharuSupplement]] as const){const rows=fn(s);console.log(s.municipalityCode,rows.length,rows.map(p=>p.projectName));assert.ok(rows.length>5);assert.ok(rows.every(p=>!p.projectName.includes('・・')));for(const p of rows)for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(s.text.slice(+m[1],+m[2]),e.rawText);}}
 const sai=extractSaiSupplement(input('02426','b4a1949692f9aa08f6d91cde'));assert.equal(sai[0].evaluatedFiscalYear,2023);assert.ok(sai.some(p=>p.amounts.some(a=>a.kind==='actual')));assert.ok(!sai.some(p=>p.projectName==='教育振興事業'));
});
