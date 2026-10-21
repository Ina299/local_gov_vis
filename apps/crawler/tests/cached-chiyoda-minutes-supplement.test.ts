import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{test}from'node:test';import{extractChiyodaMinutesSupplement as run}from'../src/evaluations/expansion/chiyoda-minutes-supplement';import type{CachedInput}from'../src/evaluations/expansion/shared';
function input(id:string):CachedInput{const d=JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));return{...d,format:'pdf',sourcePageUrl:d.sourceUrl,fetchedAt:'2026-10-12T00:00:00Z',municipalityName:'fixture'};}
test('Chiyoda separate business statements keep periods, expenditure limits and committee opinions unconverted',()=>{
 const a=run(input('2eaf1ba2e77c5ab348d74441')),b=run(input('72f204f07a30ea52014c4360'));
 assert.deepEqual(a.map(p=>p.projectName),['障害者就労支援センター']);assert.deepEqual(b.map(p=>p.projectName),['グリーンストック作戦','低炭素建築物助成']);
 assert.ok(a[0].evidence.some(e=>e.rawText.includes('松井委員')));
 assert.ok(!b[0].outcomes!.includes('低炭素建築物助成'));assert.ok(b[1].outcomes!.includes('1,600万円'));
 for(const p of [...a,...b]){assert.equal(p.evaluationYear,2019);assert.equal(p.evaluatedFiscalYear,null);assert.equal(p.amounts.length,0);assert.equal(p.indicators.length,0);assert.equal(p.ratings.length,0);}
});
test('Chiyoda evidence remains an exact source span; truncated or altered source refuses extraction',()=>{
 for(const id of ['2eaf1ba2e77c5ab348d74441','72f204f07a30ea52014c4360']){const d=input(id);for(const p of run(d))for(const e of p.evidence){const[a,b]=e.cell!.split(':').at(-1)!.split('-').map(Number);assert.equal(d.text.slice(a,b),e.rawText);}assert.deepEqual(run({...d,truncated:true}),[]);assert.deepEqual(run({...d,text:d.text.replace('令和元年度','令和2年度')}),[]);}
});
