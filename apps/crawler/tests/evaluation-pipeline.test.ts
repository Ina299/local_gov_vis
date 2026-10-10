import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importEvaluations } from '../src/evaluations/pipeline';
import type { ImportOptions } from '../src/evaluations/pipeline';
import type { ProjectEvaluation } from '../../web/src/types/evaluation';
import type { DiscoveredDocument, SourceDefinition } from '../src/evaluations/adapters';

const source: SourceDefinition = { id: 'test', municipalityCode: '01100', municipalityName: '札幌市', indexUrl: 'https://www.city.sapporo.jp/index.html', allowedHosts: ['www.city.sapporo.jp'], scope: 'fixture only', maxDocuments: 3 };
const doc: DiscoveredDocument = { sourceId: source.id, municipalityCode: source.municipalityCode, municipalityName: source.municipalityName, url: 'https://www.city.sapporo.jp/one.html', sourcePageUrl: source.indexUrl, format: 'html', title: 'Fixture', evaluationYear: 2025, evaluatedFiscalYear: 2024 };
const artifact = { bytes: new TextEncoder().encode('Original text'), fetchedAt: '2026-01-01T00:00:00.000Z', sha256: 'a'.repeat(64) };
const project: ProjectEvaluation = { id: 'test-project', municipalityCode: '01100', municipalityName: '札幌市', projectCode: '1', projectName: '原典事業', department: null, evaluationYear: 2025, evaluatedFiscalYear: 2024, purpose: null, activities: null, outcomes: null, amounts: [], indicators: [], ratings: [], evidence: [{ sourceUrl: doc.url, sourcePageUrl: doc.sourcePageUrl, format: 'html', fetchedAt: artifact.fetchedAt, sha256: artifact.sha256, rawText: 'Original text', page: null, sheet: null, cell: null }], extractionStatus: 'partial', warnings: ['Missing values are unknown'] };
async function setup(): Promise<ImportOptions> {
  const root = await mkdtemp(join(tmpdir(), 'eval-pipeline-'));
  return { root, sources: [source], now: () => '2026-01-02T00:00:00.000Z', fetchArtifact: async () => artifact,
    discover: async () => ({ evaluationYear: 2025, sourcePageUrl: source.indexUrl, documents: [doc], warnings: [] }),
    parse: async () => ({ projects: [project], status: 'partial', message: 'Missing values are unknown' }) };
}
test('writes separate data and web artifacts, preserves missing values and year distinction', async () => {
  const options = await setup();
  const dataset = await importEvaluations(options);
  assert.equal(dataset.sources[0].status, 'partial');
  assert.equal(dataset.projects[0].evaluationYear, 2025);
  assert.equal(dataset.projects[0].evaluatedFiscalYear, 2024);
  assert.deepEqual(dataset.projects[0].amounts, []);
  assert.equal(await readFile(join(options.root, 'data/evaluations/evaluations.json'), 'utf8'), await readFile(join(options.root, 'apps/web/public/evaluations.json'), 'utf8'));
});
test('checkpoint skips unchanged parsing, force reruns, offline replay is byte-stable', async () => {
  const options = await setup(); let parses = 0;
  const parser = options.parse!;
  options.parse = async (...args) => { parses++; return parser(...args); };
  await importEvaluations(options);
  const before = await readFile(join(options.root, 'data/evaluations/evaluations.json'), 'utf8');
  await importEvaluations({ ...options, offline: true, now: () => '2026-02-01T00:00:00.000Z' });
  assert.equal(parses, 1);
  assert.equal(await readFile(join(options.root, 'data/evaluations/evaluations.json'), 'utf8'), before);
  await importEvaluations({ ...options, force: true });
  assert.equal(parses, 2);
});
test('failed refresh retains previous project with explicit failed/stale status', async () => {
  const options = await setup(); await importEvaluations(options);
  const result = await importEvaluations({ ...options, fetchArtifact: async () => { throw new Error('HTTP 403'); } });
  assert.equal(result.sources[0].status, 'failed');
  assert.match(result.sources[0].documents[0].message, /HTTP 403.*前回/);
  assert.deepEqual(result.projects, [project]);
});
test('failed discovery retains previous data but reports latest year not verified', async () => {
  const options = await setup(); await importEvaluations(options);
  const result = await importEvaluations({ ...options, discover: async () => { throw new Error('index unavailable'); } });
  assert.equal(result.sources[0].status, 'failed');
  assert.match(result.sources[0].message, /最新年度は未確認/);
  assert.equal(result.projects.length, 1);
});
test('document limit and unsupported format coverage are explicit', async () => {
  const options = await setup();
  const result = await importEvaluations({ ...options, limit: 1,
    discover: async () => ({ evaluationYear: 2025, sourcePageUrl: source.indexUrl, documents: [doc, { ...doc, url: 'https://www.city.sapporo.jp/two.html' }], warnings: [] }),
    parse: async () => ({ projects: [], status: 'unsupported', message: 'scanned document, no text' }) });
  assert.equal(result.sources[0].discoveredDocuments, 2);
  assert.equal(result.sources[0].fetchedDocuments, 1);
  assert.equal(result.sources[0].status, 'unsupported');
  assert.match(result.sources[0].message, /未取得 1/);
  assert.equal(result.projects.length, 0);
});
test('unknown sources and unsafe limits fail early instead of silently succeeding', async () => {
  const options = await setup();
  await assert.rejects(importEvaluations({ ...options, sourceIds: ['unknown'] }), /Unknown source/);
  await assert.rejects(importEvaluations({ ...options, limit: 0 }), /--limit/);
});
test('bounded refresh does not delete previously published projects from omitted documents', async () => {
  const options = await setup();
  const secondDoc = { ...doc, url: 'https://www.city.sapporo.jp/two.html' };
  options.discover = async () => ({ evaluationYear: 2025, sourcePageUrl: source.indexUrl, documents: [doc, secondDoc], warnings: [] });
  options.parse = async (current) => ({ projects: [{ ...project, id: current.url, evidence: [{ ...project.evidence[0], sourceUrl: current.url }] }], status: 'ok', message: '' });
  assert.equal((await importEvaluations(options)).projects.length, 2);
  const bounded = await importEvaluations({ ...options, limit: 1 });
  assert.equal(bounded.projects.length, 2);
  assert.equal(bounded.sources[0].status, 'partial');
  assert.equal(bounded.sources[0].fetchedDocuments, 1);
});
test('complete successful discovery prunes retired documents, partial discovery does not', async () => {
  const options = await setup();
  options.parse = async (current) => ({ projects: [{ ...project, id: current.url, evidence: [{ ...project.evidence[0], sourceUrl: current.url }] }], status: 'ok', message: '' });
  await importEvaluations(options);
  const replacement = { ...doc, url: 'https://www.city.sapporo.jp/new.html' };
  const discover = async () => ({ evaluationYear: 2025, sourcePageUrl: source.indexUrl, documents: [replacement], warnings: ['index incomplete'] });
  assert.equal((await importEvaluations({ ...options, discover })).projects.length, 2);
  const final = await importEvaluations({ ...options, discover: async () => ({ ...(await discover()), warnings: [] }) });
  assert.equal(final.projects.length, 1);
  assert.equal(final.projects[0].id, replacement.url);
});
test('partial document extraction preserves previously parsed projects missing from the new result', async () => {
  const options = await setup();
  options.parse = async () => ({ projects: [project, { ...project, id: 'second-project' }], status: 'ok', message: '' });
  assert.equal((await importEvaluations(options)).projects.length, 2);
  const result = await importEvaluations({ ...options, force: true, parse: async () => ({ projects: [project], status: 'partial', message: 'One page no longer matches' }) });
  assert.equal(result.projects.length, 2);
  assert.equal(result.sources[0].documents[0].projectCount, 2);
  assert.match(result.sources[0].documents[0].message, /今回未抽出.*前回/);
});
