import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractTondabayashiSupplement, extractTondabayashi2025Missing } from '../src/evaluations/expansion/tondabayashi-supplement';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const cases = [['108ed8ea43c4e30e558217ed',34],['5cabf8b8261095973d09d75d',40],['72ed11d80a0282168c617eeb',27],['94c0be97e7adbd66df147160',57],['96714289a71a10f8028ebb3a',24],['96981fb7a96bb051822e60b4',41],['9f20dc52acf619c3b08f2bac',42],['a2303ead411e8a2eda05621a',60],['c64e43ba9022add2758b6ec6',33],['cb6f2e63141175b04ca3830a',11],['cf3d05549775e9934c7a0f24',10]] as const;
function load(id: string): CachedInput { const d = JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${id}.json`, import.meta.url), 'utf8')); return { ...d, format: 'pdf', municipalityName: '富田林市', sourcePageUrl: d.sourceUrl, fetchedAt: '2026-10-13T00:00:00Z' }; }
test('Tondabayashi supplements only 379 complete 2024 sheets with explicit 2023 actuals', () => {
  for (const [id, count] of cases) {
    const input = load(id); const records = extractTondabayashiSupplement(input);
    assert.equal(records.length, count, id);
    assert.equal(new Set(records.map(r => r.id)).size, count);
    for (const r of records) {
      assert.equal(r.evaluationYear, 2024); assert.equal(r.evaluatedFiscalYear, 2023);
      assert.equal(r.amounts.length, 1); assert.equal(r.amounts[0].kind, 'actual'); assert.equal(r.amounts[0].fiscalYear, 2023);
      assert.match(r.evidence[0].rawText, /(?:C 充実|-[0-9]+-)$/);
      assert.equal((r.evidence[0].rawText.match(/^事業番号 /gm) ?? []).length, 1);
      for (const e of [...r.evidence, ...r.amounts.map(a => a.evidence)]) assert.ok(input.text.includes(e.rawText));
    }
  }
  assert.equal(extractTondabayashiSupplement(load(cases[0][0]))[0].amounts[0].amountYen, 1065000);
});
test('Tondabayashi does not alter legacy 2025 extraction or borrow a missing/ambiguous amount column', () => {
  assert.deepEqual(extractTondabayashiSupplement(load('0e5628aec4660c5f7a9d0a76')), []);
  const input = load(cases[0][0]);
  const changed = extractTondabayashiSupplement({ ...input, text: input.text.replace('決算 1,065', '決算 1,065 2,000') });
  assert.equal(changed[0].amounts.length, 0);
  const incomplete = extractTondabayashiSupplement({ ...input, truncated: true, text: input.text.slice(0, input.text.indexOf('C 充実')) });
  assert.deepEqual(incomplete, []);
});

test('Tondabayashi adds exactly four nonnumeric-code 2025 utility sheets with complete cost columns', () => {
 const input=load('0e5628aec4660c5f7a9d0a76');const records=extractTondabayashi2025Missing(input);assert.equal(records.length,4);assert.equal(records[0].projectName,'公共下水道維持管理事業');assert.equal(records[0].amounts[1].amountYen,150690000);for(const r of records){assert.match(r.projectCode!,/^未設定[1-4]$/);assert.equal(r.evaluatedFiscalYear,2024);assert.equal(r.amounts.length,3);}
});
