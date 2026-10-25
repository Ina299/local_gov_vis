import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { reviewOfflineSource } from '../src/evaluations/expansion/offline-source-phase';
import type { CachedInput } from '../src/evaluations/expansion/shared';
import { mergeSupplementalDataset } from '../src/evaluations/supplemental-integration';
import type { EvaluationDataset } from '../../web/src/types/evaluation';

const root = resolve(import.meta.dirname, '../../..');
const json = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
function load(code: string, id: string): { input: CachedInput; title: string } {
  const base = 'apps/web/public/evaluation-evidence';
  const municipality = json(`${base}/municipalities/${code}.json`);
  const source = municipality.sources.find((s: { id: string }) => s.id === id);
  const doc = json(`${base}/documents/${id}.json`);
  assert.equal(createHash('sha256').update(doc.text).digest('hex'), doc.textSha256);
  assert.equal(doc.sourceSha256, source.acquisition.sourceSha256);
  return { input: { municipalityCode: code, municipalityName: municipality.municipality.municipalityName, sourceId: id, sourceUrl: doc.sourceUrl,
    sourcePageUrl: source.url, sourceSha256: doc.sourceSha256, fetchedAt: source.acquisition.fetchedAt,
    format: source.format, text: doc.text, truncated: doc.truncated }, title: source.title };
}
const hakodate = load('01202', '0062a63c4fb022eac4de8f65');
const sanuki = load('37206', '015be81566c7f99ca7c6dff1');
const cover = load('37206', 'cb625c09117b6bec9da0a13f').input;
const extract = (input = sanuki.input, context = [cover]) => reviewOfflineSource(input, sanuki.title, context);

test('Hakodate preserves explicit narrative evidence without converting forecasts or requested budgets', () => {
  assert.equal(hakodate.input.sourceSha256, '0b8bfcb0f88a22a8dd111b6dcc873c637468f4a5d1c9f38eb3713e566a90a1e8');
  const [p] = reviewOfflineSource(hakodate.input, hakodate.title, []).projects;
  assert.equal(p.projectName, 'し尿処理場運転管理業務委託料');
  assert.equal(p.evaluationYear, 2015); assert.equal(p.evaluatedFiscalYear, null);
  assert.equal(p.purpose, '市内で生ずるし尿および浄化槽汚泥について，し尿処理場において夾雑物除去等の処理を実施し，適正な中間処理をする。');
  assert.match(p.activities!, /①運転監視業務/);
  assert.deepEqual(p.amounts, []); assert.deepEqual(p.indicators, []);
  assert.equal(reviewOfflineSource({ ...hakodate.input, truncated: true }, hakodate.title, []).projects.length, 0);
  assert.equal(reviewOfflineSource(hakodate.input, '別事業', []).projects.length, 0);
});

test('Sanuki accepts a complete bounded bus sheet and derives assessed year only from the matching cover', () => {
  const result = extract();
  const p = result.projects.find(p => p.projectName === 'コミュニティバス事業')!;
  assert.ok(p); assert.equal(p.evaluationYear, null); assert.equal(p.evaluatedFiscalYear, 2024);
  assert.equal(p.projectCode, null); assert.equal(p.purpose, '交通手段の確保による福祉の増進');
  assert.equal(p.activities, 'コミュニティバスの運行'); assert.deepEqual(p.amounts, []);
  assert.ok(p.evidence.some(e => e.sourceUrl === cover.sourceUrl && e.rawText === '事務事業評価調書（令和６年度分）'));
  assert.ok(result.holds.length > 0); assert.equal(extract(sanuki.input, []).projects.length, 0);
  assert.equal(extract(sanuki.input, [{ ...cover, text: cover.text.replace('令和６年度分', '対象年度不明') }]).projects.length, 0);
});

test('Sanuki refuses an unfinished second page or cross-project pairing', () => {
  const end = sanuki.input.text.indexOf('公共交通支援事業');
  const truncated = { ...sanuki.input, text: sanuki.input.text.slice(0, end - 150), truncated: true };
  assert.equal(extract(truncated).projects.length, 0);
  const first = sanuki.input.text.indexOf('コミュニティバス事業');
  const second = sanuki.input.text.indexOf('コミュニティバス事業', first + 1);
  const altered = { ...sanuki.input, text: sanuki.input.text.slice(0, second) + sanuki.input.text.slice(second).replace('コミュニティバス事業', '別の事業') };
  assert.ok(!extract(altered).projects.some(p => p.projectName === 'コミュニティバス事業'));
});

test('Higashiyamato separates the explicit childcare purpose from a neighbouring future target', () => {
  const { input, title } = load('13220', '6a57218757906c30dde37b7d');
  const [p] = reviewOfflineSource(input, title, []).projects;
  assert.equal(p.evaluatedFiscalYear, 2024);
  assert.match(p.purpose!, /^保育所等を利用していない家庭/);
  assert.ok(!p.purpose!.includes('終了に向けて'));
  assert.deepEqual(p.amounts, []);
});

test('all published phase records replay from hashed cached sources; the completed cohort stays closed', () => {
  const audit = json('data/evaluations/offline-source-review-batch12.json');
  const completed = new Set(json('data/evaluations/enrichment-document-review-batch1.json').rows.map((r: { documentId: string }) => r.documentId));
  const manifest = json('data/evaluations/supplemental-provenance.json');
  const batch = manifest.batches.find((b: { generatedAt: string }) => b.generatedAt === audit.generatedAt);
  assert.ok(batch); assert.equal(audit.inventoryEntries, 111); assert.equal(audit.sourceRequests, 0);
  const accepted = new Set(audit.reviews.flatMap((r: { acceptedIds: string[] }) => r.acceptedIds));
  let total = 0;
  for (const entry of batch.inputs) {
    const dataset: EvaluationDataset = json(entry.path);
    const sources = json('data/evaluations/collected-sources-batch12.json').sources.filter((s: { municipalityCode: string }) => s.municipalityCode === entry.municipalityCode);
    const items = sources.flatMap((s: { sourceId: string }) => {
      try { return [load(entry.municipalityCode, s.sourceId)]; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
    });
    const reproduced = items.flatMap((x: { input: CachedInput; title: string }) => reviewOfflineSource(x.input, x.title, items.map((y: { input: CachedInput }) => y.input)).projects);
    for (const p of dataset.projects) {
      assert.ok(accepted.has(p.id));
      assert.deepEqual(p, reproduced.find(q => q.id === p.id));
      assert.deepEqual(p.amounts, []); assert.deepEqual(p.indicators, []);
      for (const e of [...p.evidence, ...p.ratings.map(r => r.evidence)]) {
        const source = items.find((x: { input: CachedInput }) => x.input.sourceUrl === e.sourceUrl && x.input.sourceSha256 === e.sha256)!.input;
        assert.ok(!completed.has(source.sourceId));
        const pos = e.cell!.match(/^extracted-text:chars:(\d+)-(\d+)$/)!;
        assert.equal(source.text.slice(Number(pos[1]), Number(pos[2])), e.rawText);
      }
      total++;
    }
    const p = dataset.projects[0];
    const duplicate = { ...p, id: p.id + '-reprint', purpose: 'changed without correction review' };
    assert.throws(() => mergeSupplementalDataset(dataset, { ...dataset, projects: [duplicate] }, audit.generatedAt), /Identity collision/);
  }
  assert.equal(total, audit.recordsAdded); assert.equal(total, accepted.size);
  assert.equal(total, 251);
  for (const review of audit.reviews) for (const held of review.holds ?? []) assert.ok(!accepted.has(held.unit));
  assert.equal(audit.existingRecordsEnriched, 0); assert.equal(audit.existingFieldsAdded, 0);
});
