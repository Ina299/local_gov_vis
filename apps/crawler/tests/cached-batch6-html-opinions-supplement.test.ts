import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractBatch6HtmlOpinionsSupplement } from '../src/evaluations/expansion/batch6-html-opinions-supplement';
import type { CachedInput } from '../src/evaluations/expansion/shared';
function input(id: string): CachedInput { const d = JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`, import.meta.url), 'utf8')); return {...d,format:'html',sourcePageUrl:d.sourceUrl}; }
test('Kuriyama: only three complete 2023 midyear external result rows', () => {
 const ps=extractBatch6HtmlOpinionsSupplement(input('426199d17e7bc887d1cd4bf0'));
 assert.equal(ps.length,3); assert.ok(ps.every(p=>p.evaluationYear===2023&&p.evaluatedFiscalYear===2023&&p.ratings[0].value==='計画通りに進める'));
 assert.equal(ps[2].projectName,'地域公共交通の維持・確保と利便性の向上を図ります。');
});
test('Kashiwazaki: eight rows preserve vote counts and explicit prior fiscal year', () => {
 const ps=extractBatch6HtmlOpinionsSupplement(input('b49d4c30011f34e096c030fc'));
 assert.equal(ps.length,8);assert.equal(ps.filter(p=>p.evaluationYear===2017&&p.evaluatedFiscalYear===2016).length,4);
 assert.equal(ps[0].projectName,'市民活動支援事業'); assert.equal(ps[0].ratings[0].value,'現状維持2人、見直し3人、休止0人、廃止0人');
 assert.equal(ps.at(-1)!.department,'商業労政課'); assert.ok(ps.every(p=>p.amounts.length===0&&p.indicators.length===0));
});
test('HTML row evidence matches exact source offsets and truncated copies are rejected',()=>{
 for(const id of ['426199d17e7bc887d1cd4bf0','b49d4c30011f34e096c030fc']){const d=input(id);for(const p of extractBatch6HtmlOpinionsSupplement(d))for(const e of [...p.evidence,...p.ratings.map(r=>r.evidence)]){const [a,b]=e.cell!.split(':').at(-1)!.split('-').map(Number);assert.equal(d.text.slice(a,b),e.rawText);}assert.deepEqual(extractBatch6HtmlOpinionsSupplement({...d,truncated:true}),[]);}
});
