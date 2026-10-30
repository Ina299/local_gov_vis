/**
 * 都道府県の評価資料（evaluation-evidence-prefectures の取得テキスト）から整理済み事業票を作る。
 *   試行（書き込みなし）: tsx src/prefectures/structure.ts --dry-run --codes 18000 [--module extractors/p-fukui.ts] [--sample 3]
 *   公開:               tsx src/prefectures/structure.ts --write
 *   下見:               tsx src/prefectures/structure.ts --dump <dir> --codes 18000,20000
 * 出力: apps/web/public/evaluations-prefectures/{code}-{sha}.json と evaluations-prefectures-index.json（47行）。
 * 抽出器は extractors/registry.ts に登録した `Entry`（市区町村の後発抽出器と同じ形）。根拠は取得テキストの完全一致の部分文字列で、
 * 書き込み前に全件を照合し、web の parseEvaluationDataset で形式を確かめる。同じ入力からは同じバイト列になる。
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { EvaluationDataset, EvaluationSourceStatus, ProjectEvaluation } from '../../../web/src/types/evaluation';
import type { DocumentText, EvidenceIndex, MunicipalityEvidence } from '../../../web/src/types/evaluationEvidence';
import * as evaluationsLib from '../../../web/src/lib/evaluations';
import { fullText } from '../evaluations/expansion/fulltext';
import type { CachedInput } from '../evaluations/expansion/shared';
import type { Entry } from '../evaluations/expansion/batch9/i1-util';
import { setPriorRecords } from '../evaluations/expansion/run-context';

const { parseEvaluationDataset } = ((evaluationsLib as { default?: unknown }).default ?? evaluationsLib) as typeof evaluationsLib;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const evidenceDir = join(root, 'apps/web/public/evaluation-evidence-prefectures');
const outDir = join(root, 'apps/web/public/evaluations-prefectures');
const indexPath = join(root, 'apps/web/public/evaluations-prefectures-index.json');
const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const json = (x: unknown) => Buffer.from(JSON.stringify(x) + '\n');

/** All readable texts of one prefecture, whole (continuations joined), in source-id order. */
export async function prefectureInputs(code: string): Promise<{ shard: MunicipalityEvidence; inputs: CachedInput[] }> {
  const shard: MunicipalityEvidence = JSON.parse(await readFile(join(evidenceDir, `prefectures/${code}.json`), 'utf8'));
  const inputs: CachedInput[] = [];
  for (const source of shard.sources) {
    if (source.text.status !== 'available') continue;
    const format = source.format === 'xls' || source.format === 'xlsx' ? 'xlsx' : source.format === 'pdf' ? 'pdf' : source.format === 'html' ? 'html' : null;
    if (!format) continue;
    const doc: DocumentText = JSON.parse(await readFile(join(evidenceDir, source.text.assetPath!), 'utf8'));
    const whole = await fullText(evidenceDir, source, doc.text);
    inputs.push({ municipalityCode: code, municipalityName: shard.municipality.municipalityName, sourceId: source.id, sourceUrl: source.url,
      sourcePageUrl: source.navigationReview?.evidenceUrl ?? source.url, sourceSha256: source.acquisition.sourceSha256!, fetchedAt: source.acquisition.fetchedAt!,
      format, text: whole.text, truncated: !whole.complete });
  }
  inputs.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  return { shard, inputs };
}

/** Runs one extractor over every text of the prefecture; evidence must be exact substrings, ids unique. */
export function run(code: string, entry: Entry, inputs: CachedInput[]): ProjectEvaluation[] {
  setPriorRecords(() => []);
  const records = inputs.flatMap((input) => entry.extract(input, inputs));
  const ids = new Set<string>();
  for (const p of records) {
    if (p.municipalityCode !== code) throw new Error(`Wrong code on ${p.id}`);
    if (ids.has(p.id)) throw new Error(`Duplicate id ${p.id}`);
    ids.add(p.id);
    for (const e of [...p.evidence, ...p.amounts.map((a) => a.evidence), ...p.indicators.map((i) => i.evidence), ...p.ratings.map((r) => r.evidence)]) {
      const src = inputs.find((i) => i.sourceUrl === e.sourceUrl && i.sourceSha256 === e.sha256);
      const pos = e.cell?.match(/^extracted-text:chars:(\d+)-(\d+)$/);
      if (!src || !pos || !e.rawText.length || src.text.slice(Number(pos[1]), Number(pos[2])) !== e.rawText) throw new Error(`Evidence mismatch: ${p.id}`);
    }
    for (const a of p.amounts) if (a.amountYen !== null && (!Number.isSafeInteger(a.amountYen) || a.amountYen < 0)) throw new Error(`Bad amount on ${p.id}`);
  }
  return records;
}

function dataset(code: string, name: string, entry: Entry, inputs: CachedInput[], records: ProjectEvaluation[]): EvaluationDataset {
  const used = inputs.filter((i) => records.some((p) => p.evidence.some((e) => e.sourceUrl === i.sourceUrl)));
  const generatedAt = used.map((i) => i.fetchedAt).sort().at(-1) ?? new Date(0).toISOString();
  const sources: EvaluationSourceStatus[] = used.map((i) => {
    const count = records.filter((p) => p.evidence[0]?.sourceUrl === i.sourceUrl).length;
    return { id: `prefecture-${code}-${i.sourceId}`, municipalityCode: code, municipalityName: name, sourcePageUrl: i.sourcePageUrl, evaluationYear: null, status: 'partial',
      discoveredDocuments: 1, fetchedDocuments: 1, extractedProjects: count, scope: entry.scope,
      message: '都道府県の公式ページに掲載された資料の取得テキストから部分構造化。全事業の網羅は未確認。', lastAttemptAt: i.fetchedAt, lastSuccessAt: i.fetchedAt,
      documents: [{ url: i.sourceUrl, format: i.format, status: 'partial', sha256: i.sourceSha256, fetchedAt: i.fetchedAt, projectCount: count, message: '取得テキストから抽出' }] };
  });
  const value = { schemaVersion: 1 as const, generatedAt, sources, projects: [...records].sort((a, b) => a.id.localeCompare(b.id)) };
  return parseEvaluationDataset(JSON.parse(JSON.stringify(value)));
}

async function registry(): Promise<Record<string, Entry>> {
  if (arg('--module')) {
    const mod = await import(pathToFileURL(resolve(arg('--module')!)).href);
    return (mod.default?.entries ?? mod.entries) as Record<string, Entry>;
  }
  const mod = await import('./extractors/registry');
  return ((mod as { default?: { prefectureExtractors: Record<string, Entry> } }).default?.prefectureExtractors ?? mod.prefectureExtractors);
}

function summary(records: ProjectEvaluation[]) {
  const amounts = records.flatMap((p) => p.amounts);
  const years = new Map<string, number>();
  for (const a of amounts) years.set(`${a.kind}:${a.fiscalYear}`, (years.get(`${a.kind}:${a.fiscalYear}`) ?? 0) + 1);
  return { records: records.length, withActual: records.filter((p) => p.amounts.some((a) => a.kind === 'actual')).length,
    withDepartment: records.filter((p) => p.department).length, amountsByKindYear: Object.fromEntries([...years].sort()),
    indicators: records.reduce((n, p) => n + p.indicators.length, 0), ratings: records.reduce((n, p) => n + p.ratings.length, 0) };
}

if (args.includes('--dump')) {
  // 抽出器を書くための下見: 各資料の全文を <dir>/<code>/<sourceId>.txt に、一覧を index.tsv に書く
  const dir = resolve(arg('--dump')!);
  for (const code of arg('--codes')!.split(',')) {
    const { shard, inputs } = await prefectureInputs(code);
    await mkdir(join(dir, code), { recursive: true });
    const lines = ['sourceId\tformat\tchars\ttitle\turl'];
    for (const i of inputs) {
      const s = shard.sources.find((x) => x.id === i.sourceId)!;
      await writeFile(join(dir, code, `${i.sourceId}.txt`), i.text);
      lines.push([i.sourceId, i.format, i.text.length, s.title.replace(/\s+/g, ' '), i.sourceUrl].join('\t'));
    }
    await writeFile(join(dir, code, 'index.tsv'), lines.join('\n') + '\n');
    console.log(`${code} ${shard.municipality.municipalityName}: ${inputs.length} texts -> ${join(dir, code)}`);
  }
  process.exit(0);
}
const extractors = await registry();
const evidenceIndex: EvidenceIndex = JSON.parse(await readFile(join(evidenceDir, 'index.json'), 'utf8'));
if (args.includes('--dry-run')) {
  const codes = arg('--codes')?.split(',') ?? Object.keys(extractors);
  const sample = Number(arg('--sample') ?? 2);
  for (const code of codes) {
    if (!extractors[code]) throw new Error(`No extractor for ${code}`);
    const { shard, inputs } = await prefectureInputs(code);
    const records = run(code, extractors[code], inputs);
    dataset(code, shard.municipality.municipalityName, extractors[code], inputs, records);
    console.log(JSON.stringify({ code, name: shard.municipality.municipalityName, ...summary(records) }, null, 1));
    for (const p of records.slice(0, sample)) console.log(JSON.stringify({ name: p.projectName, dept: p.department, ey: p.evaluationYear, efy: p.evaluatedFiscalYear,
      amounts: p.amounts.map((a) => `${a.kind}:${a.fiscalYear}:${a.amountYen}`), ind: p.indicators.length, rat: p.ratings.map((r) => `${r.label}=${r.value}`), warn: p.warnings.length }));
  }
} else if (args.includes('--write')) {
  await mkdir(outDir, { recursive: true });
  const rows = []; const written = new Set<string>(); const report: Record<string, unknown> = {};
  for (const entry of evidenceIndex.municipalities) {
    const code = entry.municipalityCode; const ex = extractors[code];
    let records: ProjectEvaluation[] = []; let bytes: Buffer | null = null;
    if (ex) {
      const { shard, inputs } = await prefectureInputs(code);
      records = run(code, ex, inputs);
      if (records.length) { bytes = json(dataset(code, shard.municipality.municipalityName, ex, inputs, records)); report[code] = summary(records); }
    }
    const hash = bytes ? sha256(bytes) : null;
    if (bytes) { const file = `${code}-${hash}.json`; await writeFile(join(outDir, file), bytes); written.add(file); }
    rows.push({ municipalityCode: code, municipalityName: entry.municipalityName, prefectureCode: entry.prefectureCode,
      discoveryStatus: bytes ? 'structured' : entry.discoveryStatus === 'fetched' ? 'fetched' : 'discovered', dataStatus: bytes ? 'primary_available' : 'no_structured_data_yet',
      primaryEvaluationRecords: records.length, historicalEvaluationRecords: 0,
      recordsWithExplicitActualDirectCosts: records.filter((p) => p.amounts.some((a) => a.kind === 'actual')).length,
      recordsWithSourceLabelledOutcomeIndicators: records.filter((p) => p.indicators.length > 0).length, scopeCompleteness: 'not_established',
      datasetPath: bytes ? `evaluations-prefectures/${code}-${hash}.json` : null, datasetSha256: hash, datasetBytes: bytes?.length ?? 0 });
  }
  for (const file of await readdir(outDir)) if (!written.has(file)) await rm(join(outDir, file));
  const evidenceBytes = await readFile(join(evidenceDir, 'index.json'));
  const index = { schemaVersion: 1, datasetKind: 'municipality_evaluation_index', generatedAt: evidenceIndex.snapshotAt, sourceProjectionSha256: sha256(evidenceBytes),
    scopeMunicipalities: rows.length, primaryEvaluationRecords: rows.reduce((n, r) => n + r.primaryEvaluationRecords, 0),
    primaryMunicipalities: rows.filter((r) => r.dataStatus === 'primary_available').length, municipalities: rows,
    notes: ['都道府県の整理済み事業票。各都道府県の公式ページに掲載された評価資料・成果説明書の取得テキストから部分構造化したもので、全事業の網羅は未確認。'] };
  await writeFile(indexPath, json(index));
  console.log(JSON.stringify({ prefectures: index.primaryMunicipalities, records: index.primaryEvaluationRecords, report }, null, 1));
} else throw new Error('Use --dry-run [--codes c,...] [--module file] or --write');
