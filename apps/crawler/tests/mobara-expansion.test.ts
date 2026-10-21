import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractMobara } from '../src/evaluations/expansion/mobara';
import type { CachedInput } from '../src/evaluations/expansion/shared';

const root = new URL('../../web/public/evaluation-evidence/', import.meta.url);
const municipality = JSON.parse(readFileSync(new URL('municipalities/12210.json', root), 'utf8'));
const inputs: CachedInput[] = municipality.sources.filter((s: {format: string; text: {assetPath: string}}) => s.format === 'pdf' && s.text.assetPath).map((s: {id: string; url: string; format: 'pdf'; text: {assetPath: string}; acquisition: {sourceSha256: string; fetchedAt: string}}) => {
  const document = JSON.parse(readFileSync(new URL(s.text.assetPath, root), 'utf8'));
  return {municipalityCode: '12210', municipalityName: '茂原市', sourceId: s.id, sourceUrl: s.url,
    sourcePageUrl: 'https://www.city.mobara.chiba.jp/0000009326.html', sourceSha256: s.acquisition.sourceSha256,
    fetchedAt: s.acquisition.fetchedAt, format: s.format, text: document.text, truncated: document.truncated};
});

test('Mobara pairs complete assessment sheets, merges repeated project codes and rejects conflicting codes', () => {
  const rows = inputs.flatMap(extractMobara);
  assert.equal(rows.length, 140);
  assert.equal(new Set(rows.map(r => r.id)).size, 140);
  assert.equal(rows.filter(r => r.outcomes).length, 137);
  assert.equal(rows.filter(r => r.ratings.length).length, 140);
  assert.equal(rows.filter(r => r.projectCode === '405010101').length, 1);
  const traffic = rows.find(r => r.projectCode === '405010101')!;
  assert.match(traffic.outcomes!, /824件/);
  assert.match(traffic.outcomes!, /夜間に発生する交通事故/);
  assert.match(traffic.warnings.join(), /1事業に統合/);
  assert.ok(!rows.some(r => ['203010102', '301010101'].includes(r.projectCode!)));
  assert.ok(rows.every(r => !r.amounts.length && !r.indicators.length && r.evaluatedFiscalYear === null));
  assert.equal(extractMobara(inputs.find(i => i.sourceId === '1ab407ffb6493bf1c4ffb1b9')!).length, 0);
});

test('Mobara every evidence quote resolves exactly to cached text and original hash', () => {
  for (const input of inputs) for (const row of extractMobara(input)) {
    for (const ev of [...row.evidence, ...row.ratings.map(r => r.evidence)]) {
      const match = ev.cell!.match(/^extracted-text:chars:(\d+)-(\d+)$/)!;
      assert.equal(input.text.slice(Number(match[1]), Number(match[2])), ev.rawText);
      assert.equal(ev.sha256, input.sourceSha256);
      assert.equal(ev.sourceUrl, input.sourceUrl);
      assert.equal(ev.page, null);
    }
    assert.equal(row.evaluationYear, 2024);
    assert.ok(row.projectCode!.match(/^\d{9}$/));
  }
});

test('Mobara rejects incomplete/truncated sheets, wrong municipality and missing pair', () => {
  const input = inputs[0];
  assert.deepEqual(extractMobara({...input, truncated: true}), []);
  assert.deepEqual(extractMobara({...input, municipalityCode: '12211'}), []);
  const second = input.text.indexOf('令和6年度 3か年事務事業戦略シート', 1);
  assert.deepEqual(extractMobara({...input, text: input.text.slice(0, second)}), []);
});
