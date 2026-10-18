import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractAnamizu } from '../src/evaluations/expansion/anamizu';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const d=JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/db67b3c69f9e1f7ffb47c1d6.json',import.meta.url),'utf8'));
const input:CachedInput={...d,format:'html',municipalityName:'穴水町',sourcePageUrl:d.sourceUrl,fetchedAt:'2026-10-13T00:00:00Z'};
test('Anamizu retains an actual HTML project evaluation, distinguishing deployment/year and revised target',()=>{
 const [r]=extractAnamizu(input);assert.ok(r);assert.equal(r.evaluationYear,null);assert.equal(r.evaluatedFiscalYear,2025);assert.equal(r.amounts.length,0);
 assert.deepEqual(r.indicators.map(i=>[i.fiscalYear,i.target,i.actual]),[[2023,'524','176'],[2024,null,'171'],[2025,null,'184']]);assert.ok(r.outcomes?.includes('計画は未達'));
 for(const e of [...r.evidence,...r.indicators.map(i=>i.evidence)])assert.ok(input.text.includes(e.rawText));
 assert.deepEqual(extractAnamizu({...input,municipalityCode:'17462'}),[]);
 assert.equal(extractAnamizu({...input,text:input.text.replace('176箇所\n171箇所\n184箇所','176箇所\n184箇所')})[0].indicators.length,0);
});
