import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractUonuma } from '../src/evaluations/expansion/uonuma';
import type { CachedInput } from '../src/evaluations/expansion/shared';

const document = JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/cfcf90a2f8f4d9a15f11368c.json', import.meta.url), 'utf8'));
const input: CachedInput = { ...document, format: 'pdf', municipalityName: '魚沼市', sourcePageUrl: document.sourceUrl, fetchedAt: '2026-10-11T00:00:00Z' };

test('Uonuma consumes 44 complete parent projects, excludes 151-item summary, branches and cut-off sheet', () => {
  const projects = extractUonuma(input);
  assert.equal(projects.length, 44);
  assert.equal(new Set(projects.map(p => p.projectCode)).size, 44);
  assert.ok(!projects.some(p => p.projectCode === '197' || p.projectCode!.includes('-')));
  for (const p of projects) {
    assert.equal(p.evaluationYear, null);
    assert.equal(p.evaluatedFiscalYear, 2021);
    assert.equal(p.amounts.length, 1);
    assert.equal(p.amounts[0].kind, 'actual');
    assert.equal(p.amounts[0].fiscalYear, 2021);
    assert.equal(p.ratings.length, 1);
    assert.ok(p.outcomes);
    assert.equal(p.indicators.length, 0, 'unspecified indicators must not become outcome indicators');
    for (const e of [...p.evidence, ...p.amounts.map(a => a.evidence), ...p.ratings.map(r => r.evidence)]) assert.ok(input.text.includes(e.rawText));
  }
  assert.equal(projects.find(p => p.projectCode === '9')!.amounts[0].amountYen, 2394000);
  assert.equal(projects.find(p => p.projectCode === '73')!.amounts[0].amountYen, 132574000, 'retain total including carry-forward, do not substitute current-year subtotal');
  assert.equal(projects.find(p => p.projectCode === '116')!.amounts[0].amountYen, 97393000);
  assert.match(projects.find(p => p.projectCode === '116')!.warnings.join(), /枝番/);
  assert.equal(projects.find(p => p.projectCode === '60')!.projectName, 'コミュニティＦＭ難聴取対策事業');
});

test('Uonuma does not infer amounts with absent units or aggregate split rows', () => {
  const changed = extractUonuma({ ...input, text: input.text.replaceAll('（単位：千円）', '（単位不明）') });
  assert.equal(changed.length, 44);
  assert.ok(changed.every(p => p.amounts.length === 0));
  const duplicate = extractUonuma({ ...input, text: input.text + '\n' + input.text });
  assert.equal(duplicate.length, 44);
});
