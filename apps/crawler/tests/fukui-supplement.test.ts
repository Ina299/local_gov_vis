import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {test} from 'node:test';
import {extractFukuiSupplement as extract} from '../src/evaluations/expansion/fukui-supplement';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const base=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const source=JSON.parse(readFileSync(new URL('documents/22c4a80f54e271119a010fa7.json',base),'utf8'));
const input:CachedInput={...source,municipalityName:'福井市',format:'pdf',sourcePageUrl:source.sourceUrl,fetchedAt:'2026-10-11T00:00:00Z'};
test('Fukui named lower-level business outcomes, not the 32 policy headings',()=>{
 const rows=extract(input);assert.equal(rows.length,10);
 assert.ok(!rows.some(p=>p.projectName==='世代間交流事業の推進'));
 for(const p of rows){assert.equal(p.evaluatedFiscalYear,2017);assert.equal(p.evaluationYear,2018);assert.equal(p.amounts.length,0);assert.equal(p.indicators.length,0);assert.equal(p.ratings.length,0);for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(input.text.slice(+m[1],+m[2]),e.rawText);}}
 assert.equal(rows.find(p=>p.projectName==='窓ガラス飛散防止対策事業')!.outcomes,'窓ガラス飛散防止対策事業については、目標どおり小学校 13 校で工事が完了しました。');
 assert.ok(!rows.find(p=>p.projectName==='朝倉ゆめまるランチ事業')!.outcomes!.includes('和食給食'));
 assert.ok(!rows.find(p=>p.projectName==='学校体育館大規模改修事業')!.outcomes!.includes('プール'));
 assert.ok(!rows.find(p=>p.projectName==='高齢者人材活用派遣事業')!.outcomes!.includes('はつらつ'));
});
test('Fukui incomplete paragraph excluded rather than borrowing a later policy boundary',()=>{
 const stop=input.text.indexOf('休校のため、開催できない学校');
 const rows=extract({...input,text:input.text.slice(0,stop),truncated:true});
 assert.ok(!rows.some(p=>p.projectName==='親学講座開催事業'));
 assert.equal(extract({...input,sourceId:'unknown'}).length,0);
});
