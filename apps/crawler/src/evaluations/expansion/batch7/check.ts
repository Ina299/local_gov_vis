/** Offline dry run for one later-batch extractor module (--batch 7|8…): evidence, scope and identity collisions. Writes nothing. */
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha256 } from '../../national-integration';
import { mergeSupplementalDataset } from '../../supplemental-integration';
import type { EvaluationDataset, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { MunicipalityEvidence, DocumentText } from '../../../../../web/src/types/evaluationEvidence';
import type { CachedInput } from '../shared';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..');
const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const modulePath = arg('--module'), codes = arg('--codes')?.split(',') ?? [];
if (!modulePath || !codes.length || !codes.every(c => /^\d{5}$/.test(c))) throw new Error('Use --module <batch7 module.ts> --codes <code,...> [--samples N]');
const samples = Number(arg('--samples') ?? 3);
const { entries } = await import(pathToFileURL(resolve(modulePath)).href) as { entries: Record<string, { extract: (i: CachedInput, all: CachedInput[]) => ProjectEvaluation[]; scope: string }> };
const batch = arg('--batch') ?? '7';
const collected = JSON.parse(await readFile(join(root, `data/evaluations/collected-sources-batch${batch}.json`), 'utf8'));
const newIds = new Set<string>(collected.sources.map((s: { sourceId: string }) => s.sourceId));
const base = join(root, 'apps/web/public/evaluation-evidence');
const index = JSON.parse(await readFile(join(base, 'index.json'), 'utf8'));
const structured = JSON.parse(await readFile(join(root, 'apps/web/public/evaluations-index.json'), 'utf8'));
const allEvidence = (p: ProjectEvaluation) => [...p.evidence, ...p.amounts.map(a => a.evidence), ...p.indicators.map(i => i.evidence), ...p.ratings.map(r => r.evidence)];
let failed = false;
for (const code of codes) {
  const entry = entries[code];
  if (!entry) { console.log(JSON.stringify({ code, error: 'module has no entry for this code' })); failed = true; continue; }
  if (entry.scope.trim().length < 20) throw new Error(`${code}: scope must describe what is and is not structured`);
  const row = index.municipalities.find((r: { municipalityCode: string }) => r.municipalityCode === code);
  const muni: MunicipalityEvidence = JSON.parse(await readFile(join(base, row.shardPath), 'utf8'));
  const inputs: CachedInput[] = [];
  for (const source of muni.sources) {
    if (source.text.status !== 'available' || !['pdf', 'html'].includes(source.format)) continue;
    const doc: DocumentText = JSON.parse(await readFile(join(base, source.text.assetPath!), 'utf8'));
    inputs.push({ municipalityCode: code, municipalityName: row.municipalityName, sourceId: source.id, sourceUrl: source.url, sourcePageUrl: source.url,
      sourceSha256: doc.sourceSha256, fetchedAt: source.acquisition.fetchedAt!, format: source.format as 'pdf' | 'html', text: doc.text, truncated: doc.truncated });
  }
  inputs.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const projects: ProjectEvaluation[] = [], ids = new Set<string>(), problems: string[] = [];
  for (const input of inputs) {
    const found = entry.extract(input, inputs);
    if (found.length && !newIds.has(input.sourceId)) problems.push(`records from a document not acquired in batch ${batch}: ${input.sourceId}`);
    for (const p of found) {
      if (ids.has(p.id)) problems.push(`duplicate id ${p.id}`); ids.add(p.id);
      if (p.municipalityCode !== code || !p.evidence.length) problems.push(`bad identity/evidence ${p.id}`);
      for (const e of allEvidence(p)) {
        const src = inputs.find(d => d.sourceUrl === e.sourceUrl && d.sourceSha256 === e.sha256);
        const pos = e.cell?.match(/^extracted-text:chars:(\d+)-(\d+)$/);
        if (!src || !pos || src.text.slice(Number(pos[1]), Number(pos[2])) !== e.rawText || !e.rawText.length || e.fetchedAt !== src.fetchedAt) problems.push(`evidence mismatch ${p.id}`);
      }
    }
    projects.push(...found);
  }
  // Same identity rules as the real import; collisions need either exclusion or a reviewed distinct decision.
  const srow = structured.municipalities.find((r: { municipalityCode: string }) => r.municipalityCode === code);
  let existing: EvaluationDataset | null = null;
  if (srow?.datasetPath) {
    const bytes = await readFile(join(root, 'apps/web/public', srow.datasetPath));
    if (sha256(bytes) !== srow.datasetSha256) throw new Error('Structured dataset hash mismatch');
    existing = JSON.parse(bytes.toString());
  }
  const incoming: EvaluationDataset = { schemaVersion: 1, generatedAt: new Date().toISOString(), sources: [], projects };
  // Register every referenced document, as the real extraction CLI does, so cross-document evidence is allowed.
  const sources = [...new Set(projects.flatMap(p => allEvidence(p).map(e => JSON.stringify([e.sourceUrl, e.sha256]))))].map(k => {
    const [url, hash] = JSON.parse(k); const input = inputs.find(i => i.sourceUrl === url && i.sourceSha256 === hash)!;
    return { id: `supplement-${code}-${input.sourceId}`, municipalityCode: code, municipalityName: row.municipalityName, sourcePageUrl: url, evaluationYear: null, status: 'partial' as const,
      discoveredDocuments: 1, fetchedDocuments: 1, extractedProjects: 0, scope: entry.scope, message: '', lastAttemptAt: input.fetchedAt, lastSuccessAt: input.fetchedAt,
      documents: [{ url, format: input.format, status: 'partial' as const, sha256: hash, fetchedAt: input.fetchedAt, projectCount: 0, message: '' }] };
  });
  incoming.sources = sources;
  let collision: string | null = null;
  try { mergeSupplementalDataset(existing, incoming, incoming.generatedAt); } catch (error) { collision = (error as Error).message; }
  if (!projects.length) problems.push('no records');
  if (problems.length || collision) failed = true;
  const withAmounts = projects.filter(p => p.amounts.length).length, withIndicators = projects.filter(p => p.indicators.length).length;
  console.log(JSON.stringify({ code, name: row.municipalityName, records: projects.length, withAmounts, withIndicators, existingRecords: existing?.projects.length ?? 0,
    problems: [...new Set(problems)].slice(0, 20), collision,
    samples: projects.slice(0, samples).map(p => ({ ...p, evidence: p.evidence.map(e => ({ cell: e.cell, rawText: e.rawText.slice(0, 300) })) })) }, null, 1));
}
if (failed) process.exitCode = 1;
