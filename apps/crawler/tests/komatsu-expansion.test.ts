import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractKomatsu} from '../src/evaluations/expansion/komatsu';
import type {CachedInput} from '../src/evaluations/expansion/shared';
const root=new URL('../../web/public/evaluation-evidence/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('municipalities/17203.json',root),'utf8'));
const s=m.sources.find((x:{id:string})=>x.id==='014f5506d214ec30a928b3c7');const d=JSON.parse(readFileSync(new URL(s.text.assetPath,root),'utf8'));
const input:CachedInput={municipalityCode:'17203',municipalityName:'小松市',sourceId:s.id,sourceUrl:s.url,sourcePageUrl:s.url,sourceSha256:s.acquisition.sourceSha256,fetchedAt:s.acquisition.fetchedAt,format:'pdf',text:d.text,truncated:d.truncated};
test('Komatsu extracts 46 complete evaluation forms and reproduces the published rating totals',()=>{
 const rows=extractKomatsu(input);assert.equal(rows.length,46);assert.equal(new Set(rows.map(r=>r.id)).size,46);
 assert.equal(rows.filter(r=>r.ratings[0].value==='A').length,30);assert.equal(rows.filter(r=>r.ratings[0].value==='B').length,16);
 assert.equal(rows[3].projectName,'小松市社会教育賞・小松市スマイルハート賞');
 assert.equal(rows[12].projectName,'総合的な探究の時間の充実による生徒の主体性・社会性の育成');
 assert.equal(rows[38].projectName,'学校とひととものづくり科学館、教育研究センターの連携（教育施設としての活用）');
 assert.ok(rows.every(r=>r.evaluationYear===2025&&r.evaluatedFiscalYear===2024&&!r.amounts.length&&!r.indicators.length&&r.outcomes===null));
 assert.ok(!rows.at(-1)!.evidence[0].rawText.includes('Ⅳ 令和６年度'));
});
test('Komatsu boundaries require the individual footer and preserve literal evidence',()=>{
 for(const r of extractKomatsu(input))for(const e of [...r.evidence,...r.ratings.map(x=>x.evidence)]){const q=e.cell!.match(/chars:(\d+)-(\d+)$/)!;assert.equal(input.text.slice(+q[1],+q[2]),e.rawText);}
 const end=input.text.lastIndexOf('用語説明');assert.equal(extractKomatsu({...input,text:input.text.slice(0,end),truncated:true}).length,45);
 assert.deepEqual(extractKomatsu({...input,sourceId:'unknown'}),[]);
});
