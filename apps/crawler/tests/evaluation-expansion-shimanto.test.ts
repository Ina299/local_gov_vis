import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractShimanto } from '../src/evaluations/expansion/shimanto';
import type { CachedInput } from '../src/evaluations/expansion/shared';
function input(sourceId: string): CachedInput {
  const document = JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${sourceId}.json`, import.meta.url), 'utf8'));
  return { ...document, municipalityName: '四万十町', sourcePageUrl: document.sourceUrl, fetchedAt: '2026-10-13T00:00:00Z', format: 'pdf' };
}
const old = input('6c150492b4c9efb9e907f56e');
const recent = input('8c81d0d29b2bc97031cfc38b');

test('Shimanto separates 59 FY2021 internal sheets from summaries and infrastructure evaluation', () => {
  const records = extractShimanto(old);
  assert.equal(records.length, 59);
  assert.equal(new Set(records.map(p => p.id)).size, 59);
  assert.ok(records.every(p => p.evaluationYear === 2021 && p.evaluatedFiscalYear === 2020));
  assert.ok(!records.some(p => p.projectName === '津波避難対策推進事業'));
  assert.equal(records.flatMap(p => p.amounts).length, 50);
  assert.equal(records.flatMap(p => p.ratings).length, 59);
  assert.equal(extractShimanto({ ...old, text: old.text + '\n' + old.text }).length, 59);
  assert.equal(extractShimanto({ ...old, sourceId: 'external-reprint' }).length, 0);
});

test('Shimanto retains 56 complete FY2022 sheets but excludes the truncated last sheet', () => {
  assert.equal(recent.truncated, true);
  const records = extractShimanto(recent);
  assert.equal(records.length, 56);
  assert.ok(records.every(p => p.evaluationYear === 2022 && p.evaluatedFiscalYear === 2021));
  assert.ok(!records.some(p => p.projectName === '人材育成推進事業「未来塾」'));
  assert.equal(records.at(-1)!.projectName, '町内高校給食支援事業（人材育成事業「未来塾」分）');
  assert.equal(records.flatMap(p => p.amounts).length, 54);
});

test('Shimanto does not relabel planned spending as budget or infer missing/signed totals', () => {
  const record = extractShimanto(old)[0];
  assert.deepEqual(record.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), [['actual', 2020, 536000]]);
  assert.ok(record.evidence.some(e => e.rawText.includes('計画 193,000')));
  assert.equal(extractShimanto(recent)[0].amounts[0].amountYen, 724243000);
  assert.ok(extractShimanto(old).find(p => p.projectName === 'こうち農業確立総合支援事業')!.amounts.length === 0);
  assert.equal(extractShimanto({ ...old, text: old.text.replace('実績 536 536', '実績 536 400') })[0].amounts.length, 0);
});

test('Shimanto preserves explicit KPI years, source names and signed values without shifting empty cells', () => {
  const records = extractShimanto(old);
  assert.deepEqual(records[0].indicators.map(i => [i.fiscalYear, i.target, i.actual]), [[2021, '34,000', null], [2020, null, '29,571']]);
  assert.equal(records.find(p => p.projectName === '複合経営拠点支援事業')!.indicators.length, 0);
  const aid = extractShimanto(recent).find(p => p.projectName === '学力向上対策事業')!;
  assert.ok(aid.indicators.some(i => i.actual === '△4' && i.fiscalYear === 2021));
  assert.equal(records.flatMap(p => p.indicators).length, 119);
  assert.equal(extractShimanto(recent).flatMap(p => p.indicators).length, 100);
});

test('Shimanto evidence precisely locates source text for all records, costs, indicators and ratings', () => {
  for (const source of [old, recent]) for (const record of extractShimanto(source)) {
    for (const e of [...record.evidence, ...record.amounts.map(a => a.evidence), ...record.indicators.map(i => i.evidence), ...record.ratings.map(r => r.evidence)]) {
      const range = /^extracted-text:chars:(\d+)-(\d+)$/.exec(e.cell!)!;
      assert.ok(range);
      assert.equal(source.text.slice(Number(range[1]), Number(range[2])), e.rawText);
    }
  }
});
