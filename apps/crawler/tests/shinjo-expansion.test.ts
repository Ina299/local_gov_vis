import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractShinjo} from '../src/evaluations/expansion/shinjo';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const input:CachedInput={...JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/9da444128dce380c6f9f5c06.json',import.meta.url),'utf8')),municipalityName:'新庄市',sourcePageUrl:'https://www.city.shinjo.yamagata.jp/',fetchedAt:'2026-10-11T00:00:00Z',format:'pdf'};
test('Shinjo preserves 26 individual identities and excludes incomplete wrapped indicator names',()=>{
 const ps=extractShinjo(input);assert.equal(ps.length,26);assert.equal(new Set(ps.map(p=>p.id)).size,26);
 assert.equal(ps[0].projectName,'最上広域婚活事業');assert.ok(ps.every(p=>p.amounts.length===0));
 assert.ok(!ps.flatMap(p=>p.indicators).some(i=>i.name==='【活動指標】受講者'||i.name.includes('充実している」と回答した市')));
 for(const p of ps)for(const e of [...p.evidence,...p.indicators.map(i=>i.evidence)]){
 const [a,b]=e.cell!.split(':').at(-1)!.split('-').map(Number);assert.equal(input.text.slice(a,b),e.rawText);
 }
});
test('Shinjo never publishes the final partial sheet',()=>{assert.equal(extractShinjo({...input,truncated:true}).length,25)});
