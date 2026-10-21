import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractKaizu } from '../src/evaluations/expansion/kaizu';
import type { CachedInput } from '../src/evaluations/expansion/shared';

function input(id: string): CachedInput {
  const path = new URL(`../../web/public/evaluation-evidence/documents/${id}.json`, import.meta.url);
  return { ...JSON.parse(readFileSync(path, 'utf8')), municipalityName: '海津市',
    sourcePageUrl: 'https://www.city.kaizu.lg.jp/shisei/0000004007.html',
    fetchedAt: '2026-10-12T00:00:00Z', format: 'pdf' };
}
const cover = input('982b3dbd86b80c24870b5012');
const general = input('10e31a9d485160629a1bc333');
const assembly = input('ed3196ee87afabaca9ffb2c8');

test('Kaizu extracts complete acquired sheets and excludes annotated cover example', () => {
  const records = [...extractKaizu(general, cover), ...extractKaizu(assembly, cover)];
  assert.equal(records.length, 40);
  assert.equal(new Set(records.map(x => x.projectCode)).size, 40);
  assert.equal(extractKaizu(cover, cover).length, 0);
  assert.ok(records.every(p => p.evaluationYear === 2025 && p.evaluatedFiscalYear === 2024));
  const first = records.find(p => p.projectName === '総務管理事務事業')!;
  assert.deepEqual(first.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), [
    ['actual', 2023, 594073000], ['budget', 2024, 622213000], ['actual', 2024, 615883000],
  ]);
  assert.ok(!records.some(p => p.projectName === '地域活性化推進事業'));
});

test('Kaizu preserves indicator labels, source years and exact source substrings', () => {
  const records = extractKaizu(general, cover);
  const tax = records.find(p => p.projectName === '税務管理事業')!;
  assert.deepEqual(tax.indicators.map(i => [i.name, i.target, i.actual, i.unit]), [
    ['【活動指標】納税相談の件数', '310', '370', '件'], ['【成果指標】市税等の収納率', '93.00', '93.50', '％'],
  ]);
  for (const p of records) for (const e of [...p.evidence, ...p.amounts.map(a => a.evidence), ...p.indicators.map(i => i.evidence)]) {
    const source = e.sourceUrl === cover.sourceUrl ? cover : general;
    assert.ok(source.text.includes(e.rawText));
    const [start, end] = e.cell!.split(':').at(-1)!.split('-').map(Number);
    assert.equal(source.text.slice(start, end), e.rawText);
  }
});

test('Kaizu does not infer years without the verified report cover or retain truncated final sheet', () => {
  const without = extractKaizu(assembly);
  assert.ok(without.every(p => p.evaluationYear === null && p.amounts.every(a => a.fiscalYear === null)));
  assert.equal(extractKaizu({ ...assembly, truncated: true }, cover).length, 2);
  assert.equal(extractKaizu({ ...assembly, sourceId: 'unreviewed' }, cover).length, 0);
});

test('Kaizu current-year first-column amounts reconcile with financing columns for every sheet', () => {
  const records = [...extractKaizu(general, cover), ...extractKaizu(assembly, cover)];
  let checked = 0;
  for (const p of records) for (const a of p.amounts.filter(a => a.fiscalYear === 2024)) {
    const numbers: number[] = [];
    for (const token of a.evidence.rawText.split(' ').slice(1)) {
      if (!/^[\d,]+$/.test(token)) break;
      numbers.push(Number(token.replaceAll(',', '')));
    }
    assert.ok(numbers.length >= 2, p.projectName);
    assert.equal(numbers[0], numbers.slice(1).reduce((sum, value) => sum + value, 0), p.projectName);
    assert.equal(a.amountYen, numbers[0] * 1000);
    checked++;
  }
  assert.equal(checked, 80);
});
