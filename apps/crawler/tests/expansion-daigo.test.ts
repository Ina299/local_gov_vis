import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractDaigo } from '../src/evaluations/expansion/daigo';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const d = JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/af6b3eb46a0f32bed4fda602.json', import.meta.url), 'utf8'));
const input: CachedInput = { ...d, format: 'pdf', municipalityName: '大子町', sourcePageUrl: d.sourceUrl, fetchedAt: '2026-10-11T00:00:00Z' };
test('Daigo extracts nine complete project forms, not the summary table', () => {
  const p = extractDaigo(input);
  assert.equal(p.length, 9);
  assert.equal(new Set(p.map(p => p.id)).size, 9);
  assert.equal(p[0].projectName, '公用バス運行管理事業');
  assert.equal(p.at(-1)!.projectName, '住宅用火災警報器の設置推進');
  for (const r of p) {
    assert.equal(r.evaluationYear, 2023);
    assert.equal(r.evaluatedFiscalYear, null);
    assert.equal(r.projectCode, null);
    assert.equal(r.amounts.length, 0);
    assert.equal(r.indicators.length, 0);
    assert.ok(r.activities);
    assert.equal(r.outcomes, null);
    assert.ok(input.text.includes(r.evidence[0].rawText));
  }
});
test('Daigo rejects incomplete forms and future projected effects as actual indicators', () => {
  assert.equal(extractDaigo({ ...input, truncated: true }).length, 0);
  assert.equal(extractDaigo({ ...input, text: input.text.split('令和 5 年度 事務事業評価調査書')[0] }).length, 0);
});
