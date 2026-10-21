import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractShunanSupplement } from '../src/evaluations/expansion/shunan-supplement';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const ids = ['a83edbe393eb739a775b8285','b0344c66ef6c1f4e47fd39aa','fd5ff89b4aef4bd763204a6a'];
function load(id: string): CachedInput { const d = JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`, import.meta.url), 'utf8')); return { ...d, format: 'pdf', municipalityName: '周南市', sourcePageUrl: d.sourceUrl, fetchedAt: '2026-10-13T00:00:00Z' }; }
test('Shunan detailed sheets retain 20 projects and distinguish 40 explicit actual/budget amounts', () => {
  for (const [i,id] of ids.entries()) {
    const input = load(id); const records = extractShunanSupplement(input);
    assert.equal(records.length, [18,0,2][i]);
    for (const r of records) {
      assert.equal(r.evaluationYear, [2024,2025,2024][i]);
      assert.equal(r.evaluatedFiscalYear, r.evaluationYear! - 1);
      assert.equal(r.amounts.length, 2);
      assert.equal(r.amounts[0].kind, 'actual'); assert.equal(r.amounts[1].kind, 'budget');
      assert.equal(r.amounts[0].fiscalYear, r.evaluatedFiscalYear); assert.equal(r.amounts[1].fiscalYear, r.evaluationYear);
      assert.equal((r.evidence[0].rawText.match(/^事務事業名 /gm) ?? []).length, 1);
      for (const e of [...r.evidence, ...r.amounts.map(a=>a.evidence)]) assert.ok(input.text.includes(e.rawText));
    }
  }
  assert.equal(extractShunanSupplement(load(ids[0]))[0].amounts[0].amountYen, 26465000);
});
test('Shunan excludes legacy lists and missing cells instead of shifting fiscal year columns', () => {
  assert.deepEqual(extractShunanSupplement(load('ad4c86e871a7d146abdf3707')), []);
  const input = load(ids[0]);
  assert.equal(extractShunanSupplement({...input, text:input.text.replace('事業費 0 0 71,731 26,465 201,522','事業費 0 71,731 26,465 201,522')})[0].amounts.length,0);
  assert.equal(extractShunanSupplement({...input,truncated:true}).length,17);
});
