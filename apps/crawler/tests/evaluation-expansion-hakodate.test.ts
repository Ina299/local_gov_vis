import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractHakodate } from '../src/evaluations/expansion/hakodate';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const input: CachedInput = { ...JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/87598cde9f20390b37d72f0a.json', import.meta.url), 'utf8')),
  municipalityName: '函館市', sourcePageUrl: 'https://www.city.hakodate.hokkaido.jp/', fetchedAt: '2026-10-12T00:00:00Z', format: 'pdf' };

test('Hakodate extracts all 52 individual assessment sheets with explicit fiscal-year actual costs', () => {
  const projects = extractHakodate(input);
  assert.equal(projects.length, 52);
  assert.equal(new Set(projects.map(p => p.id)).size, 52);
  assert.ok(projects.every(p => p.evaluationYear === 2024 && p.evaluatedFiscalYear === 2023));
  assert.ok(projects.every(p => p.amounts.length === 1 && p.ratings.length === 1));
  assert.equal(projects[0].amounts[0].amountYen, 183190000);
  assert.equal(projects[0].projectCode, '調書1-1');
  assert.equal(projects.find(p => p.projectCode === '調書2-9')!.amounts[0].amountYen, 4323000);
  assert.equal(projects.find(p => p.projectName === '公益財団法人函館地域産業振興財団研究開発等事業補助金')!.amounts[0].amountYen, 102681000);
  assert.ok(projects.every(p => p.indicators.length === 0));
});

test('Hakodate keeps provenance exact and distinguishes total from specific financing', () => {
  for (const p of extractHakodate(input)) {
    for (const e of [...p.evidence, ...p.amounts.map(a => a.evidence), ...p.ratings.map(r => r.evidence)]) {
      const [start, end] = e.cell!.split(':').at(-1)!.split('-').map(Number);
      assert.equal(input.text.slice(start, end), e.rawText);
    }
    const beforeFinancing = p.evidence[0].rawText.split('（うち特定財源）')[0];
    const cost = beforeFinancing.match(/([0-9,]+)千円/);
    assert.ok(cost, p.projectName);
    assert.equal(p.amounts[0].amountYen, Number(cost[1].replaceAll(',', '')) * 1000, p.projectName);
  }
});

test('Hakodate excludes a cut-off final sheet and the separate summary document', () => {
  assert.equal(extractHakodate({ ...input, truncated: true }).length, 51);
  assert.equal(extractHakodate({ ...input, sourceId: '3944297ccf376bf93c56032a' }).length, 0);
});
