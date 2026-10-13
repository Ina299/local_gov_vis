import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractSannohe} from '../src/evaluations/expansion/sannohe';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('municipalities/02441.json',root),'utf8'));
const s=m.sources.find((x:{id:string})=>x.id==='c2c2cf5f27b442300e727c81');
const d=JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));
const input:CachedInput={municipalityCode:'02441',municipalityName:'三戸町',sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf',text:d.text,truncated:d.truncated};
test('Sannohe deduplicates six explicitly repeated sheets and preserves narrative outcomes',()=>{
 const rows=extractSannohe(input);assert.equal(rows.length,92);assert.equal(new Set(rows.map(r=>r.id)).size,92);
 assert.equal(rows[0].projectName,'小中一貫教育推進委員会');assert.equal(rows.at(-1)!.projectName,'歴史講演事業');
 assert.ok(rows.every(r=>r.evaluatedFiscalYear===2025&&r.evaluationYear===null&&r.purpose&&r.activities&&r.outcomes));
 assert.equal(rows.filter(r=>r.projectName==='立志科推進事業補助金交付事業').length,1);
 const repeat=rows.find(r=>r.projectName==='授業技術研修講座（三戸地方教育研究所）')!;
 assert.ok(repeat.evidence.some(e=>e.rawText.includes('〔ホ〕 授業実践支援事業')));
 assert.ok(rows.every(r=>r.amounts.length===0&&r.indicators.length===0));
 const conflict=rows.find(r=>r.projectName==='学び応援！高校生修学支援金')!;
 assert.ok(conflict.evidence[0].rawText.includes('７２５千円'));assert.ok(conflict.activities!.includes('７，２５０，０００円'));
});
test('Sannohe all field evidence resolves, partial final sheet is excluded',()=>{
 for(const r of extractSannohe(input))for(const e of r.evidence){const q=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(input.text.slice(Number(q[1]),Number(q[2])),e.rawText);}
 assert.deepEqual(extractSannohe({...input,municipalityCode:'02443'}),[]);
 const cut=input.text.slice(0,input.text.lastIndexOf('〔ラ〕')+50);
 assert.equal(extractSannohe({...input,text:cut,truncated:true}).length,91);
});
