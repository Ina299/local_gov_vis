import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractKasukabe } from '../src/evaluations/expansion/kasukabe';
import type { CachedInput } from '../src/evaluations/expansion/shared';

const doc = JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/ef174b82bf5bd2aa74176d9d.json', import.meta.url), 'utf8'));
const input: CachedInput = { ...doc, format: 'pdf', municipalityName: '春日部市', sourcePageUrl: doc.sourceUrl, fetchedAt: '2026-10-11T00:00:00Z' };

test('Kasukabe imports 75 independent sheets, excluding reprint 46 and cut-off 77', () => {
  const records = extractKasukabe(input);
  assert.equal(records.length, 75);
  assert.equal(new Set(records.map(p => p.projectCode)).size, 75);
  assert.equal(records.filter(p => p.amounts.length).length, 62);
  assert.equal(records.filter(p => p.indicators.length).length, 53);
  assert.equal(records.filter(p => p.projectCode === '12・46').length, 1);
  assert.ok(!records.some(p => p.projectCode === '77'));
  const first = records.find(p => p.projectCode === '1')!;
  assert.equal(first.amounts[0].amountYen, 218079000);
  assert.deepEqual(first.indicators.map(i => [i.actual, i.target, i.unit]), [['98.5', '98.0', '%']]);
  assert.equal(records.find(p => p.projectCode === '12・46')!.amounts.length, 0, 'dash is not zero');
  assert.equal(records.find(p => p.projectCode === '8')!.amounts.length, 0, 'one surviving value in a five-year table cannot establish a column');
  for (const p of records) {
    assert.equal(p.evaluationYear, null);
    assert.equal(p.evaluatedFiscalYear, 2022);
    for (const e of [...p.evidence, ...p.amounts.map(a => a.evidence), ...p.indicators.map(i => i.evidence)]) assert.ok(input.text.includes(e.rawText));
  }
});

test('Kasukabe rejects shifted columns, missing units and multi-indicator rows', () => {
  const collapsed = extractKasukabe({ ...input, text: input.text.replace('181,535 191,492 203,828 210,360 218,079', '191,492 203,828 210,360 218,079') });
  assert.equal(collapsed.find(p => p.projectCode === '1')!.amounts.length, 0);
  const noUnits = extractKasukabe({ ...input, text: input.text.replaceAll('決算額(千円)', '決算額') });
  assert.ok(noUnits.every(p => p.amounts.length === 0));
  assert.equal(extractKasukabe(input).find(p => p.projectCode === '9')!.indicators.length, 0);
});

test('Kasukabe holds seven potentially shared costs, verified against the complete annual histories', () => {
  const records = extractKasukabe(input);
  const expected: Record<string, string> = {
    '63': '52,075 53,633 51,395 50,836 50,416',
    '64': '52,075 53,633 51,395 50,836 50,416',
    '68': '1,620 1,620 1,411 1,390 1,620',
    '69': '1,620 1,620 1,411 1,390 1,620',
    '70': '2,089 1,620 1,411 1,390 1,620',
    '73': '2,098 1,872 600 1,322 1,274',
    '75': '2,098 1,872 600 1,322 1,274',
  };
  for (const [code, columns] of Object.entries(expected)) {
    const record = records.find(p => p.projectCode === code)!;
    assert.deepEqual(record.amounts, []);
    assert.ok(record.warnings.some(w => w.includes('共通経費')));
    const raw = record.evidence[0].rawText;
    assert.equal(raw.match(/^決算額\(千円\) (.+)$/m)?.[1], columns);
    assert.ok(raw.includes('平成30年度 令和元年度 令和2年度 令和3年度 令和4年度'));
  }
  // One matching recent value alone is not evidence of a repeated cost history.
  const distinct = records.find(p => p.projectCode === '72')!;
  assert.equal(distinct.evidence[0].rawText.match(/^決算額\(千円\) (.+)$/m)?.[1], '8,207 3,398 2,293 7,873 1,274');
  assert.equal(distinct.amounts[0].amountYen, 1274000);
  assert.notEqual(expected['70'], expected['68']);
  assert.deepEqual(expected['70'].split(' ').slice(1), expected['68'].split(' ').slice(1));
});
