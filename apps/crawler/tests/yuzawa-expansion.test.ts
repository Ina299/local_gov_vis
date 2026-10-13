import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractYuzawa} from '../src/evaluations/expansion/yuzawa';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const base=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const municipality=JSON.parse(readFileSync(new URL('municipalities/15461.json',base),'utf8'));
function input(id:string):CachedInput {
 const s=municipality.sources.find((v:{id:string})=>v.id===id);
 const d=JSON.parse(readFileSync(new URL(s.text.assetPath,base),'utf8'));
 return {...d,municipalityCode:'15461',municipalityName:'湯沢町',sourcePageUrl:s.url,fetchedAt:s.acquisition.fetchedAt,format:'pdf'};
}
const source=input('f5424b734a5898e1fedca578');
test('Yuzawa extracts only complete single-line project rating fields, not flowing recommendations',()=>{
 const rows=extractYuzawa(source);
 assert.equal(rows.length,58);assert.equal(new Set(rows.map(p=>p.id)).size,58);
 for(const code of ['50','57','115','168','212'])assert.ok(!rows.some(p=>p.projectCode===code));
 assert.equal(rows[0].projectName,'Ｕ・Ｉターンのための賃貸住宅家賃等補助金');
 assert.equal(rows[0].department,'企画観光課 企画係');
 assert.equal(rows[0].ratings[0].value,'B 概ね達成');
 assert.ok(rows.every(p=>p.evaluationYear===2024&&p.evaluatedFiscalYear===null&&p.extractionStatus==='partial'));
 assert.ok(rows.every(p=>p.amounts.length===0&&p.indicators.length===0&&p.outcomes===null&&p.activities===null&&p.ratings.length===1));
 assert.ok(rows.every(p=>p.ratings[0].kind==='self'));
 assert.deepEqual(extractYuzawa(input('0cd15a56c5a9e67309ee3550')),[]);
});
test('Yuzawa exact evidence preserves source positions and rejects inconsistent grades and a cut-off final row',()=>{
 for(const p of extractYuzawa(source))for(const e of [...p.evidence,...p.ratings.map(r=>r.evidence)]){
 const m=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(source.text.slice(+m[1],+m[2]),e.rawText);assert.equal(e.sha256,source.sourceSha256);
 }
 const text=source.text.slice(0,source.text.indexOf('\n沢駅東口'));
 assert.equal(extractYuzawa({...source,text,truncated:true}).length,57);
 assert.equal(extractYuzawa({...source,text:source.text.replace('B 概ね達成 廃止','A 概ね達成 廃止')}).length,57);
 assert.deepEqual(extractYuzawa({...source,municipalityCode:'05207'}),[]);
});
