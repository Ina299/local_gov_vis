import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractNanbuAomori } from '../src/evaluations/expansion/nanbu-aomori';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const inputs: CachedInput[] = ['78c425b91e70b38c2d10a81b', 'd98cb19db182dc4878dea031'].map(id => {
  const d = JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`, import.meta.url), 'utf8'));
  return { ...d, format: 'pdf', municipalityName: '南部町', sourcePageUrl: d.sourceUrl, fetchedAt: '2026-10-13T00:00:00Z' };
});

test('Aomori Nanbu retains 109 individual detailed projects across two explicit fiscal years', () => {
  for (const [i, input] of inputs.entries()) {
    const records = extractNanbuAomori(input);
    assert.equal(records.length, [50, 59][i]);
    assert.equal(new Set(records.map(r => r.id)).size, records.length);
    for (const record of records) {
      assert.equal(record.municipalityCode, '02445');
      assert.equal(record.evaluationYear, [2017, 2015][i]);
      assert.equal(record.evaluatedFiscalYear, [2016, 2014][i]);
      assert.equal(record.ratings.length, 2);
      assert.equal(record.amounts.length, 0);
      assert.ok(record.activities?.includes('向性'));
      assert.ok(!record.evidence[0].rawText.includes('関係 No.'));
      assert.equal((record.evidence[0].rawText.match(/事業の評価/g) ?? []).length, 1);
      for (const e of [...record.evidence, ...record.ratings.map(r => r.evidence)]) assert.ok(input.text.includes(e.rawText));
    }
    assert.ok(!records.some(r => r.projectName.includes('おいしい給食')));
  }
  assert.ok(extractNanbuAomori(inputs[1]).some(r => r.projectName === 'ふるさと“楽習”キャンプ'));
  assert.equal(extractNanbuAomori(inputs[0]).filter(r => r.ratings[0].value === '〇').length, 2);
});

test('Aomori municipality guard excludes namesake Nanbu; missing ratings cannot borrow from adjacent sheet', () => {
  const input = inputs[0];
  assert.equal(extractNanbuAomori({ ...input, municipalityCode: '19366' }).length, 0);
  assert.equal(extractNanbuAomori({ ...input, truncated: true }).length, 0);
  const changed = extractNanbuAomori({ ...input, text: input.text.replace('（１）授業の充実 総合評価 Ｂ', '（１）授業の充実') });
  assert.equal(changed.length, 49);
  assert.ok(!changed.some(r => r.projectName === 'スクールサポーター支援員配置事業'));
});
