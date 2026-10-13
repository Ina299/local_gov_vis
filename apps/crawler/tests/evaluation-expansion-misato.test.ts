import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractMisato } from '../src/evaluations/expansion/misato';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const document = JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/d5d54c793420c17f6b2ca519.json', import.meta.url), 'utf8'));
const input: CachedInput = { ...document, municipalityName: '美郷町', sourcePageUrl: document.sourceUrl, fetchedAt: '2026-10-13T00:00:00Z', format: 'pdf' };

test('Misato extracts 41 individual sheets, including both wrapped names without duplicates', () => {
  const records = extractMisato(input);
  assert.equal(records.length, 41);
  assert.equal(new Set(records.map(p => p.id)).size, 41);
  assert.equal(records.filter(p => p.projectName.startsWith('みさとびと')).length, 2);
  assert.ok(records.some(p => p.projectName.endsWith('(美郷カレッジ)')));
  assert.equal(extractMisato({ ...input, text: input.text + '\n' + input.text }).length, 41);
  assert.equal(extractMisato({ ...input, truncated: true }).length, 0);
  assert.equal(extractMisato({ ...input, municipalityCode: '99999' }).length, 0);
});

test('Misato preserves actual/budget columns, yen conversion, and missing costs', () => {
  const records = extractMisato(input);
  assert.deepEqual(records[0].amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), [
    ['actual', 2014, 165893000], ['actual', 2015, 35644000], ['budget', 2016, 38605000],
  ]);
  const lodging = records.find(p => p.projectName === '宿泊交流館利用促進事業')!;
  assert.deepEqual(lodging.amounts.map(a => a.amountYen), [null, 69722000, null]);
  const nurse = records.find(p => p.projectName === '看護師配置事業')!;
  assert.deepEqual(nurse.indicators.map(i => [i.fiscalYear, i.actual, i.unit]), [[2014, '437', '人'], [2015, '466', '人']]);
  assert.equal(nurse.ratings[0].value, 'Ａ');
  assert.equal(records.flatMap(p => p.indicators).length, 8);
  assert.ok(records.every(p => p.outcomes && p.ratings.length === 2));
});

test('Misato evidence addresses exact cached substrings and rejects incomplete or ambiguous sheets', () => {
  const records = extractMisato(input);
  for (const record of records) for (const e of [...record.evidence, ...record.amounts.map(a => a.evidence), ...record.indicators.map(i => i.evidence), ...record.ratings.map(r => r.evidence)]) {
    const match = /^extracted-text:chars:(\d+)-(\d+)$/.exec(e.cell!)!;
    assert.equal(input.text.slice(Number(match[1]), Number(match[2])), e.rawText);
  }
  assert.equal(extractMisato({ ...input, text: input.text.slice(0, input.text.lastIndexOf('美郷町教育委員会')) }).length, 40);
  assert.equal(extractMisato({ ...input, text: input.text.replaceAll('平成28年度予算', '年度不明予算') }).length, 0);
});
