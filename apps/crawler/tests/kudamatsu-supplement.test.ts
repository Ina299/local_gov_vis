import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractKudamatsuSupplement} from '../src/evaluations/expansion/kudamatsu-supplement';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const base=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('municipalities/35207.json',base),'utf8'));
function input(id:string):CachedInput {const s=m.sources.find((v:{id:string})=>v.id===id),d=JSON.parse(readFileSync(new URL(s.text.assetPath,base),'utf8'));return {...d,municipalityCode:'35207',municipalityName:'下松市',format:'pdf',fetchedAt:s.acquisition.fetchedAt,sourcePageUrl:s.url};}
const a=input('40a56fdbdc97f4511aaf6b58'),b=input('fddde15ac653716b65c70e5b');
test('Kudamatsu earlier years preserve complete numbered sheets, wrapped names, and explicit budget years',()=>{
 const x=extractKudamatsuSupplement(a),y=extractKudamatsuSupplement(b);assert.equal(x.length,34);assert.equal(y.length,32);
 assert.equal(x[10].projectName,'下松市カウンセリングルームや心の教室相談員の活用');assert.equal(y[10].projectName,'下松市カウンセリングルームやこころサポーターの活用');
 assert.ok(x.every(p=>p.evaluationYear===2024&&p.evaluatedFiscalYear===2023));assert.ok(y.every(p=>p.evaluationYear===2025&&p.evaluatedFiscalYear===2024));
 assert.deepEqual(x[0].amounts.map(v=>[v.fiscalYear,v.amountYen]),[[2022,264500000],[2023,532764000],[2024,134739000]]);
 assert.ok([...x,...y].every(p=>p.outcomes===null&&p.ratings.length===5&&p.amounts.every(a=>a.kind==='budget')));
 assert.deepEqual(extractKudamatsuSupplement(input('96c8caf4ee1bb3be4ed4097a')),[]);
});
test('Kudamatsu literal positions and incomplete last sheet',()=>{
 for(const source of [a,b])for(const p of extractKudamatsuSupplement(source))for(const e of [...p.evidence,...p.amounts.map(a=>a.evidence),...p.ratings.map(r=>r.evidence)]){const q=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(source.text.slice(+q[1],+q[2]),e.rawText);}
 assert.equal(extractKudamatsuSupplement({...a,truncated:true}).length,33);
});
