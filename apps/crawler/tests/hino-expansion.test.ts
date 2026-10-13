import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractHino } from '../src/evaluations/expansion/hino';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const root = new URL('../../web/public/evaluation-evidence/', import.meta.url);
const municipality = JSON.parse(readFileSync(new URL('municipalities/13212.json', root), 'utf8'));
const source = municipality.sources.find((s: {id:string})=>s.id==='ede81c141b65f6b49a5cadd2');
const doc = JSON.parse(readFileSync(new URL(source.text.assetPath, root),'utf8'));
const input: CachedInput = {municipalityCode:'13212',municipalityName:'日野市',sourceId:source.id,
  sourceUrl:source.url,sourcePageUrl:source.url,sourceSha256:source.acquisition.sourceSha256,
  fetchedAt:source.acquisition.fetchedAt,format:'pdf',text:doc.text,truncated:doc.truncated};

test('Hino extracts 31 separate external opinions, not duplicated summary rows or six proposals',()=>{
  const rows=extractHino(input);
  assert.equal(rows.length,31);
  assert.equal(new Set(rows.map(r=>r.id)).size,31);
  assert.ok(rows.every(r=>r.evaluationYear===2012 && r.evaluatedFiscalYear===2011));
  assert.ok(rows.every(r=>r.ratings.length===2 && r.ratings.every(v=>v.kind==='external')));
  assert.ok(rows.every(r=>r.extractionStatus==='partial' && r.warnings.some(w=>w.includes('完全な事務事業評価個票ではありません'))));
  assert.equal(rows.find(r=>r.projectCode==='244')!.department,'子ども家庭支援センター');
  assert.equal(rows.find(r=>r.projectCode==='75')!.ratings[0].value,'Ｇ 休止・廃止');
  assert.equal(rows.find(r=>r.projectCode==='662')!.ratings[0].value,'Ｂ 維持・継続');
  assert.ok(rows.every(r=>r.outcomes===null && r.indicators.length===0));
});

test('Hino preserves full cost versus explicitly excluded personnel and fiscal year',()=>{
  const rows=extractHino(input);
  assert.equal(rows.filter(r=>r.amounts[0].kind==='fullCost').length,28);
  assert.deepEqual(rows.filter(r=>r.amounts[0].kind==='actual').map(r=>r.projectCode),['224','477','369']);
  assert.equal(rows.find(r=>r.projectCode==='244')!.amounts[0].amountYen,2898000);
  assert.equal(rows.find(r=>r.projectCode==='224')!.amounts[0].amountYen,2011029000);
  assert.equal(rows.find(r=>r.projectCode==='252')!.amounts[0].amountYen,2827597000);
  assert.ok(rows.every(r=>r.amounts[0].fiscalYear===2011 && r.amounts[0].rawUnit==='千円'));
  const noNote=input.text.replace('事業費は平成 23 年度決算額及び正職員人件費相当額を合算したもの。','区分不明');
  assert.ok(extractHino({...input,text:noNote}).every(r=>r.amounts.length===0));
});

test('Hino every evidence resolves to the source and overview-only/truncated documents yield no records',()=>{
  for(const r of extractHino(input)) for(const ev of [...r.evidence,...r.ratings.map(x=>x.evidence),...r.amounts.map(x=>x.evidence)]){
    const m=ev.cell!.match(/^extracted-text:chars:(\d+)-(\d+)$/)!;
    assert.equal(input.text.slice(Number(m[1]),Number(m[2])),ev.rawText);
    assert.equal(ev.sha256,input.sourceSha256);
    assert.equal(ev.sourceUrl,input.sourceUrl);
  }
  assert.deepEqual(extractHino({...input,truncated:true}),[]);
  assert.deepEqual(extractHino({...input,municipalityCode:'13210'}),[]);
  assert.deepEqual(extractHino({...input,text:input.text.slice(0,input.text.indexOf('事業番号 事務事業名 所管部署 ※頁'))}),[]);
});
