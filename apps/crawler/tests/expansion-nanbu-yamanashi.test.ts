import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractNanbuYamanashi } from '../src/evaluations/expansion/nanbu-yamanashi';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const inputs: CachedInput[] = ['7a5cb76581f5b7c99ebf2375', 'ee9a82e61a342a65cdbc120c'].map(id => {
  const d = JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`, import.meta.url), 'utf8'));
  return { ...d, format: 'pdf', municipalityName: '南部町', sourcePageUrl: d.sourceUrl, fetchedAt: '2026-10-13T00:00:00Z' };
});

test('Yamanashi Nanbu retains 74 explicit project sections and assessment values including non-evaluated cancellation', () => {
  for (const [i, input] of inputs.entries()) {
    const records = extractNanbuYamanashi(input);
    assert.equal(records.length, [38, 36][i]);
    assert.equal(new Set(records.map(r => r.id)).size, records.length);
    for (const record of records) {
      assert.equal(record.municipalityCode, '19366');
      assert.equal(record.evaluationYear, null);
      assert.equal(record.evaluatedFiscalYear, [2024, 2022][i]);
      assert.equal(record.ratings.length, 1);
      assert.equal(record.amounts.length, 0);
      assert.ok(record.activities);
      assert.ok(record.outcomes);
      assert.equal((record.evidence[0].rawText.match(/＊ 成 果/g) ?? []).length, 1);
      assert.ok(!record.outcomes!.includes('＊ 課 題'));
      for (const e of [...record.evidence, ...record.ratings.map(r => r.evidence)]) assert.ok(input.text.includes(e.rawText));
    }
    assert.ok(records.some(r => r.projectName === '南部図書館・富沢図書館'));
    assert.ok(records.some(r => r.projectName === '町立美術館'));
  }
  const canceled = extractNanbuYamanashi(inputs[1]).find(r => r.projectName === '山梨青森南部町児童交流会実施事業')!;
  assert.equal(canceled.ratings[0].value, '－');
  assert.ok(canceled.outcomes?.includes('中止'));
});

test('Yamanashi municipality guard and missing rating prevent namesake/neighbor confusion', () => {
  const input = inputs[0];
  assert.equal(extractNanbuYamanashi({ ...input, municipalityCode: '02445' }).length, 0);
  assert.equal(extractNanbuYamanashi({ ...input, truncated: true }).length, 0);
  const changed = extractNanbuYamanashi({ ...input, text: input.text.replace('＊ 成 果 [ 評価 ４ ]', '＊ 成 果') });
  assert.equal(changed.length, 37);
  assert.ok(!changed.some(r => r.projectName === '学校施設環境整備事業'));
});
