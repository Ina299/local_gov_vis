import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractHita } from '../src/evaluations/expansion/hita';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const ids = ['427920ae34d69e1446017e56','54e3de601bb653819e7675b4','ea9ebb6e7d11bed0052b77ef','2ef3b8da58b31cc65db3f293'];
const inputs: CachedInput[] = ids.map(sourceId => {
  const d = JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${sourceId}.json`, import.meta.url), 'utf8'));
  return { municipalityCode:'44204',municipalityName:'日田市',sourceId,sourceUrl:d.sourceUrl,sourcePageUrl:d.sourceUrl,sourceSha256:d.sourceSha256,fetchedAt:'2026-10-12T00:00:00Z',format:'pdf',text:d.text,truncated:d.truncated };
});
test('Hita extracts complete individual business boxes, preserving duplicate evidence and excluding policy/example boxes', () => {
  const groups = inputs.map(input => extractHita(input, inputs));
  assert.deepEqual(groups.map(x => x.length), [68,41,121,105]);
  const records = groups.flat();
  assert.equal(new Set(records.map(x => x.id)).size,335);
  assert(records.every(x => x.evaluationYear === null && [2023,2024].includes(x.evaluatedFiscalYear!) && x.amounts.length === 0 && x.indicators.length === 0));
  const repeated = records.find(x => x.projectName === '都市計画総務費' && x.evaluatedFiscalYear === 2024)!;
  assert(repeated.evidence.length > 1);
  assert(!records.some(x => /^(全体事業延長|【|必$)/.test(x.projectName)));
  for (const r of records) for (const e of r.evidence) {
    const source = inputs.find(x => x.sourceUrl === e.sourceUrl)!;
    const m = e.cell!.match(/chars:(\d+)-(\d+)$/)!;
    assert.equal(source.text.slice(Number(m[1]),Number(m[2])), e.rawText);
    assert(!e.rawText.includes('主要施策の分析'));
    assert(!e.rawText.includes('大綱名、施策名、主要施策名を'));
  }
});
test('Hita rejects truncated final boxes and unnamed/incomplete rows', () => {
  const original = inputs[0];
  const raw = extractHita(original)[0].evidence[0].rawText;
  assert.deepEqual(extractHita({...original,text:raw,truncated:true}),[]);
  assert.equal(extractHita({...original,text:raw,truncated:false}).length,1);
  assert.deepEqual(extractHita({...original,text:raw.replace('中津日田間地域高規格道路促進期成会負担金','【対象豪雨】'),truncated:false}),[]);
  assert.deepEqual(extractHita({...original,text:raw.split('事業の方向性')[0],truncated:false}),[]);
});
test('Hita resolves cross-source repeated boxes deterministically and keeps different departments separate', () => {
  const a = inputs[0]; const raw = extractHita(a)[0].evidence[0].rawText;
  const first = {...a,text:raw,truncated:false};
  // Both IDs identify the same fiscal year; the cover-side fixture uses its real start marker.
  const second = {...inputs[2],text:'令和6年度 行政評価調書\n総合 大綱名 1 きずなを強める 担当部課・評価責任者\n'+raw,truncated:false};
  assert.equal(extractHita(first,[second,first])[0].evidence.length,2);
  assert.deepEqual(extractHita(second,[second,first]),[]);
  const distinct = {...second,text:second.text.replaceAll('土木建築部都市整備課','土木建築部土木課')};
  assert.equal(extractHita(distinct,[first,distinct]).length,1);
});
