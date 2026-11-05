/**
 * dots の隔離候補（data/evaluations/descending-*\/*\/inputs）を、取り込み前レビュー（data/evaluations/descending-import/decisions.json）で
 * 絞って、取り込み用の自治体別入力にまとめる。同じ自治体が offline と layouts の両方にあるときは1本にまとめ、出典ごとの事業数は残った事業から
 * 数え直す（取り込みの検査に合わせる）。事業の主な根拠でない資料も、残った事業の根拠に使われていれば事業数0で残す。
 *   node --import tsx apps/crawler/src/assemble-descending-inputs.ts --output-dir <dir> [--codes <c,...>]
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvaluationDataset, EvaluationEvidence, EvaluationSourceStatus, ProjectEvaluation } from '../../web/src/types/evaluation';

/** 候補の抽出時刻（全入力共通）。取り込み済みの入力はこの時刻のまま再現する。 */
export const DESCENDING_GENERATED_AT = '2026-11-01T13:00:00.000Z';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const arg = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const output = arg('--output-dir'), only = arg('--codes')?.split(',');
if (!output) throw new Error('Use --output-dir <dir> [--codes <c,...>]');

interface Decisions { sources: { municipalityCode: string; sha256: string; include: boolean }[]; projects: { id: string; include: boolean }[] }
const decisions: Decisions = JSON.parse(await readFile(join(root, 'data/evaluations/descending-import/decisions.json'), 'utf8'));
const included = new Map(decisions.sources.map(d => [`${d.municipalityCode}\n${d.sha256}`, d.include]));
const dropped = new Set(decisions.projects.filter(d => !d.include).map(d => d.id));

const files = new Map<string, EvaluationDataset[]>();
for (const kind of ['descending-layouts', 'descending-offline']) {
  const base = join(root, 'data/evaluations', kind);
  for (const pref of (await readdir(base)).sort()) {
    const dir = join(base, pref, 'inputs');
    const names = await readdir(dir).catch(() => [] as string[]);
    for (const name of names.filter(n => n.endsWith('.json'))) {
      const list = files.get(name) ?? [];
      list.push(JSON.parse(await readFile(join(dir, name), 'utf8')));
      files.set(name, list);
    }
  }
}
const key = (url: string, sha: string | null) => `${url}\n${sha}`;
const cites = (p: ProjectEvaluation): EvaluationEvidence[] => [...p.evidence, ...p.amounts.map(a => a.evidence), ...p.indicators.map(i => i.evidence), ...p.ratings.map(r => r.evidence)];
await mkdir(output, { recursive: true });
let municipalities = 0, records = 0;
// 並びは Python 版（sorted(glob)）と同じく layouts → offline の順に重ねる
for (const name of [...files.keys()].sort()) {
  const code = name.slice(0, 5);
  if (only && !only.includes(code)) continue;
  const sets = files.get(name)!;
  const all = sets.flatMap(d => d.projects), seen = new Set<string>(), sources: EvaluationSourceStatus[] = [];
  for (const d of sets) for (const s of d.sources) if (!seen.has(s.id)) { seen.add(s.id); sources.push(s); }
  if (new Set(all.map(p => p.id)).size !== all.length) throw new Error(`Duplicate candidate ID: ${name}`);
  const projects = all.filter(p => included.get(`${code}\n${p.evidence[0].sha256}`) === true && !dropped.has(p.id));
  if (!projects.length) continue;
  const count = new Map<string, number>();
  for (const p of projects) { const k = key(p.evidence[0].sourceUrl, p.evidence[0].sha256); count.set(k, (count.get(k) ?? 0) + 1); }
  const cited = new Set(projects.flatMap(cites).map(e => key(e.sourceUrl, e.sha256)));
  const kept: EvaluationSourceStatus[] = [];
  for (const s of sources) {
    const docs = s.documents.flatMap(doc => {
      const k = key(doc.url, doc.sha256), n = count.get(k) ?? 0;
      count.delete(k);
      return n || cited.has(k) ? [{ ...doc, projectCount: n }] : [];
    });
    if (docs.length) kept.push({ ...s, documents: docs, discoveredDocuments: docs.length, fetchedDocuments: docs.length, extractedProjects: docs.reduce((n, d) => n + d.projectCount, 0) });
  }
  if (count.size) throw new Error(`Primary evidence without a source document: ${name}`);
  await writeFile(join(output, name), JSON.stringify({ ...sets[0], projects, sources: kept }) + '\n');
  municipalities++; records += projects.length;
}
console.log(JSON.stringify({ municipalities, records }));
