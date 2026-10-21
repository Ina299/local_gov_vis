/** Offline supplementary extraction; publication and semantic duplicate review are separate. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './evaluations/national-integration';
import type { EvaluationDataset, ProjectEvaluation } from '../../web/src/types/evaluation';
import type { EvidenceIndex, MunicipalityEvidence, DocumentText } from '../../web/src/types/evaluationEvidence';
import type { CachedInput } from './evaluations/expansion/shared';
import { supplementExtractors } from './evaluations/expansion/supplement-registry';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
if (args.length !== 6 || args[0] !== '--output-dir' || args[2] !== '--generated-at' || args[4] !== '--codes'
  || !Number.isFinite(Date.parse(args[3])) || !/^\d{5}(,\d{5})*$/.test(args[5])) {
  throw new Error('Use --output-dir <directory> --generated-at <ISO timestamp> --codes <codes>');
}
const output = resolve(args[1]), generatedAt = args[3];
const base = join(root, 'apps/web/public/evaluation-evidence');
const index: EvidenceIndex = JSON.parse(await readFile(join(base, 'index.json'), 'utf8'));
await mkdir(output, { recursive: true });
const audit = [];
for (const code of args[5].split(',')) {
  const registered = supplementExtractors[code];
  if (!registered) throw new Error(`No supplement extractor for ${code}`);
  const row = index.municipalities.find(r => r.municipalityCode === code);
  if (!row) throw new Error(`Unknown municipality ${code}`);
  const metadata = await readFile(join(base, row.shardPath));
  if (sha256(metadata) !== row.shardSha256 || metadata.length !== row.shardBytes) throw new Error('Metadata integrity mismatch');
  const muni: MunicipalityEvidence = JSON.parse(metadata.toString());
  const inputs: CachedInput[] = [];
  for (const source of muni.sources) {
    if (source.text.status !== 'available' || !['pdf','html'].includes(source.format)) continue;
    if (!source.text.assetPath?.match(/^documents\/[a-f0-9]{24}\.json$/)) throw new Error('Unexpected document path');
    const bytes = await readFile(join(base, source.text.assetPath));
    if (sha256(bytes) !== source.text.assetSha256 || bytes.length !== source.text.assetBytes) throw new Error('Document integrity mismatch');
    const doc: DocumentText = JSON.parse(bytes.toString());
    if (doc.sourceId !== source.id || doc.sourceUrl !== source.url || doc.municipalityCode !== code
      || doc.sourceSha256 !== source.acquisition.sourceSha256 || sha256(Buffer.from(doc.text)) !== doc.textSha256
      || !source.acquisition.fetchedAt) throw new Error('Source identity mismatch');
    inputs.push({ municipalityCode: code, municipalityName: row.municipalityName, sourceId: source.id,
      sourceUrl: source.url, sourcePageUrl: source.url, sourceSha256: doc.sourceSha256,
      fetchedAt: source.acquisition.fetchedAt, format: source.format as 'pdf'|'html', text: doc.text, truncated: doc.truncated });
  }
  inputs.sort((a,b) => a.sourceId.localeCompare(b.sourceId));
  const dataset: EvaluationDataset = { schemaVersion: 1, generatedAt, sources: [], projects: [] };
  const documents = [];
  const ids = new Set<string>();
  const evidenceOf = (p: ProjectEvaluation) => [...p.evidence, ...p.amounts.map(a=>a.evidence), ...p.indicators.map(i=>i.evidence), ...p.ratings.map(r=>r.evidence)];
  for (const input of inputs) {
    const projects = registered.extract(input, inputs);
    for (const p of projects) {
      if (ids.has(p.id)) throw new Error(`Duplicate candidate ID requires review: ${p.id}`);
      ids.add(p.id);
      if (p.municipalityCode !== code || !p.evidence.length) throw new Error('Invalid project identity or empty evidence');
      for (const e of evidenceOf(p)) {
        const src = inputs.find(d => d.sourceUrl === e.sourceUrl && d.sourceSha256 === e.sha256);
        const pos = e.cell?.match(/^extracted-text:chars:(\d+)-(\d+)$/);
        if (!src || !pos || src.text.slice(Number(pos[1]),Number(pos[2])) !== e.rawText || !e.rawText.length
          || e.fetchedAt !== src.fetchedAt) throw new Error(`Evidence mismatch: ${p.id}`);
      }
    }
    dataset.projects.push(...projects);
  }
  // ZIP members can share a download URL while containing different documents.
  const key = (url:string, hash:string) => JSON.stringify([url,hash]);
  const referenced = new Set(dataset.projects.flatMap(p=>evidenceOf(p).map(e=>key(e.sourceUrl,e.sha256))));
  for (const input of inputs.filter(i=>referenced.has(key(i.sourceUrl,i.sourceSha256)))) {
    const owns = (e: ProjectEvaluation['evidence'][number]) => e.sourceUrl===input.sourceUrl && e.sha256===input.sourceSha256;
    const count = dataset.projects.filter(p=>p.evidence[0] && owns(p.evidence[0])).length;
    const owned = dataset.projects.filter(p=>p.evidence.some(owns));
    dataset.sources.push({ id: `supplement-${code}-${input.sourceId}`, municipalityCode: code,
      municipalityName: row.municipalityName, sourcePageUrl: input.sourcePageUrl,
      evaluationYear: owned.length && owned.every(p=>p.evaluationYear===owned[0].evaluationYear) ? owned[0].evaluationYear : null,
      status: 'partial', discoveredDocuments: 1, fetchedDocuments: 1, extractedProjects: count,
      scope: registered.scope, message: '追加取得なし。保存本文との完全一致を確認。PDF原本との再照合は未実施。',
      lastAttemptAt: input.fetchedAt, lastSuccessAt: input.fetchedAt,
      documents: [{ url: input.sourceUrl, format: input.format, status: 'partial', sha256: input.sourceSha256,
        fetchedAt: input.fetchedAt, projectCount: count, message: count ? '保存本文から追加候補を部分構造化' : '代表資料のレコードへ証拠を統合' }] });
    documents.push({ sourceId: input.sourceId, sourceUrl: input.sourceUrl, sourceSha256: input.sourceSha256,
      textSha256: sha256(Buffer.from(input.text)), records: count, truncated: input.truncated });
  }
  if (!dataset.projects.length) throw new Error(`No supplementary candidates for ${code}`);
  const bytes = Buffer.from(JSON.stringify(dataset)+'\n');
  await writeFile(join(output,`${code}.json`),bytes);
  audit.push({code, candidateRecords:dataset.projects.length, sha256:sha256(bytes), bytes:bytes.length, documents});
}
await writeFile(join(output,'../supplement-extraction-audit.json'),JSON.stringify({generatedAt,offlineOnly:true,municipalities:audit},null,2)+'\n');
console.log(JSON.stringify(audit.map(({documents,...r})=>({...r,documents:documents.length})),null,2));
