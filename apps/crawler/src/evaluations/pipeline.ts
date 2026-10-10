import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { EvaluationDataset, EvaluationSourceStatus, ProjectEvaluation } from '../../../web/src/types/evaluation';
import { SOURCE_CATALOG, discoverDocuments, parseEvaluationDocument } from './adapters';
import type { SourceDefinition, DiscoveredDocument } from './adapters';
import { OfficialSourceFetcher, atomicJson } from './fetch';
import type { Artifact } from './fetch';
import { validateExtraction } from './validate';

/** Bump whenever extraction semantics change; cached bytes remain reusable. */
export const PARSER_VERSION = '1';
interface SavedDocument {
  sha256: string;
  parserVersion: string;
  document: DiscoveredDocument;
  projects: ProjectEvaluation[];
  status: 'ok' | 'partial' | 'unsupported';
  message: string;
}
interface Checkpoint {
  version: 1;
  documents: Record<string, SavedDocument>;
}
export interface ImportOptions {
  root: string;
  sourceIds?: string[];
  limit?: number;
  offline?: boolean;
  force?: boolean;
  sources?: SourceDefinition[];
  fetchArtifact?: (source: SourceDefinition, url: string) => Promise<Artifact>;
  discover?: typeof discoverDocuments;
  parse?: typeof parseEvaluationDocument;
  now?: () => string;
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(path, 'utf8')) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    // A corrupt checkpoint must be fixed rather than silently discard resumable state.
    throw error;
  }
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function importEvaluations(options: ImportOptions): Promise<EvaluationDataset> {
  const sources = options.sources ?? SOURCE_CATALOG;
  for (const id of options.sourceIds ?? []) {
    if (!sources.some((source) => source.id === id)) throw new Error(`Unknown source: ${id}`);
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 500)) {
    throw new Error('--limit must be an integer between 1 and 500');
  }
  const selected = sources.filter((source) => !options.sourceIds?.length || options.sourceIds.includes(source.id));
  const stateDir = join(options.root, 'apps/crawler/output/evaluations');
  const outputPath = join(options.root, 'data/evaluations/evaluations.json');
  const publicPath = join(options.root, 'apps/web/public/evaluations.json');
  await Promise.all([stateDir, dirname(outputPath), dirname(publicPath)].map((path) => mkdir(path, { recursive: true })));
  const checkpointPath = join(stateDir, 'checkpoint.json');
  const checkpoint = await readJson<Checkpoint>(checkpointPath) ?? { version: 1, documents: {} };
  if (checkpoint.version !== 1 || typeof checkpoint.documents !== 'object') throw new Error('Unsupported checkpoint');
  const previous = await readJson<EvaluationDataset>(outputPath);
  if (previous && previous.schemaVersion !== 1) throw new Error('Unsupported existing evaluation dataset');
  const now = options.now ?? (() => new Date().toISOString());
  const runAt = now();
  const original = previous ? structuredClone(previous) : undefined;
  const dataset: EvaluationDataset = previous ?? { schemaVersion: 1, generatedAt: runAt, sources: [], projects: [] };
  const save = async () => {
    dataset.sources.sort((a, b) => a.id.localeCompare(b.id));
    dataset.projects.sort((a, b) => a.id.localeCompare(b.id));
    // Successful offline replay is byte-stable, including generatedAt and provenance timestamps.
    const before = original ? JSON.stringify({ sources: original.sources, projects: original.projects }) : '';
    const after = JSON.stringify({ sources: dataset.sources, projects: dataset.projects });
    if (before !== after) dataset.generatedAt = runAt;
    await atomicJson(checkpointPath, checkpoint);
    await atomicJson(outputPath, dataset);
    await atomicJson(publicPath, dataset);
  };

  for (const source of selected) {
    const priorStatus = original?.sources.find((item) => item.id === source.id);
    const priorProjects = original?.projects.filter((project) => project.municipalityCode === source.municipalityCode) ?? [];
    const fetcher = new OfficialSourceFetcher({
      cacheDir: join(stateDir, 'cache'), allowedHosts: source.allowedHosts, offline: options.offline,
      maxRequests: Math.min(2000, source.maxDocuments * 6 + 30),
    });
    const get = (url: string) => options.fetchArtifact ? options.fetchArtifact(source, url) : fetcher.get(url);
    const status: EvaluationSourceStatus = {
      id: source.id, municipalityCode: source.municipalityCode, municipalityName: source.municipalityName,
      sourcePageUrl: source.indexUrl, evaluationYear: null, status: 'pending',
      discoveredDocuments: 0, fetchedDocuments: 0, extractedProjects: 0,
      scope: source.scope, message: '',
      lastAttemptAt: options.offline ? priorStatus?.lastAttemptAt ?? runAt : runAt,
      lastSuccessAt: priorStatus?.lastSuccessAt ?? null, documents: [],
    };
    dataset.sources = dataset.sources.filter((item) => item.id !== source.id).concat(status);
    try {
      const discovery = await (options.discover ?? discoverDocuments)(source, get);
      status.sourcePageUrl = discovery.sourcePageUrl;
      status.evaluationYear = discovery.evaluationYear;
      const documents = [...new Map(discovery.documents.map((doc) => [doc.url, doc])).values()];
      status.discoveredDocuments = documents.length;
      if (!documents.length) throw new Error('Latest official index contained no supported evaluation document links');
      const limit = Math.min(options.limit ?? source.maxDocuments, source.maxDocuments);
      const selectedDocuments = documents.slice(0, limit);
      let sourceProjects: ProjectEvaluation[] = [...priorProjects];
      const warnings = [...discovery.warnings];
      if (documents.length > limit) warnings.push(`取得上限 ${limit} 文書。未取得 ${documents.length - limit} 文書は次回 --limit とカタログ上限で調整してください。`);
      for (const doc of selectedDocuments) {
        const documentStatus: EvaluationSourceStatus['documents'][number] = {
          url: doc.url, format: doc.format, status: 'pending', sha256: null,
          fetchedAt: null, projectCount: 0, message: '',
        };
        status.documents.push(documentStatus);
        try {
          const artifact = await get(doc.url);
          documentStatus.sha256 = artifact.sha256;
          documentStatus.fetchedAt = artifact.fetchedAt;
          status.fetchedDocuments++;
          const key = `${source.id}:${doc.url}`;
          const saved = checkpoint.documents[key];
          const canReuse = !options.force && saved?.sha256 === artifact.sha256 && saved.parserVersion === PARSER_VERSION &&
            JSON.stringify(saved.document) === JSON.stringify(doc);
          const result = canReuse ? saved : await (options.parse ?? parseEvaluationDocument)(doc, artifact.bytes, {
            fetchedAt: artifact.fetchedAt, sha256: artifact.sha256,
          });
          validateExtraction(result, doc, artifact);
          documentStatus.status = result.status;
          documentStatus.message = result.message;
          documentStatus.projectCount = result.projects.length;
          if (result.status === 'ok') {
            sourceProjects = sourceProjects.filter((project) => !project.evidence.some((evidence) => evidence.sourceUrl === doc.url));
            sourceProjects.push(...result.projects);
          } else if (result.status === 'partial') {
            const currentIds = new Set(result.projects.map((project) => project.id));
            const retained = sourceProjects.filter((project) => !currentIds.has(project.id) && project.evidence.some((evidence) => evidence.sourceUrl === doc.url));
            sourceProjects.push(...result.projects);
            documentStatus.projectCount += retained.length;
            if (retained.length) documentStatus.message += '（今回未抽出の事業は前回取得分を表示）';
          } else {
            const retained = sourceProjects.filter((project) => project.evidence.some((evidence) => evidence.sourceUrl === doc.url));
            documentStatus.projectCount = retained.length;
            if (retained.length) documentStatus.message += '（前回取得分を表示）';
          }
          checkpoint.documents[key] = {
            sha256: artifact.sha256, parserVersion: PARSER_VERSION, document: doc,
            projects: result.projects, status: result.status, message: result.message,
          };
          await atomicJson(checkpointPath, checkpoint);
        } catch (error) {
          documentStatus.status = 'failed';
          documentStatus.message = errorText(error);
          // The last successful document remains usable, but acquisition is visibly failed/stale.
          const retained = priorProjects.filter((project) => project.evidence.some((evidence) => evidence.sourceUrl === doc.url));
          documentStatus.projectCount = retained.length;
          if (retained.length) documentStatus.message += '（前回取得分を表示）';
        }
        sourceProjects = [...new Map(sourceProjects.map((project) => [project.id, project])).values()];
        status.extractedProjects = sourceProjects.length;
        dataset.projects = dataset.projects.filter((project) => project.municipalityCode !== source.municipalityCode)
          .concat([...new Map(sourceProjects.map((project) => [project.id, project])).values()]);
        // Persist after each document: a killed process resumes from its last successful extraction.
        status.message = '取得中。中断した場合は同じコマンドで再開できます。';
        await save();
      }
      const allOk = status.documents.every((doc) => doc.status === 'ok');
      // Never remove untouched records during a bounded/interrupted/failed refresh.
      // Prune retired links only after a complete, fully successful index + document pass.
      if (allOk && !warnings.length && documents.length <= limit) {
        const currentUrls = new Set(documents.map((doc) => doc.url));
        sourceProjects = sourceProjects.filter((project) => project.evidence.some((evidence) => currentUrls.has(evidence.sourceUrl)));
        status.extractedProjects = sourceProjects.length;
        dataset.projects = dataset.projects.filter((project) => project.municipalityCode !== source.municipalityCode).concat(sourceProjects);
      }
      const anyUseful = status.documents.some((doc) => doc.status === 'ok' || doc.status === 'partial');
      status.status = allOk && !warnings.length ? 'ok' : anyUseful ? 'partial' :
        status.documents.every((doc) => doc.status === 'unsupported') ? 'unsupported' : 'failed';
      status.message = [...warnings, `${status.fetchedDocuments}/${status.discoveredDocuments} 文書取得、${status.extractedProjects} 事業を表示（取得失敗・上限外の前回取得分は保持）。`,
        ...status.documents.filter((doc) => doc.status !== 'ok').map((doc) => `${doc.status}: ${doc.message}`)].join(' ');
      if (allOk || anyUseful) status.lastSuccessAt = options.offline ? priorStatus?.lastSuccessAt ?? runAt : runAt;
    } catch (error) {
      status.status = 'failed';
      status.message = `${errorText(error)}${priorProjects.length ? '（前回取得分を表示。最新年度は未確認）' : ''}`;
      status.evaluationYear = priorStatus?.evaluationYear ?? null;
      status.extractedProjects = priorProjects.length;
      dataset.projects = dataset.projects.filter((project) => project.municipalityCode !== source.municipalityCode).concat(priorProjects);
    }
    await save();
    console.log(`${source.municipalityName}: ${status.status} — ${status.message}`);
  }
  // Omitted source IDs retain their data; publish only the bounded catalog and run's results.
  if (original && JSON.stringify({ ...dataset, generatedAt: original.generatedAt }) === JSON.stringify(original)) {
    dataset.generatedAt = original.generatedAt;
    await save();
  }
  return dataset;
}
