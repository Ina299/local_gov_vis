import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { extractAkitakata } from '../src/evaluations/expansion/akitakata';
import type { CachedInput } from '../src/evaluations/expansion/shared';

const root = fileURLToPath(new URL('../../web/public/evaluation-evidence/documents/', import.meta.url));
const inputs: CachedInput[] = readdirSync(root).filter(n => n.endsWith('.json')).map(n => JSON.parse(readFileSync(root + n, 'utf8')))
  .filter(d => d.municipalityCode === '34214' && d.text.startsWith('事 務 事 業 Ｃ Ｄ'))
  .map(d => ({ ...d, municipalityName: '安芸高田市', sourcePageUrl: d.sourceUrl, format: 'pdf', fetchedAt: '2026-10-11T18:00:00Z' }));

test('Akitakata reads 351 distinct individual sheets across 27 cached documents', () => {
  const projects = inputs.flatMap(extractAkitakata);
  assert.equal(inputs.length, 27);
  assert.equal(projects.length, 351);
  assert.equal(new Set(projects.map(p => p.projectCode)).size, 351);
  assert.equal(projects.reduce((sum, p) => sum + p.indicators.length, 0), 121);
  assert.equal(projects.filter(p => p.indicators.length > 0).length, 99);
  for (const p of projects) {
    assert.equal(p.evaluatedFiscalYear, 2013);
    assert.equal(p.evaluationYear, null);
    assert.equal(p.amounts.length, 0, 'unlabelled costs must not become actual expenditure');
    assert.doesNotMatch(p.projectName, /電話|チェック|作成者氏名/);
    const source = inputs.find(d => d.sourceUrl === p.evidence[0].sourceUrl)!;
    for (const e of [...p.evidence, ...p.indicators.map(x => x.evidence)]) assert.ok(source.text.includes(e.rawText));
    for (const indicator of p.indicators) {
      assert.ok(indicator.name.startsWith('【成果指標】'));
      assert.equal(indicator.fiscalYear, 2013);
      assert.ok(indicator.evidence.rawText.includes(indicator.actual!));
    }
  }
  assert.equal(projects.find(p => p.projectCode === '7')?.projectName, '地域高規格道路東広島高田道路(向原吉田道路)建設促進事業');
  const fire = projects.find(p => p.projectCode === '29')!;
  assert.equal(fire.projectName, '非常備消防活動事業');
  assert.deepEqual(fire.indicators.map(i => [i.name, i.actual, i.unit]), [['【成果指標】市内火災発生件数', '25.00', '件']]);
  const staffing = projects.find(p => p.projectCode === '45')!;
  assert.deepEqual(staffing.indicators.map(i => [i.name, i.target, i.actual]), [['【成果指標】定員の充足率', '100.00', '95.37']]);
});

test('Akitakata rejects truncated documents and duplicate sheets, never selects activity rows', () => {
  const input = inputs.find(d => d.text.includes('事 務 事 業 Ｃ Ｄ 29 '))!;
  assert.deepEqual(extractAkitakata({ ...input, truncated: true }), []);
  const baseline = extractAkitakata(input);
  assert.equal(extractAkitakata({ ...input, text: input.text + '\n' + input.text }).length, baseline.length);
  assert.ok(baseline.every(p => p.indicators.every(i => !/水火災、捜索出動|消防団員火災予防活動/.test(i.name))));
  const collapsed = extractAkitakata({ ...input, text: input.text.replace('実績値 34.00 25.00 － 年度', '実績値 25.00 － 年度') });
  assert.equal(collapsed.find(p => p.projectCode === '29')!.indicators.length, 0, 'a missing first-year cell must not shift the second-year value');
  const missingFinalCell = extractAkitakata({ ...input, text: input.text.replace('実績値 34.00 25.00 － 年度', '実績値 34.00 25.00 年度') });
  assert.equal(missingFinalCell.find(p => p.projectCode === '29')!.indicators.length, 0, 'all three fiscal-year slots must be explicit');
});
