import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{test}from'node:test';import{extractTottoriSupplement,extractTottoriNamedRowsSupplement}from'../src/evaluations/expansion/tottori-supplement';import type{CachedInput}from'../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);const m=JSON.parse(readFileSync(new URL('municipalities/31201.json',root),'utf8'));
function input(id:string):CachedInput{const s=m.sources.find((s:{id:string})=>s.id===id);return{...JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8')),municipalityName:'鳥取市',sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf'};}
test('Tottori has three exact independent row ranges and no inferred mixed-column measures',()=>{const a=input('43dfc00aa28447790b90d114'),b=input('d47448c3a34cd744cee3a612');const r=[...extractTottoriSupplement(a),...extractTottoriSupplement(b)];assert.deepEqual(r.map(x=>x.projectName),['消費生活対策費','国際交流費','国内都市交流総合推進費']);assert.ok(r.every(x=>x.evaluatedFiscalYear===2024&&x.evaluationYear===null&&x.amounts.length===0&&x.indicators.length===0));assert.ok(!r[1].evidence[0].rawText.includes('郡山市'));assert.ok(!r[2].evidence[0].rawText.includes('ハーナウ'));for(const s of[a,b])for(const p of extractTottoriSupplement(s))for(const e of p.evidence){const c=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(s.text.slice(+c[1],+c[2]),e.rawText);}assert.deepEqual(extractTottoriSupplement({...a,truncated:true}),[]);});

test('Tottori named rows preserve exact name cells, suppress reprints and never split mixed columns',()=>{
 const rows=m.sources.flatMap((s:{id:string})=>extractTottoriNamedRowsSupplement(input(s.id)));
 assert.equal(rows.length,151);assert.equal(new Set(rows.map((p:any)=>p.projectName)).size,151);
 assert.ok(rows.every((p:any)=>p.evaluatedFiscalYear===2024&&p.evaluationYear===null&&p.amounts.length===0&&p.indicators.length===0));
 assert.ok(!rows.some((p:any)=>p.projectName==='港整備推進事業費'||p.projectName.startsWith('を')));
 for(const source of m.sources){const i=input(source.id);for(const row of extractTottoriNamedRowsSupplement(i)){
  assert.ok(row.evidence[0].rawText.includes(row.projectName));
  for(const e of row.evidence){const c=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(i.text.slice(+c[1],+c[2]),e.rawText);}
 }}
 const i=input('0153367cc8c6dd80c1f14aa4');assert.deepEqual(extractTottoriNamedRowsSupplement({...i,truncated:true}),[]);
 assert.ok(!extractTottoriNamedRowsSupplement({...i,text:i.text.replace('物産振興体制強化事業費','別の名称')}).some(p=>p.projectName==='物産振興体制強化事業費'));
});

test('Tottori reprints add source evidence to one selected row',()=>{const first=input('0153367cc8c6dd80c1f14aa4'),second=input('0a02946a0ed9c34f8fef2b11');const r=extractTottoriNamedRowsSupplement(first,[first,second]);const p=r.find(x=>x.projectName==='関係人口推進事業費')!;assert.equal(p.evidence.length,3);assert.ok(p.evidence[2].rawText.includes('9 ○ 関係人口推進事業費'));assert.ok(!extractTottoriNamedRowsSupplement(second,[first,second]).some(x=>x.projectName==='関係人口推進事業費'));});
