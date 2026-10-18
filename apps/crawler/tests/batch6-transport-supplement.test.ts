import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractBatch6TransportSupplement} from '../src/evaluations/expansion/batch6-transport-supplement';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const base=new URL('../../web/public/evaluation-evidence/',import.meta.url);
test('Transport evaluations preserve the single grant-evaluation unit and actual printed dates',()=>{
 for(const [code,id,year] of [['01345','cdb4cf909c6659d85653b7d7',2025],['38207','45e410a2fa2e347708177000',2022],['01461','e1a961c97f5e1d48f7ac2347',2018]] as const){
 const m=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,base),'utf8')),s=m.sources.find((x:{id:string})=>x.id===id),d=JSON.parse(readFileSync(new URL(s.text.assetPath,base),'utf8'));
 const input:CachedInput={...d,municipalityCode:code,municipalityName:m.municipalityName,format:'pdf',fetchedAt:s.acquisition.fetchedAt,sourcePageUrl:s.url};
 const rows=extractBatch6TransportSupplement(input);assert.equal(rows.length,1);assert.equal(rows[0].evaluationYear,year);assert.equal(rows[0].evaluatedFiscalYear,null);assert.equal(rows[0].amounts.length,0);assert.equal(rows[0].ratings[0].value,d.text);assert.deepEqual(extractBatch6TransportSupplement({...input,truncated:true}),[]);
 }
});
