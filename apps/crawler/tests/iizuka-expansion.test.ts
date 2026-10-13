import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractIizuka} from '../src/evaluations/expansion/iizuka';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('municipalities/40205.json',root),'utf8'));
const inputs:CachedInput[]=m.sources.filter((s:{format:string;text:{assetPath:string}})=>s.format==='pdf'&&s.text.assetPath).map((s:{id:string;url:string;text:{assetPath:string};acquisition:{sourceSha256:string;fetchedAt:string}})=>{
 const d=JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));return {municipalityCode:'40205',municipalityName:'飯塚市',sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf',text:d.text,truncated:d.truncated};
});
test('Iizuka includes 37 distinct completed sheets, preserving assessed year rather than creation date',()=>{
 const rows=inputs.flatMap(extractIizuka);assert.equal(rows.length,37);assert.equal(new Set(rows.map(r=>r.projectCode)).size,37);
 assert.ok(rows.every(r=>r.evaluatedFiscalYear===2023&&r.evaluationYear===null));
 assert.equal(rows.reduce((n,r)=>n+r.amounts.length,0),160);assert.equal(rows.filter(r=>r.amounts.length).length,32);
 assert.equal(rows.reduce((n,r)=>n+r.indicators.length,0),73);assert.equal(rows.filter(r=>r.indicators.length).length,30);
 const old=rows.find(r=>r.projectCode==='221-13')!;
 assert.deepEqual(old.amounts.map(a=>[a.kind,a.fiscalYear,a.amountYen]),[['personnel',2022,937000],['personnel',2023,1272000],['actual',2022,77000],['actual',2023,182000],['budget',2024,616000],['fullCost',2022,1014000],['fullCost',2023,1454000]]);
 assert.equal(old.indicators[0].actual,'1');assert.equal(old.indicators[1].actual,'0');assert.equal(old.indicators[1].target,'0');
 assert.ok(rows.every(r=>r.indicators.every(i=>i.fiscalYear===2022||i.fiscalYear===2023)));
});
test('Iizuka evidence covers exact costs and indicators, and rejects missing columns or truncated inputs',()=>{
 for(const input of inputs)for(const r of extractIizuka(input))for(const e of [...r.evidence,...r.amounts.map(a=>a.evidence),...r.indicators.map(a=>a.evidence)]){
 const q=e.cell!.match(/^extracted-text:chars:(\d+)-(\d+)$/)!;assert.equal(input.text.slice(Number(q[1]),Number(q[2])),e.rawText);assert.equal(e.sha256,input.sourceSha256);}
 const old=inputs.find(i=>i.sourceId==='02dca088713ec6500f0c3f19')!;
 assert.deepEqual(extractIizuka({...old,truncated:true}),[]);
 assert.deepEqual(extractIizuka({...old,municipalityCode:'00000'}),[]);
 const changed=old.text.replace('直接事業費（Ｂ） 77 182 616','直接事業費（Ｂ） 77 616');
 assert.ok(extractIizuka({...old,text:changed})[0].amounts.every(a=>a.kind!=='actual'&&a.kind!=='budget'));
});
test('Iizuka never borrows following inline-name KPI values and flags literal unit anomalies',()=>{
 const exhibition=inputs.find(i=>i.sourceId==='fc8cbdde7cbfdc9c9cd92f65')!;
 const withoutFirst=exhibition.text.replace('実 績 5,230 4,643','実 績');
 const rows=extractIizuka({...exhibition,text:withoutFirst});
 assert.ok(!rows[0].indicators.some(i=>i.name==='【成果指標】入館者数'));
 const childcare=extractIizuka(inputs.find(i=>i.sourceId==='830c114c5f3e707653c1446a')!)[0];
 assert.ok(childcare.warnings.some(w=>w.includes('原文単位は「1」')));
 const development=extractIizuka(inputs.find(i=>i.sourceId==='e119f248c0d38e0e784e5885')!)[0];
 assert.ok(development.warnings.some(w=>w.includes('名称が件数、原文単位が百分率')));
});
