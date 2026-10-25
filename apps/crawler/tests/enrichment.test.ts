import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type { EvaluationDataset, EvaluationEvidence, ProjectEvaluation } from '../../web/src/types/evaluation';
import { additions, applyEnrichments, buildEnrichments, recordSha256, type EnrichmentInput } from '../src/evaluations/enrichment';
import { sha256 } from '../src/evaluations/national-integration';
import { SUPPLEMENTAL_MANIFEST, type SupplementalManifest } from '../src/evaluations/supplemental-integration';

const ev = (rawText: string): EvaluationEvidence => ({ sourceUrl: 'https://www.city.example.lg.jp/a.pdf', sourcePageUrl: 'https://www.city.example.lg.jp/a.pdf', format: 'pdf',
  fetchedAt: '2026-10-23T00:00:00.000Z', sha256: 'a'.repeat(64), rawText, page: null, sheet: null, cell: 'extracted-text:chars:0-1' });
const record = (id: string, extra: Partial<ProjectEvaluation> = {}): ProjectEvaluation => ({ id, municipalityCode: '27140', municipalityName: '堺市', projectCode: null,
  projectName: '女性活躍推進事業', department: '市民人権局 ダイバーシティ企画課', evaluationYear: 2026, evaluatedFiscalYear: null, purpose: null, activities: null, outcomes: null,
  amounts: [], indicators: [], ratings: [], evidence: [ev('一覧')], extractionStatus: 'partial', warnings: [], ...extra });
const amount = (kind: 'actual' | 'budget', fiscalYear: number, amountYen: number) => ({ kind, fiscalYear, amountYen, rawValue: String(amountYen / 1000), rawUnit: '千円', evidence: ev(String(amountYen)) });

test('enrichment adds missing values and refuses a different published value', () => {
  const published = record('p', { amounts: [amount('actual', 2023, 86000)] });
  const same = additions(published, record('s', { amounts: [amount('actual', 2023, 86000), amount('actual', 2024, 900000)], evidence: [ev('シート')] }));
  assert.notEqual(same, 'conflict');
  assert.deepEqual((same as Exclude<typeof same, 'conflict'>).amounts.map(a => a.fiscalYear), [2024]);
  assert.equal(additions(published, record('s', { amounts: [amount('actual', 2023, 99000)] })), 'conflict');
  const dept = additions(record('p', { department: null }), record('s', { department: '総務課', evidence: [ev('シート')] }));
  assert.equal((dept as Exclude<typeof dept, 'conflict'>).department, '総務課');
  assert.equal((additions(published, record('s', { department: '別の課' })) as Exclude<typeof dept, 'conflict'>).department, null, 'a published department is never replaced');
});

test('matching is one-to-one by name and a known equal period; reprints must agree', () => {
  const published = [record('p1'), record('p2', { projectName: '同名事業', department: null }), record('p3', { projectName: '同名事業', department: null }), record('p4', { projectName: '年度違い', evaluationYear: 2025 })];
  const sheets = [
    record('s1', { amounts: [amount('actual', 2024, 1)], evidence: [ev('s1')] }),
    record('s1b', { amounts: [amount('actual', 2024, 1)], evidence: [ev('s1b')] }),
    record('s2', { projectName: '同名事業', amounts: [amount('actual', 2024, 1)] }),
    record('s4', { projectName: '年度違い', amounts: [amount('actual', 2024, 1)] }),
  ];
  const { enrichments, skipped } = buildEnrichments(published, sheets);
  assert.deepEqual(enrichments.map(e => [e.targetId, e.sheetId]), [['p1', 's1']]);
  assert.deepEqual(skipped.map(s => s.reason).sort(), ['ambiguous_match', 'no_match']);
  const disagree = buildEnrichments([record('p1')], [record('a', { amounts: [amount('actual', 2024, 1)] }), record('b', { amounts: [amount('actual', 2024, 2)] })]);
  assert.equal(disagree.enrichments.length, 0);
  assert.deepEqual(disagree.skipped.map(s => s.reason), ['shared_target', 'shared_target']);
});

test('applying an enrichment keeps identity and refuses drifted or non-additive inputs', () => {
  const target = record('p1');
  const dataset: EvaluationDataset = { schemaVersion: 1, generatedAt: '2026-10-24T00:00:00.000Z', sources: [], projects: [target] };
  const add = { department: null, amounts: [amount('actual', 2024, 1)], indicators: [], ratings: [], evidence: [ev('シート')] };
  const input = (extra: Partial<EnrichmentInput['enrichments'][number]> = {}): EnrichmentInput => ({ schemaVersion: 1, kind: 'evaluation_enrichment', generatedAt: '2026-10-25T00:00:00.000Z',
    municipalityCode: '27140', sources: [], enrichments: [{ targetId: 'p1', targetRecordSha256: recordSha256(target), sheetId: 's1', add, ...extra }] });
  const out = applyEnrichments(dataset, input()).projects[0];
  assert.equal(out.id, 'p1'); assert.equal(out.projectName, target.projectName); assert.equal(out.amounts.length, 1); assert.equal(out.evidence.length, 2);
  assert.throws(() => applyEnrichments(dataset, input({ targetRecordSha256: 'b'.repeat(64) })), /changed/);
  const withValue: EvaluationDataset = { ...dataset, projects: [record('p1', { amounts: [amount('actual', 2024, 5)] })] };
  assert.throws(() => applyEnrichments(withValue, input({ targetRecordSha256: recordSha256(withValue.projects[0]) })), /additive/);
});

test('published enrichment inputs reproduce byte-for-byte', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const manifest = JSON.parse(readFileSync(join(root, SUPPLEMENTAL_MANIFEST), 'utf8')) as SupplementalManifest;
  const scratch = mkdtempSync(join(tmpdir(), 'enrichment-reproduction-'));
  try {
    for (const [i, batch] of (manifest.enrichmentBatches ?? []).entries()) {
      const out = join(scratch, `batch-${i}`, 'inputs');
      execFileSync(process.execPath, ['--import', 'tsx', join(root, 'apps/crawler/src/enrich-evaluations.ts'), '--output-dir', out, '--generated-at', batch.generatedAt,
        '--codes', batch.inputs.map(x => x.municipalityCode).join(',')], { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
      for (const input of batch.inputs) assert.equal(sha256(readFileSync(join(out, `${input.municipalityCode}.json`))), input.sha256, `Enrichment ${input.municipalityCode}`);
    }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
