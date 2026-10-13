import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractOyama } from '../src/evaluations/expansion/oyama';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const d = JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/43958dd6075a782a757c889c.json', import.meta.url), 'utf8'));
const input: CachedInput = { ...d, format: 'pdf', municipalityName: '小山市', sourcePageUrl: d.sourceUrl, fetchedAt: '2026-10-13T00:00:00Z' };

test('Oyama keeps six individual self-assessments, excluding summary/policy and retaining two withdrawal notices', () => {
  const records = extractOyama(input);
  assert.equal(records.length, 6);
  assert.deepEqual(records.map(r => r.projectName), ['安全安心情報配信事業', '救急業務デジタル化事業', '自主防災組織育成事業', '排水強化対策事業', '災害対策本部システム事業', '防災備蓄物資整備事業']);
  for (const record of records) {
    assert.equal(record.evaluationYear, 2025);
    assert.equal(record.evaluatedFiscalYear, null);
    assert.equal(record.amounts.length, 0);
    assert.equal(record.indicators.length, 0);
    assert.ok(!record.evidence[0].rawText.includes('委員評価 評価理由'));
    assert.ok(!record.evidence[0].rawText.includes('４ 施策評価 評価結果'));
    assert.equal((record.evidence[0].rawText.match(/評価事業名/g) ?? []).length, 1);
    for (const e of [...record.evidence, ...record.ratings.map(r => r.evidence)]) assert.ok(input.text.includes(e.rawText));
  }
  assert.equal(records.filter(r => r.warnings.some(w => w.includes('評価対象から除外'))).length, 2);
  assert.ok(records.slice(4).every(r => r.evidence[1].rawText.includes('除外した')));
});

test('Oyama rejects wrong municipality, truncated source and summary alone', () => {
  assert.equal(extractOyama({ ...input, municipalityCode: '19366' }).length, 0);
  assert.equal(extractOyama({ ...input, truncated: true }).length, 0);
  assert.equal(extractOyama({ ...input, text: input.text.slice(input.text.indexOf('今後の方針 事業・自己評価の課題')) }).length, 0);
});
