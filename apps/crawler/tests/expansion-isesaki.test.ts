import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractIsesaki } from '../src/evaluations/expansion/isesaki';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const ids = ['0c653b41e7e0557986db2bf5', '44219cd9bbab18245051f94a', 'a21c1bfc5900ff09940defe2'];
const inputs: CachedInput[] = ids.map(id => {
  const d = JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`, import.meta.url), 'utf8'));
  return { ...d, format: 'pdf', municipalityName: '伊勢崎市', sourcePageUrl: d.sourceUrl, fetchedAt: '2026-10-11T00:00:00Z' };
});
test('Isesaki merges three repeated projects across improvement and detailed sheets into 36 records', () => {
  assert.deepEqual(inputs.map(input => extractIsesaki(input).length), [15, 19, 5]);
  const projects = inputs.flatMap(input => extractIsesaki(input, inputs));
  assert.equal(projects.length, 36);
  assert.equal(projects.filter(p => p.amounts.length).length, 5);
  assert.equal(projects.reduce((n, p) => n + p.amounts.length, 0), 10);
  assert.equal(projects.filter(p => p.ratings.length).length, 34);
  const building = projects.find(p => p.evaluationYear === 2019 && p.projectCode === '9')!;
  assert.equal(building.evidence.length, 2);
  assert.equal(building.evaluatedFiscalYear, 2018);
  assert.deepEqual(building.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), [['actual', 2018, 2753000], ['budget', 2019, 9689000]]);
  assert.equal(building.ratings[0].value, '一部改善');
  for (const p of projects) {
    for (const e of [...p.evidence, ...p.amounts.map(a => a.evidence), ...p.ratings.map(r => r.evidence)]) {
      assert.ok(inputs.some(d => d.sourceUrl === e.sourceUrl && d.text.includes(e.rawText)));
    }
  }
});
test('Isesaki rejects missing annual columns and retains conflicts without guessing', () => {
  const changed = { ...inputs[2], sourceId: 'zz-conflict', text: inputs[2].text.replace('2,753 9,689', '9,999 9,689') };
  const sources = [...inputs, changed];
  const projects = sources.flatMap(input => extractIsesaki(input, sources));
  const building = projects.find(p => p.evaluationYear === 2019 && p.projectCode === '9')!;
  assert.ok(!building.amounts.some(a => a.kind === 'actual'));
  assert.match(building.warnings.join(), /金額競合/);
  const collapsed = extractIsesaki({ ...inputs[2], text: inputs[2].text.replace('5,920 8,119 1,466 2,747 2,753 9,689', '8,119 1,466 2,747 2,753 9,689') });
  assert.equal(collapsed.find(p => p.projectCode === '9')!.amounts.length, 0);
});
