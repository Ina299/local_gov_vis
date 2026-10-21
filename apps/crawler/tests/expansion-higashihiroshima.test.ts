import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractHigashihiroshima } from '../src/evaluations/expansion/higashihiroshima';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const ids = ['e27ea7952f13f851fe1a3e18', '0c74455c3314a67dde65de43', '5e1118e119d5029e848c074a'];
const inputs: CachedInput[] = ids.map(id => {
  const d = JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`, import.meta.url), 'utf8'));
  return { ...d, format: 'pdf', municipalityName: '東広島市', sourcePageUrl: d.sourceUrl, fetchedAt: '2026-10-11T00:00:00Z' };
});

test('Higashihiroshima extracts 144 annual project details rather than policy-group totals', () => {
  const sets = inputs.map(extractHigashihiroshima);
  assert.deepEqual(sets.map(p => p.length), [48, 47, 49]);
  assert.deepEqual(sets.map(p => p[0].evaluatedFiscalYear), [2024, 2023, 2022]);
  for (let index = 0; index < sets.length; index++) {
    const projects = sets[index];
    assert.equal(new Set(projects.map(p => p.projectCode)).size, projects.length);
    for (const p of projects) {
      assert.equal(p.amounts.length, 2);
      assert.deepEqual(p.amounts.map(a => a.kind), ['budget', 'actual']);
      assert.ok(p.activities);
      assert.equal(p.indicators.length, 0, 'policy-group performance is not assigned to each project');
      for (const e of [...p.evidence, ...p.amounts.map(a => a.evidence)]) assert.ok(inputs[index].text.includes(e.rawText));
      assert.ok(!p.evidence[0].rawText.includes('目的別事業群総括管理'));
    }
  }
  const ict = sets[0].find(p => p.projectName === '小・中学校情報機器管理事業')!;
  assert.deepEqual(ict.amounts.map(a => a.amountYen), [436005000, 412858000]);
  assert.ok(sets[0].filter(p => p.projectCode!.startsWith('1-1：')).length > 1, 'group-local numbers must not collapse different projects');
});

test('Higashihiroshima rejects policy summaries, missing monetary units and truncated documents', () => {
  assert.equal(extractHigashihiroshima({ ...inputs[0], text: inputs[0].text.split('事務事業 1-2 幼保小')[0] }).length, 0);
  assert.equal(extractHigashihiroshima({ ...inputs[0], truncated: true }).length, 0);
  assert.equal(extractHigashihiroshima({ ...inputs[0], text: inputs[0].text.replaceAll('千円 決算', '単位不明 決算') }).length, 0);
});
