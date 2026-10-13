import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractTakanabe } from '../src/evaluations/expansion/takanabe';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const input: CachedInput = { ...JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/0e5d011993cf2854e9c348b1.json', import.meta.url), 'utf8')),
  municipalityName: '高鍋町', sourcePageUrl: 'https://www.town.takanabe.lg.jp/', fetchedAt: '2026-10-12T00:00:00Z', format: 'pdf' };

test('Takanabe excludes contents, subsidy annexes and truncated final sheet', () => {
  const projects = extractTakanabe(input);
  assert.equal(projects.length, 44);
  assert.equal(new Set(projects.map(p => p.id)).size, 44);
  assert.equal(projects.filter(p => p.projectCode === null).length, 8);
  assert.ok(!projects.some(p => p.projectName === '有害鳥獣捕獲班活動支援事業'));
  assert.ok(projects.every(p => p.evaluationYear === null && p.evaluatedFiscalYear === 2014));
  assert.equal(projects[0].amounts[0].amountYen, 41323026);
  assert.ok(projects.every(p => p.amounts.length === 1 && p.amounts[0].kind === 'actual' && p.amounts[0].fiscalYear === 2014));
  const future = projects.find(p => p.projectName === 'たかなべ未来づくり事業')!;
  assert.equal(future.amounts[0].amountYen, 1300750);
  assert.ok(!future.evidence[0].rawText.includes('補助事業リスト'));
});

test('Takanabe only assigns three explicitly populated columns to fiscal year values', () => {
  const projects = extractTakanabe(input);
  const future = projects.find(p => p.projectName === 'たかなべ未来づくり事業')!;
  assert.deepEqual(future.indicators.map(i => [i.name, i.target, i.actual]), [
    ['【成果指標】採択事業数', '4', '3'], ['【活動指標】検討委員会開催数', '2', '2'],
  ]);
  assert.equal(projects[0].indicators.find(i => i.name === '【成果指標】整備不良による災害時対応不具合件数')?.actual, null);
  assert.equal(projects.filter(p => p.indicators.some(i => i.name.startsWith('【成果指標】'))).length, 38);
  for (const p of projects) for (const e of [...p.evidence, ...p.amounts.map(a => a.evidence), ...p.indicators.map(i => i.evidence)]) {
    const [start, end] = e.cell!.split(':').at(-1)!.split('-').map(Number);
    assert.equal(input.text.slice(start, end), e.rawText);
  }
});

test('Takanabe does not parse unsupported documents or truncated incomplete sheets', () => {
  assert.equal(extractTakanabe({ ...input, sourceId: 'other' }).length, 0);
  const start = input.text.indexOf('評価表 高鍋町総合計画');
  assert.equal(extractTakanabe({ ...input, text: input.text.slice(0, start + 400), truncated: true }).length, 0);
});

test('Takanabe totals reconcile to the complete expense table including wrapped yen units', () => {
  for (const p of extractTakanabe(input)) {
    const amount = p.amounts[0];
    const rows = amount.evidence.rawText.split('\n').slice(1).join('\n').split('\n合計')[0].replace(/平成[0-9]+年度決算/g, '');
    // Previous-year cells are missing markers, so the only numeric cells are current-year expenses.
    const values = [...rows.matchAll(/[0-9][0-9,]*/g)].map(m => Number(m[0].replaceAll(',', '')));
    assert.equal(values.reduce((sum, value) => sum + value, 0), amount.amountYen, p.projectName);
  }
});
