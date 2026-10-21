import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractTakahashi } from '../src/evaluations/expansion/takahashi';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const input: CachedInput = { ...JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/799773e755687516961ef9a5.json', import.meta.url), 'utf8')),
  municipalityName: '高梁市', sourcePageUrl: 'https://www.city.takahashi.lg.jp/', fetchedAt: '2026-10-12T00:00:00Z', format: 'pdf' };

test('Takahashi retains 19 separate official project codes and outcome narratives', () => {
  const projects = extractTakahashi(input);
  assert.equal(projects.length, 19);
  assert.equal(new Set(projects.map(p => p.projectCode)).size, 19);
  assert.ok(projects.every(p => p.evaluationYear === 2024));
  assert.equal(projects[0].projectCode, '01301');
  assert.equal(projects[0].projectName, '広報紙発行事業');
  assert.equal(projects.filter(p => p.outcomes).length, 18);
  assert.equal(projects.flatMap(p => p.ratings).length, 57);
  assert.equal(projects[0].ratings.find(r => r.label === '費用対効果')!.value, '改善の余地あり');
});

test('Takahashi does not turn unclear cost classification or multi-year target descriptions into invented numbers', () => {
  const projects = extractTakahashi(input);
  assert.ok(projects.every(p => p.amounts.length === 0 && p.evaluatedFiscalYear === null));
  assert.equal(projects.filter(p => p.indicators.length).length, 17);
  assert.ok(projects.flatMap(p => p.indicators).every(i => i.target === null && i.actual === null && i.fiscalYear === null));
  for (const p of projects) for (const e of [...p.evidence, ...p.indicators.map(i => i.evidence), ...p.ratings.map(r => r.evidence)]) {
    const [start, end] = e.cell!.split(':').at(-1)!.split('-').map(Number);
    assert.equal(input.text.slice(start, end), e.rawText);
  }
});

test('Takahashi excludes unknown source IDs and a cut-off final sheet', () => {
  assert.equal(extractTakahashi({ ...input, sourceId: 'unknown' }).length, 0);
  assert.equal(extractTakahashi({ ...input, truncated: true }).length, 18);
});
