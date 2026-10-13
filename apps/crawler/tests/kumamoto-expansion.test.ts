import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractKumamoto} from '../src/evaluations/expansion/kumamoto';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('municipalities/43100.json',root),'utf8'));
function input(id:string):CachedInput{const s=m.sources.find((x:{id:string})=>x.id===id);const d=JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));return {municipalityCode:'43100',municipalityName:'熊本市',sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf',text:d.text,truncated:d.truncated};}
const inputs=['f230b9d42eb612c415d09e07','03d43f23f7f0a5c0cfcb5ae9','989f7ba56e996fd2af9e3a34'].map(input);
test('Kumamoto extracts individual named activities across three explicit report and target years',()=>{
 const sets=inputs.map(extractKumamoto);assert.deepEqual(sets.map(r=>r.length),[102,99,92]);
 sets.forEach((rows,i)=>{assert.equal(new Set(rows.map(r=>r.projectName)).size,rows.length);assert.ok(rows.every(r=>r.evaluationYear===2026-i&&r.evaluatedFiscalYear===2025-i));
 assert.ok(rows.every(r=>r.activities&&r.outcomes===null&&!r.amounts.length&&!r.indicators.length&&!r.ratings.length));
 assert.ok(!rows.some(r=>r.projectName.includes('主催講座')||r.projectName.startsWith('「第２次')));
 assert.equal(rows.filter(r=>r.projectName==='日本語指導環境整備事業').length,1);
 assert.equal(rows.find(r=>r.projectName==='日本語指導環境整備事業')!.evidence.filter(e=>e.rawText.includes('▶ 今後の方向性')).length,2);
 });
 assert.equal(sets[0].find(r=>r.projectName==='人権教育関係経費（研修等に係る経費）')!.department,'人権教育指導室');
 assert.match(sets[0][0].warnings.join(''),/原文内の不整合/);
});
test('Kumamoto exact evidence excludes adjacent policy and commentary and rejects partial final sections',()=>{
 for(const s of inputs)for(const r of extractKumamoto(s)){
 for(const e of r.evidence){const q=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(s.text.slice(+q[1],+q[2]),e.rawText);}
 assert.ok(!r.evidence[0].rawText.includes('○検証指標'));assert.ok(!r.evidence[0].rawText.includes('学識経験者の評価及び意見'));
 }
 assert.equal(extractKumamoto({...inputs[0],truncated:true}).length,101);
 assert.deepEqual(extractKumamoto({...inputs[0],sourceId:'unknown'}),[]);
});
