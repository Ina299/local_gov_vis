import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { extractHadano } from '../src/evaluations/expansion/hadano';
import type { CachedInput } from '../src/evaluations/expansion/shared';
const root = new URL('../../web/public/evaluation-evidence/', import.meta.url);
const municipality = JSON.parse(readFileSync(new URL('municipalities/14211.json', root), 'utf8'));
const source = municipality.sources.find((x: {id: string}) => x.id === 'a8c1c6174410b216333d88f1');
const document = JSON.parse(readFileSync(new URL(source.text.assetPath, root), 'utf8'));
const input: CachedInput = { municipalityCode: '14211', municipalityName: '秦野市', sourceId: source.id,
  sourceUrl: source.url, sourcePageUrl: source.url, sourceSha256: source.acquisition.sourceSha256,
  fetchedAt: source.acquisition.fetchedAt, format: 'pdf', text: document.text, truncated: document.truncated };
test('Hadano groups 69 university sheets into 61 activities and retains each complete literal sheet', () => {
  const rows = extractHadano(input);
  assert.equal(rows.length, 61);
  assert.equal(new Set(rows.map(row => row.id)).size, 61);
  assert.equal(rows.flatMap(row => row.evidence).length, 69);
  for (const row of rows) for (const e of row.evidence) {
    const positions = e.cell!.match(/^extracted-text:chars:(\d+)-(\d+)$/)!;
    assert.equal(input.text.slice(Number(positions[1]), Number(positions[2])), e.rawText);
    assert.match(e.rawText, /^個票[０-９]+\n/);
    assert.match(e.rawText, /８ 今後の方向性/);
    assert.ok(!e.rawText.includes('《プロジェクト４》'));
  }
  const festival = rows.find(row => row.projectName === '秦野たばこ祭')!;
  assert.equal(festival.evidence.length, 4);
  assert.equal(festival.projectCode, '個票23,個票57,個票67,個票68');
  // Same title, but two departments and different monitoring work: no false merge.
  assert.equal(rows.filter(row => row.projectName === '放射性物質の測定等に関する委託研究').length, 2);
});
test('Hadano preserves wrapped names and does not relabel partial expenditure or forecast as project costs', () => {
  const rows = extractHadano(input);
  assert.equal(rows.find(row => row.projectCode === '個票4')!.projectName, '社会を明るくする運動「いきいきスポーツ教室」');
  assert.equal(rows.find(row => row.projectCode === '個票29')!.department, '生涯学習文化振興課・企画課');
  assert.equal(rows.find(row => row.projectCode === '個票38')!.projectName,
    '地域ﾘﾊﾋﾞﾘﾃｰｼｮﾝ活動支援事業及び介護予防体操（さわやか体操）の全市的な普及事業（平成３０年度新規事業）');
  assert.ok(rows.every(row => row.evaluationYear === 2018 && row.evaluatedFiscalYear === null));
  assert.ok(rows.every(row => !row.amounts.length && !row.indicators.length && !row.ratings.length && row.outcomes === null));
  assert.match(rows[0].evidence[0].rawText, /146,000\nＨ２９実績（円）/);
  assert.match(rows[0].evidence[0].rawText, /152,000\nＨ３０見込（円）/);
});
test('Hadano fails closed for wrong sources and unfinished sheets', () => {
  assert.deepEqual(extractHadano({...input, municipalityCode: '00000'}), []);
  assert.deepEqual(extractHadano({...input, sourceId: 'other'}), []);
  const start = input.text.indexOf('個票１\n');
  const end = input.text.indexOf('８ 今後の方向性', start);
  assert.deepEqual(extractHadano({...input, text: input.text.slice(0, end), truncated: true}), []);
});
