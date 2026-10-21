import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractMunakata } from '../src/evaluations/expansion/munakata';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const inputs: CachedInput[] = ['f55d2cad1aa84843ebbb6e32','7226938569c4ff73940b75f0','59df522bf14834b4f9ce577b'].map(id => {
  const d = JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`, import.meta.url), 'utf8'));
  return { ...d, format: 'pdf', municipalityName: '宗像市', sourcePageUrl: d.sourceUrl, fetchedAt: '2026-10-11T00:00:00Z' };
});

test('Munakata consumes 266 project details before the truncated appendices, with 234 certain annual costs', () => {
  const sets = inputs.map(extractMunakata);
  assert.deepEqual(sets.map(p => p.length), [90,86,90]);
  assert.deepEqual(sets.map(p => p.filter(x => x.amounts.length).length), [80,78,76]);
  for (let index = 0; index < sets.length; index++) {
    const records = sets[index];
    assert.equal(new Set(records.map(p => p.id)).size, records.length);
    for (const p of records) {
      assert.equal(p.evaluatedFiscalYear, 2020 + index);
      assert.equal(p.evaluationYear, null);
      assert.ok(p.department);
      assert.ok(!p.evidence[0].rawText.includes('一般会計決算額'));
      for (const e of [...p.evidence, ...p.amounts.map(a => a.evidence)]) assert.ok(inputs[index].text.includes(e.rawText));
    }
  }
  assert.equal(sets[0][0].amounts[0].amountYen, 23311000);
  const treatment = sets[0].find(p => p.projectName === '処理場・ポンプ場長寿命化事業')!;
  assert.equal(treatment.amounts[0].amountYen, 1030170000);
  assert.ok(treatment.outcomes?.includes('汚水中継ポンプ場'));
  assert.ok(treatment.evidence[0].rawText.includes('【事業期間：'));
  const vaccines = sets[0].filter(p => p.projectName === '予防接種事業費');
  assert.equal(vaccines.length, 2, 'separate departmental projects are not name-only duplicates');
  assert.deepEqual(vaccines.map(p => p.department), ['健康課','子ども家庭課']);
  assert.deepEqual(vaccines.map(p => p.amounts[0].amountYen), [91905000,215316000]);
  assert.ok(!vaccines[0].evidence[0].rawText.includes('生活困窮者自立支援事業費 相談・支援等実績'));
});

test('Munakata requires all columns and reconciling change, excludes cut-off last project', () => {
  const changed = extractMunakata({ ...inputs[0], text: inputs[0].text.replace('20,016 23,311 3,295', '20,016 23,311 3,296') });
  assert.equal(changed[0].amounts.length, 0);
  const cut = inputs[0].text.indexOf('職員研修費 ■事業概要■');
  const incomplete = extractMunakata({ ...inputs[0], text: inputs[0].text.slice(0, cut - 20), truncated: true });
  assert.equal(incomplete.length, 0);
  const collapsed = extractMunakata({ ...inputs[0], text: inputs[0].text.replace('20,016 23,311 3,295', '23,311 3,295') });
  assert.equal(collapsed[0].amounts.length, 0);
});
