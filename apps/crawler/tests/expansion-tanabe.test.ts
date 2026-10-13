import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractTanabe } from '../src/evaluations/expansion/tanabe';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const d = JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/03c04b509dd4eca5ea3347d2.json', import.meta.url), 'utf8'));
const input: CachedInput = { ...d, format: 'pdf', municipalityName: '田辺市', sourcePageUrl: d.sourceUrl, fetchedAt: '2026-10-11T00:00:00Z' };

test('Tanabe extracts 17 numbered sheets, retaining unspecified numeric results and expense kind', () => {
  const p = extractTanabe(input);
  assert.equal(p.length, 17);
  assert.equal(new Set(p.map(x => x.projectCode)).size, 17);
  assert.equal(p.reduce((sum, x) => sum + x.indicators.length, 0), 25);
  assert.equal(p.filter(x => x.outcomes).length, 17);
  for (const r of p) {
    assert.equal(r.evaluationYear, 2025);
    assert.equal(r.evaluatedFiscalYear, 2024);
    assert.equal(r.amounts.length, 0);
    assert.equal(r.ratings.length, 1);
    assert.ok(r.indicators.every(i => i.name.startsWith('【数値実績】')));
    for (const e of [...r.evidence, ...r.indicators.map(i => i.evidence), ...r.ratings.map(v => v.evidence)]) assert.ok(input.text.includes(e.rawText));
  }
  assert.equal(p[0].indicators[1].actual, '1,351');
  assert.ok(!p.at(-1)!.evidence[0].rawText.includes('６．点検評価委員会について'));
});

test('Tanabe does not extract a missing numeric column or treat the table of contents as a sheet', () => {
  const changed = extractTanabe({ ...input, text: input.text.replace('21 21 100%', '21 100%') });
  assert.equal(changed[0].indicators.length, 1);
  assert.equal(extractTanabe({ ...input, text: input.text.split('令和６年度 田辺市教育委員会事務事業評価シート')[0] }).length, 0);
});
