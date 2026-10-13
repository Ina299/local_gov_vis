import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractOtaki } from '../src/evaluations/expansion/otaki';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const root = new URL('../../web/public/evaluation-evidence/', import.meta.url);
const municipality = JSON.parse(readFileSync(new URL('municipalities/12441.json', root), 'utf8'));
const source = municipality.sources.find((s: {id: string}) => s.id === 'b1bcc28e2e15c46f28b64ad3');
const doc = JSON.parse(readFileSync(new URL(source.text.assetPath, root), 'utf8'));
const input: CachedInput = {municipalityCode:'12441',municipalityName:'大多喜町',sourceId:source.id,
  sourceUrl:source.url,sourcePageUrl:source.url,sourceSha256:source.acquisition.sourceSha256,
  fetchedAt:source.acquisition.fetchedAt,format:'pdf',text:doc.text,truncated:doc.truncated};

test('Otaki includes 59 completed numbered sheets and rejects truncated no. 60 and summary lists', () => {
  const rows = extractOtaki(input);
  assert.equal(rows.length,59);
  assert.equal(new Set(rows.map(r=>r.id)).size,59);
  assert.equal(rows[0].projectCode,'2024:no-1');
  assert.equal(rows.at(-1)!.projectCode,'2024:no-59');
  assert.ok(rows.every(r=>r.evaluatedFiscalYear===2024 && r.evaluationYear===null));
  assert.equal(rows.reduce((n,r)=>n+r.ratings.length,0),354);
  assert.equal(rows.reduce((n,r)=>n+r.indicators.length,0),179);
  assert.ok(rows.every(r=>r.amounts.length===0));
  assert.equal(rows.filter(r=>r.indicators.some(i=>i.name.includes('【成果指標】'))).length,59);
  assert.equal(rows.filter(r=>r.indicators.some(i=>i.name.includes('【活動指標】'))).length,58);
  assert.equal(rows[0].ratings.find(r=>r.label==='総 合')!.value,'20');
  assert.equal(rows[1].ratings.find(r=>r.label==='総 合')!.value,'19');
  assert.equal(rows[0].projectName,rows[1].projectName);
  assert.notEqual(rows[0].id,rows[1].id); // official distinct numbers/activities
  assert.ok(rows[0].indicators.some(i=>i.name.includes('【活動指標】①')&&i.name.includes('発行部数')));
  assert.ok(rows[0].indicators.some(i=>i.name.includes('【成果指標】①（求める結果）')&&i.name.includes('広報アンケート')));
});

test('Otaki every structured value retains literal source evidence and unknown amounts stay unknown', () => {
  for (const row of extractOtaki(input)) for(const ev of [...row.evidence,...row.ratings.map(r=>r.evidence),...row.indicators.map(i=>i.evidence)]) {
    const m=ev.cell!.match(/^extracted-text:chars:(\d+)-(\d+)$/)!;
    assert.equal(input.text.slice(Number(m[1]),Number(m[2])),ev.rawText);
    assert.equal(ev.sha256,input.sourceSha256);
    assert.equal(ev.sourceUrl,input.sourceUrl);
    assert.equal(ev.page,null);
  }
  assert.ok(extractOtaki(input).every(r=>r.indicators.every(i=>i.actual===null&&i.target===null)));
});

test('Otaki rejects unnumbered summaries, incomplete sheets and other municipal text', () => {
  assert.deepEqual(extractOtaki({...input,municipalityCode:'00000'}),[]);
  assert.deepEqual(extractOtaki({...input,text:input.text.slice(0,input.text.indexOf('事務事業№ 1'))}),[]);
  assert.deepEqual(extractOtaki({...input,text:input.text.slice(input.text.indexOf('事務事業№ 60')),truncated:false}),[]);
});
