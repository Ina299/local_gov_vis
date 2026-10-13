import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractTateyama } from '../src/evaluations/expansion/tateyama';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const input: CachedInput = { ...JSON.parse(readFileSync(new URL('../../web/public/evaluation-evidence/documents/73cee9f56b426a0d506da747.json', import.meta.url), 'utf8')),
  municipalityName: '立山町', sourcePageUrl: 'https://www.town.tateyama.toyama.jp/', fetchedAt: '2026-10-12T00:00:00Z', format: 'pdf' };

test('Tateyama extracts 27 full project sheets and only four confirmed annual expense columns', () => {
  const projects = extractTateyama(input);
  assert.equal(projects.length, 27);
  assert.equal(new Set(projects.map(p => p.projectCode)).size, 27);
  assert.ok(projects.every(p => p.evaluationYear === 2024 && p.evaluatedFiscalYear === 2024));
  assert.ok(projects.every(p => p.amounts.length === 4 && p.amounts.every(a => a.kind === 'actual' && a.fiscalYear! < 2024)));
  assert.deepEqual(projects[0].amounts.map(a => a.amountYen), [14201000, 10485000, 9301000, 4874000]);
  const ict = projects.find(p => p.projectName === '学校ICT推進事業')!;
  assert.equal(ict.amounts.at(-1)!.amountYen, 32179000);
  assert.ok(ict.warnings.some(w => w.includes('重複表記')));
  assert.ok(projects.some(p => p.projectName === '学力向上事業(読解力向上3ヵ年プログラム)'));
});

test('Tateyama keeps previous confirmed indicator values distinct from current-year projections', () => {
  const projects = extractTateyama(input);
  const teaching = projects.find(p => p.projectName === '小学校義務教育教材整備事業')!;
  const indicator = teaching.indicators.find(i => i.name === '【成果指標】購入教材備品数')!;
  assert.equal(indicator.actual, '35');
  assert.equal(indicator.fiscalYear, 2023);
  assert.ok(projects.every(p => p.outcomes));
  assert.equal(projects.filter(p => p.indicators.some(i => i.name.startsWith('【成果指標】'))).length, 6);
  for (const p of projects) for (const e of [...p.evidence, ...p.amounts.map(a => a.evidence), ...p.indicators.map(i => i.evidence)]) {
    const [start, end] = e.cell!.split(':').at(-1)!.split('-').map(Number);
    assert.equal(input.text.slice(start, end), e.rawText);
  }
  assert.ok(!projects.at(-1)!.evidence[0].rawText.includes('Ⅲ 学識経験者'));
});

test('Tateyama excludes unknown documents and truncated final sheets', () => {
  assert.equal(extractTateyama({ ...input, sourceId: 'unknown' }).length, 0);
  assert.equal(extractTateyama({ ...input, truncated: true }).length, 26);
});

test('Tateyama excludes wrapped indicator-name fragments rather than treating continuation text as complete names', () => {
  const names = extractTateyama(input).flatMap(p => p.indicators.map(i => i.name));
  for (const fragment of ['境整備費', 'よび光熱水費率', '（米を含む）', '遠距離地区（６km以上）の', '開館）及び利用促進／利用者数', '（過去３年間の平均）']) {
    assert.ok(!names.some(name => name.includes(fragment)), fragment);
  }
});
