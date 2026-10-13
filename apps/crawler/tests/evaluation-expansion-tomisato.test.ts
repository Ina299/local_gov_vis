import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractTomisato } from '../src/evaluations/expansion/tomisato';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const input: CachedInput = { ...JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/f920e1aba63bb7dcfa34ed77.json', import.meta.url), 'utf8')),
  municipalityName: '富里市', sourcePageUrl: 'https://www.city.tomisato.lg.jp/', fetchedAt: '2026-10-12T00:00:00Z', format: 'pdf' };

test('Tomisato has 41 independent sheets including 19-1 and 19-2, never the contents list', () => {
  const ps = extractTomisato(input);
  assert.equal(ps.length, 41);
  assert.equal(new Set(ps.map(p => p.id)).size, 41);
  assert.ok(ps.every(p => p.evaluatedFiscalYear === 2024 && p.evaluationYear === null && p.activities && p.outcomes && p.ratings.length === 1));
  assert.ok(ps.find(p => p.projectCode === '19-1'));
  assert.ok(ps.find(p => p.projectCode === '19-2'));
});

test('Tomisato does not duplicate whole parent-budget amounts across subprojects', () => {
  const ps = extractTomisato(input);
  assert.ok(ps.every(p => p.amounts.length === 1 && p.amounts[0].kind === 'actual'));
  assert.equal(ps[0].amounts[0].amountYen, 44685531);
  assert.equal(ps[1].amounts[0].amountYen, 80000);
  assert.equal(ps.find(p => p.projectCode === '27')!.amounts[0].amountYen, 39150927);
  assert.equal(ps.at(-1)!.amounts[0].amountYen, 4987200);
  assert.ok(ps.at(-1)!.warnings.some(w => w.includes('90,000円の差')));
  assert.ok(ps.every(p => p.amounts[0].amountYen !== 353959341));
});

test('Tomisato uses only complete indicator columns and exact text provenance', () => {
  const ps = extractTomisato(input);
  assert.deepEqual(ps[1].indicators.map(i => [i.fiscalYear, i.target, i.actual]), [[2022,'200','204'],[2023,'200','194'],[2024,'200','15']]);
  assert.equal(ps.find(p => p.projectCode === '3')!.indicators.length, 0);
  assert.equal(ps.find(p => p.projectCode === '26')!.indicators.length, 0);
  assert.equal(ps.find(p => p.projectCode === '33')!.indicators.length, 0);
  assert.ok(!ps.flatMap(p => p.indicators).some(i => i.name.includes('保育所待機児童数')));
  for (const p of ps) for (const e of [...p.evidence, ...p.amounts.map(a => a.evidence), ...p.indicators.map(i => i.evidence), ...p.ratings.map(r => r.evidence)]) {
    const [start,end] = e.cell!.split(':').at(-1)!.split('-').map(Number);
    assert.equal(input.text.slice(start,end), e.rawText);
  }
});

test('Tomisato excludes unknown documents, missing year and cut-off last sheet', () => {
  assert.equal(extractTomisato({ ...input, sourceId: 'unknown' }).length, 0);
  assert.equal(extractTomisato({ ...input, text: input.text.slice(100) }).length, 0);
  assert.equal(extractTomisato({ ...input, truncated: true }).length, 40);
});
