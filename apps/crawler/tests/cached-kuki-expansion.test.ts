import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractKuki } from '../src/evaluations/expansion/kuki';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const sourceId = '9a1ae2fca89400f94992fd98';
const document = JSON.parse(readFileSync(new URL(`../../web/public/evaluation-evidence/documents/${sourceId}.json`, import.meta.url), 'utf8'));
const input: CachedInput = { municipalityCode: '11232', municipalityName: '久喜市', sourceId,
  sourceUrl: document.sourceUrl, sourcePageUrl: document.sourceUrl, sourceSha256: document.sourceSha256,
  fetchedAt: '2026-10-12T00:00:00Z', format: 'pdf', text: document.text, truncated: document.truncated };
test('Kuki complete individual sheets preserve exact code, years, direct cost columns and activity/outcome labels', () => {
  const records = extractKuki(input);
  assert.equal(records.length, 63);
  assert.equal(new Set(records.map(p => p.id)).size, 63);
  const first = records[0];
  assert.equal(first.projectName, '企画業務経費（高等教育機関連携分）');
  assert.equal(first.projectCode, '430210102');
  assert.equal(first.evaluationYear, 2023);
  assert.equal(first.evaluatedFiscalYear, 2022);
  assert.deepEqual(first.amounts, []);
  assert(first.warnings.some(w => w.includes('共通経費')));
  const pollution = records.find(p => p.projectCode === '220311718 / 210211719')!;
  assert.deepEqual(pollution.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), [
    ['budget',2021,9601000], ['budget',2022,8313000], ['budget',2023,10121000], ['actual',2021,8098530], ['actual',2022,7584005]]);
  assert.equal(pollution.evidence.length, 2);
  assert.equal(records.filter(p => p.projectName.startsWith('公害監視調査事業')).length, 1);
  assert.equal(records.find(p => p.projectCode === '730110103')!.amounts.length, 0);
  assert(pollution.evidence.some(e => e.rawText.includes('事務事業整理番号 210211719')));
  assert(first.indicators.some(i => i.name === '【成果指標】高等教育機関との包括連携件数' && i.fiscalYear === 2022 && i.actual === '5' && i.target === '4'));
  assert(records.some(p => p.indicators.some(i => i.name.startsWith('【活動指標】'))));
  for (const p of records) for (const e of [...p.evidence, ...p.amounts.map(a=>a.evidence), ...p.indicators.map(i=>i.evidence), ...p.ratings.map(r=>r.evidence)]) {
    const offset = e.cell!.match(/chars:(\d+)-(\d+)$/)!;
    assert.equal(input.text.slice(Number(offset[1]), Number(offset[2])), e.rawText);
  }
});
test('Kuki rejects unmatched input and does not shift incomplete cost or KPI columns', () => {
  assert.deepEqual(extractKuki({ ...input, municipalityCode: '11231' }), []);
  const modified = input.text.replace('136,000 円 108,000 円 87,000 円', '136,000 円 87,000 円')
    .replace('( 3 ) ( 4 ) ( 5 )', '( 3 ) ( 5 )');
  const first = extractKuki({ ...input, text: modified })[0];
  assert.equal(first.amounts.filter(a=>a.kind==='budget').length, 0);
  assert(!first.indicators.some(i=>i.name.includes('包括連携件数')));
  assert.equal(first.amounts.filter(a=>a.kind==='actual').length, 0);
});

test('Kuki duplicate consolidation fails closed if source implementation or totals diverge', () => {
  const marker = '事務事業名 公害監視調査事業 水質';
  const start = input.text.indexOf(marker);
  const changed = input.text.slice(0, start) + input.text.slice(start).replace('7,584,005 円', '7,584,006 円');
  assert.throws(() => extractKuki({ ...input, text: changed }), /duplicate reconciliation changed/);
});
