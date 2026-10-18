import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractReviewedPdfSupplement} from '../src/evaluations/expansion/reviewed-pdf-supplement';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);
function load(code:string,id:string):CachedInput {
 const m=JSON.parse(readFileSync(new URL(`municipalities/${code}.json`,root),'utf8'));
 const s=m.sources.find((x:{id:string})=>x.id===id),d=JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));
 return {...d,municipalityCode:code,municipalityName:m.municipalityName,sourceId:id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf'};
}
test('Kitakata contains five individual external review sheets, excluding contents and unmarked ratings',()=>{
 const q=load('07208','d98995afcc09ea9601ae6611'),r=extractReviewedPdfSupplement(q);
 assert.equal(r.length,5);assert.equal(r[0].projectName,'高齢者おでかけ助成事業');assert.equal(r[4].projectName,'喜多方将棋普及事業');assert.ok(r.every(x=>x.evaluationYear===2024&&x.evaluatedFiscalYear===null&&x.amounts.length===0&&x.ratings.length===0));
 for(const x of r)for(const e of x.evidence){const p=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(q.text.slice(+p[1],+p[2]),e.rawText);}
});
test('Kitagawa separates duplicate printed numbers without duplicating summary amounts or guessing years',()=>{
 const q=load('39305','367c6c2f9d365ea79e003d7e'),r=extractReviewedPdfSupplement(q);
 assert.deepEqual(r.map(x=>x.projectName),['林道宗ノ上線舗装工事','北川村立みどり保育所運営事業']);assert.equal(new Set(r.map(x=>x.id)).size,2);
 assert.ok(r.every(x=>x.evaluationYear===null&&x.evaluatedFiscalYear===null&&x.amounts.length===0));
 assert.ok(!r[0].evidence[0].rawText.includes('北川村立みどり保育所'));assert.ok(r[1].evidence[0].rawText.includes('待機児童ゼロが維持できました。'));
});

test('Joso preserves all 62 row identities and three distinct evaluation columns',()=>{
 const q=load('08211','04ebc78ae3c9f58744783456'),r=extractReviewedPdfSupplement(q);
 assert.equal(r.length,62);assert.equal(new Set(r.map(x=>x.projectCode)).size,62);
 assert.equal(r[3].projectName,'吉野公園運営管理経費');assert.deepEqual(r[3].ratings.map(x=>x.value),['現行どおり','現行どおり','拡充']);
 assert.equal(r[42].projectName,'包括的支援事業費');assert.equal(r[61].projectName,'防災無線経費');
 assert.ok(r.every(x=>x.evaluatedFiscalYear===null&&x.evaluationYear===2020&&x.amounts.length===0));
 for(const x of r)for(const e of x.evidence){const m=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(q.text.slice(+m[1],+m[2]),e.rawText);}
});
test('Kasaoka distinguishes evaluation year and regional project scope',()=>{
 const r=extractReviewedPdfSupplement(load('33205','7d807cb84927f0e1c7120600'));
 assert.equal(r.length,1);assert.equal(r[0].evaluationYear,2026);assert.equal(r[0].evaluatedFiscalYear,2025);assert.equal(r[0].amounts.length,0);assert.equal(r[0].indicators.length,0);assert.match(r[0].outcomes!,/地方創生に相当程度効果があった/);
});
