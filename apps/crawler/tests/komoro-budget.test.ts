import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractKomoroBudget, type BudgetSnapshot } from '../src/evaluations/komoro-budget';
import { mergeSupplementalDataset } from '../src/evaluations/supplemental-integration';
const snapshot: BudgetSnapshot = JSON.parse(readFileSync(new URL('../../../data/evaluations/komoro-budget-2026.json', import.meta.url), 'utf8'));

test('official Komoro budget reconciles all 14 categories and 23.7 billion yen', () => {
  const d = extractKomoroBudget(snapshot);
  assert.equal(d.projects.length, 249);
  assert.equal(d.projects.reduce((s,p) => s + p.amounts[0].amountYen!, 0), 23_700_000_000);
  assert.equal(new Set(d.projects.map(p => p.initialBudget!.category)).size, 14);
  const gender = d.projects.find(p => p.projectName === '男女共同参画推進事業')!;
  assert.equal(gender.amounts[0].amountYen, 994_000);
  assert.equal(gender.amounts[0].evidence.page, 92);
  assert.equal(d.projects.find(p => p.projectName === '予備費')!.amounts[0].amountYen, 38_198_000);
  assert.ok(d.projects.every(p => p.evaluationYear === null && p.evaluatedFiscalYear === null && p.department === null));
  assert.ok(d.projects.every(p => p.amounts[0].kind === 'budget' && p.amounts[0].fiscalYear === 2026 && p.evidence.every(e => e.page !== null)));
  assert.deepEqual(mergeSupplementalDataset(d, d, d.generatedAt).dataset, d);
});

test('missing/changed amounts fail closed instead of creating partial public totals', () => {
  const bad = structuredClone(snapshot);
  const row = bad.pages.find(p => p.page === 32)!.items.find(w => w.text === '◎議会運営費')!;
  const amount = bad.pages.find(p => p.page === 32)!.items.find(w => w.x > 750 && Math.abs(w.y-row.y)<2)!;
  amount.text = '1';
  assert.throws(() => extractKomoroBudget(bad), /Category total mismatch/);
  assert.throws(() => extractKomoroBudget({...snapshot, sha256:'0'.repeat(64)}), /Unreviewed/);
});

test('initial budgets coexist with same-name evaluations without changing evaluation records', () => {
  const incoming = extractKomoroBudget(snapshot), base = structuredClone(incoming);
  base.projects = [structuredClone(incoming.projects[0])];
  delete base.projects[0].initialBudget;
  base.projects[0].id = 'prior-evaluation';
  base.projects[0].evaluationYear = 2025;
  base.projects[0].amounts = [];
  base.sources[0].extractedProjects = 1;
  base.sources[0].documents[0].projectCount = 1;
  const result = mergeSupplementalDataset(base, incoming, incoming.generatedAt);
  assert.equal(result.dataset.projects.length, 250);
  assert.deepEqual(result.dataset.projects[0], base.projects[0]);
});
