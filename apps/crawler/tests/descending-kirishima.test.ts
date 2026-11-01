import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {extractDescendingKirishima} from '../src/evaluations/expansion/descending-kirishima';
import type {CachedInput} from '../src/evaluations/expansion/shared';
function input(id='63514575b8ae64e8f55ec420'):CachedInput{
 const d=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));
 return {municipalityCode:'46218',municipalityName:'霧島市',sourceId:id,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-01-01T00:00:00Z',text:d.text,format:'pdf',truncated:false};
}
test('complete audited books contain 89 bounded individual sheets with literal fiscal identity',()=>{
 let count=0;
 for(const id of ['63514575b8ae64e8f55ec420','409e3e37fd9eaad20fbf9c37','973c0ab95506056694899e1b']){
  const i=input(id),ps=extractDescendingKirishima(i);count+=ps.length;
  for(const p of ps){assert.equal(p.evaluatedFiscalYear,2025);assert.equal(p.evaluationYear,null);assert.deepEqual(p.amounts,[]);assert.deepEqual(p.ratings,[]);for(const e of p.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)/)!;assert.equal(i.text.slice(+m[1],+m[2]),e.rawText);}}
 }assert.equal(count,89);
});
test('missing footer or explicit results-year label does not produce the affected sheet',()=>{
 const i=input();assert.equal(extractDescendingKirishima({...i,text:i.text.replaceAll('② コスト（予算）の方向性','')}).length,0);
 assert.equal(extractDescendingKirishima({...i,text:i.text.replaceAll('４．令和7年度の実績・成果','４．実績・成果')}).length,0);
});
test('wrong attribution, source or incomplete cached text cannot be parsed',()=>{
 const i=input();for(const patch of [{municipalityCode:'46219'},{sourceId:'unknown'},{truncated:true}])assert.deepEqual(extractDescendingKirishima({...i,...patch}),[]);
});
