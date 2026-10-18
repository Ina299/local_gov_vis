import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {extractShiroi2016} from '../src/evaluations/expansion/shiroi-supplement';
import {extractKurashiki2025} from '../src/evaluations/expansion/kurashiki-supplement';
import {extractHiroshimaReformProjects} from '../src/evaluations/expansion/hiroshima-reform-projects';
const doc=(id:string)=>JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`,import.meta.url),'utf8'));
test('Shiroi 2016 keeps complete names only, never a trailing fragment before department',()=>{
 const d=doc('0976e2dc64011c03757c7de7'),rs=extractShiroi2016(d);assert.equal(rs.length,12);assert.ok(rs.every(r=>r.evaluationYear===2016&&r.evaluatedFiscalYear===2015&&r.amounts.length===0));assert.ok(!rs.some(r=>r.projectName==='替え事業'||r.projectCode==='1203-3-07'));assert.equal(new Set(rs.map(r=>r.projectCode)).size,12);for(const r of rs)assert.ok(d.text.includes(r.evidence[0].rawText));
});
test('Kurashiki policy tables yield 30 full-name partial business units and no adjacent purpose block',()=>{
 const d=doc('53bb7d3dc207393ef9011e33'),rs=extractKurashiki2025(d);assert.equal(rs.length,30);assert.ok(rs.every(r=>r.evaluationYear===2025&&r.evaluatedFiscalYear===2024&&r.amounts.length===0));assert.ok(!rs.some(r=>['史博物館まつり事業','本・文献等収集事業','ンタクシー導入支援'].includes(r.projectName)));for(const r of rs){assert.equal(r.outcomes!.match(/\(Ⅰ\)/g)!.length,1);assert.ok(d.text.includes(r.evidence[0].rawText));}assert.ok(!rs.find(r=>r.projectName==='学校給食運営事業')!.outcomes!.includes('ひとり親'));
});
test('Hiroshima independent capital-project sections only, target year without inferred evaluation year',()=>{
 for(const [id,year] of [['17b9ab9bcd52af6de179e1e2',2025],['d23c00cd3bb2aed6ea16812e',2024]] as const){const d=doc(id),rs=extractHiroshimaReformProjects(d);assert.equal(rs.length,4);assert.ok(rs.every(r=>r.evaluationYear===null&&r.evaluatedFiscalYear===year&&r.amounts.length===0));for(const r of rs){assert.ok(d.text.includes(r.evidence[0].rawText));assert.equal(r.evidence[0].rawText.match(/取組項目/g)!.length,1);assert.ok(!r.evidence[0].rawText.includes('＜参考＞'));}}
 assert.equal(extractHiroshimaReformProjects(doc('7015ee7e458ea0e2856d2174')).length,0);
});

import {extractToda2024} from '../src/evaluations/expansion/toda-supplement';
test('Toda named project table rows merge two medical categories, exclude wrapped fragments and policy totals',()=>{
 const d=doc('d199a2fbcbbd61adeea87fa7'),rs=extractToda2024(d);assert.equal(rs.length,15);assert.ok(rs.every(r=>r.evaluationYear===2024&&r.evaluatedFiscalYear===2023&&r.amounts.length===0));const medical=rs.filter(r=>r.projectName==='こども医療費支給事業');assert.equal(medical.length,1);assert.equal(medical[0].evidence.length,2);assert.ok(!rs.some(r=>r.projectName==='生活用具給付事業'));for(const r of rs)for(const e of r.evidence)assert.ok(d.text.includes(e.rawText));
});
import {extractTsuruoka} from '../src/evaluations/expansion/tsuruoka';
import {extractFuchuHiroshima} from '../src/evaluations/expansion/fuchu-hiroshima';
test('Tsuruoka 11 concrete operational units preserve complete 2022 target forms; last cut RPA form excluded',()=>{
 const d=doc('f9b14d4bb85471ad63bb1914'),rs=extractTsuruoka(d);assert.equal(rs.length,11);assert.ok(rs.every(r=>r.evaluationYear===2023&&r.evaluatedFiscalYear===2022&&r.amounts.length===0));assert.ok(!rs.some(r=>r.projectName.includes('RPA')||r.projectName==='歳出改革の徹底'));for(const r of rs){assert.ok(d.text.includes(r.evidence[0].rawText));assert.equal(r.evidence[0].rawText.match(/行 政 評 価 調 書/g)!.length,1);}
});
test('Fuchu Hiroshima retains nine clear council result rows, not wrapped-name fragments',()=>{
 const counts:Record<string,number>={'49c4562787f48283d4c44c26':1,'875e536943b6fe7cd2257b56':2,'8a8590f3f1cb3b7f314b809e':1,'eaf2ecebe1d01ed48320b7a0':5};
 for(const [id,n] of Object.entries(counts)){const d=doc(id),rs=extractFuchuHiroshima(d);assert.equal(rs.length,n);for(const r of rs){assert.equal(r.evaluationYear,null);assert.equal(r.ratings.length,1);assert.ok(d.text.includes(r.evidence[0].rawText));}}
 assert.equal(extractFuchuHiroshima(doc('6297cb6206b6858ed53616cb')).length,0);
});
import {extractKawagoe2024Selected} from '../src/evaluations/expansion/kawagoe-supplement';
test('Kawagoe eight named secondary-review selections carry only explicit shared first-stage D',()=>{const d=doc('e43ce860f28953ada6cb6ecb'),rs=extractKawagoe2024Selected(d);assert.equal(rs.length,8);assert.ok(rs.every(r=>r.evaluationYear===2024&&r.evaluatedFiscalYear===2023&&r.ratings[0].value==='D'&&r.ratings[0].label.includes('一次評価')));assert.equal(extractKawagoe2024Selected({...d,text:d.text.replace('総合評価「D」','総合評価「C」')}).length,0);});
