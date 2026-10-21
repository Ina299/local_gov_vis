import {extractNanjoSupplement} from '../src/evaluations/expansion/nanjo-supplement';
import {extractHigashimatsuyamaSupplement} from '../src/evaluations/expansion/higashimatsuyama-supplement';
import {extractLongPolicyNarratives} from '../src/evaluations/expansion/long-policy-narratives';
import {extractBifukaSupplement} from '../src/evaluations/expansion/bifuka-supplement';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import type {CachedInput} from '../src/evaluations/expansion/shared';
import {extractIiyamaSupplement} from '../src/evaluations/expansion/iiyama-supplement';
import {extractBizenSupplement} from '../src/evaluations/expansion/bizen-supplement';
const base=new URL('../../web/public/evaluation-evidence/',import.meta.url);
function input(code:string,id:string):CachedInput{const m=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,base),'utf8'));const s=m.sources.find((x:{id:string})=>x.id===id),d=JSON.parse(readFileSync(new URL(s.text.assetPath,base),'utf8'));return {...d,municipalityName:m.municipalityName,format:s.format,sourcePageUrl:s.url,fetchedAt:s.acquisition.fetchedAt};}
test('Iiyama lower project rows keep their own grade and merge cross-policy repeats',()=>{
 const i=input('20213','62b0edf529be9aa26e70329e'),p=extractIiyamaSupplement(i);assert.equal(p.length,288);
 assert.equal(p.filter(x=>x.projectName==='起業支援ネットワーク推進事業').length,1);
 assert.ok(p.find(x=>x.projectName==='地方公営企業法適用事業'));
 assert.equal(p.find(x=>x.projectName==='ヘルスツーリズム推進事業')?.ratings[0].value,'廃止');
 assert.ok(p.every(x=>x.amounts.length===0&&x.evaluatedFiscalYear===null));
 assert.ok(p.every(x=>x.evidence.every(e=>i.text.includes(e.rawText))));
});
test('Bizen explicit named external opinions do not inherit policy scores',()=>{
 for(const [id,count]of[['b8fb59a2b3d0df5359a588da',2],['d52a90ef5a57869f1622c3f4',1]] as const){const i=input('33211',id),p=extractBizenSupplement(i);assert.equal(p.length,count);assert.ok(p.every(x=>!x.ratings.length&&!x.amounts.length&&x.outcomes?.startsWith('○'+x.projectName)));}
});

test('Bifuka uses individual numbered rows with the explicit R7 actual unit',()=>{const i=input('01469','80545387968c1eae1ca1ce8e'),p=extractBifukaSupplement(i);assert.equal(p.length,160);assert.equal(new Set(p.map(x=>x.projectCode)).size,p.length);assert.equal(p.find(x=>x.projectCode==='501')?.amounts[0].amountYen,491000);assert.ok(p.every(x=>x.evaluatedFiscalYear===2025&&x.evaluationYear===2026));});

test('Future plan preserves only identified baseline sections without assigning a baseline year',()=>{const i=input('11212','e0ca82deec4a2f47956c2a94'),p=extractHigashimatsuyamaSupplement(i);assert.equal(p.length,142);assert.ok(p.every(x=>x.evaluationYear===null&&x.evaluatedFiscalYear===null&&!x.amounts.length));assert.ok(p[0].outcomes?.includes('81 82 83'));});
test('Named policy activities never inherit policy expense or ratings',()=>{for(const [code,id,n]of [['10212','6cd3ca67426e099f3e30f646',4],['34213','3b7bcc5bf438c38595c122d2',3],['23201','a4eb0c63504dde9d9c73dfbc',6],['40220','cad775d4c7546b1e5fa8ebc2',2]] as const){const i=input(code,id),p=extractLongPolicyNarratives(i);assert.equal(p.length,n);assert.ok(p.every(x=>!x.amounts.length&&!x.ratings.length&&x.evidence.every(e=>i.text.includes(e.rawText))));}});

test('Nanjo restores all 138 reviewed wrapped names and keeps the official target-year proof',()=>{
 const i=input('47215','c23908edb38521c016e3db42'),y=input('47215','128eb1f16986f62fd6ae073f'),p=extractNanjoSupplement(i,[i,y]);assert.equal(p.length,138);assert.equal(new Set(p.map(x=>x.projectName)).size,138);
 assert.equal(p.find(x=>x.projectName==='海外移住者子弟研修生受入事業')?.ratings[0].value,'改善');assert.equal(p.find(x=>x.projectName==='JICA草の根技術協力事業')?.ratings[0].value,'廃止・休止');assert.ok(p.every(x=>x.evaluatedFiscalYear===2018&&x.evaluationYear===null&&x.ratings.length===2&&!x.amounts.length));
 assert.ok(extractNanjoSupplement(i).every(x=>x.evaluatedFiscalYear===null));
 assert.ok(p.every(x=>x.evidence.every(e=>i.text.includes(e.rawText)||y.text.includes(e.rawText))));
});
