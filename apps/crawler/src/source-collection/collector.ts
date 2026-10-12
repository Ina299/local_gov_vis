/** Independent raw-source collector. Cache/allowlist design follows PR #1's
 * evaluations/fetch.ts; it never writes the existing evaluation or budget data. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export interface Source {
  url: string;
  sourcePageUrl: string;
  municipalityCode: string;
  municipalityName: string;
  title: string;
  fiscalYear: number | null;
  amountKind: string | null;
  // A per-URL review against the existing quarantine is required, even when
  // the complete quarantine cannot be restored in this environment.
  review: { checkedAt: string; evidence: string };
}
export interface Queue {
  version: 1;
  quarantineHosts: string[];
  sources: Source[];
}
export interface Entry {
  source: Source;
  state: 'pending' | 'fetched' | 'failed' | 'blocked';
  attemptedAt?: string;
  fetchedAt?: string;
  sha256?: string;
  bytes?: number;
  contentType?: string;
  file?: string;
  httpStatus?: number;
  message?: string;
  extraction: 'not_started';
}
interface Manifest {
  version: 1;
  entries: Record<string, Entry>;
  blockedHosts: Record<string, string>;
}
export interface Options {
  outputDir: string;
  execute?: boolean;
  workers?: number;
  delayMs?: number;
  maxBytes?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
function canonical(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash ||
      url.hostname === 'localhost' || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) {
    throw new Error('Only credential-free public HTTPS URLs without fragments are accepted');
  }
  return url;
}
function quarantined(host: string, hosts: string[]) {
  return hosts.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}
export function validateQueue(value: Queue): Queue {
  if (value?.version !== 1 || !Array.isArray(value.sources) || !Array.isArray(value.quarantineHosts)) {
    throw new Error('Invalid queue schema');
  }
  for (const host of value.quarantineHosts) {
    if (typeof host !== 'string' || !/^[a-z0-9.-]+$/.test(host) || host.startsWith('.')) throw new Error('Invalid quarantine host');
  }
  const seen = new Set<string>();
  for (const source of value.sources) {
    const url = canonical(source.url);
    canonical(source.sourcePageUrl);
    if (source.url !== url.href || seen.has(source.url)) throw new Error('URLs must be unique and canonical');
    seen.add(source.url);
    if (!/^\d{5}$/.test(source.municipalityCode) || !source.municipalityName?.trim() || !source.title?.trim() ||
        !(source.fiscalYear === null || Number.isInteger(source.fiscalYear)) ||
        !(source.amountKind === null || typeof source.amountKind === 'string') ||
        !source.review?.evidence?.trim() || !Number.isFinite(Date.parse(source.review.checkedAt))) {
      throw new Error('Missing source metadata or explicit quarantine review');
    }
  }
  return value;
}
async function atomic(path: string, value: string | Uint8Array) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}
async function readManifest(path: string): Promise<Manifest> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as Manifest;
    if (value.version !== 1 || !value.entries || !value.blockedHosts ||
        Array.isArray(value.entries) || Array.isArray(value.blockedHosts)) throw new Error('Invalid checkpoint');
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, entries: {}, blockedHosts: {} };
    throw error;
  }
}
class Stop extends Error {
  constructor(message: string, readonly block: boolean, readonly status?: number) { super(message); }
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function renderIndex(manifest: Manifest): string {
  const entries = Object.values(manifest.entries);
  const fetched = entries.filter((entry) => entry.state === 'fetched');
  const rows = entries.map((entry) => {
    const s = entry.source;
    return `<tr><td>${escapeHtml(s.municipalityName)} (${escapeHtml(s.municipalityCode)})</td><td><a href="${escapeHtml(s.url)}" rel="noreferrer">${escapeHtml(s.title)}</a><br><a href="${escapeHtml(s.sourcePageUrl)}" rel="noreferrer">公式掲載ページ</a></td><td>${escapeHtml(entry.state)}</td><td>${s.fiscalYear ?? '未確認'} / ${escapeHtml(s.amountKind ?? '未確認')}</td><td>${escapeHtml(entry.fetchedAt ?? '未取得')}<br>${escapeHtml(entry.sha256 ?? '')}</td><td>${escapeHtml(entry.message ?? '')}</td></tr>`;
  }).join('\n');
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>原典取得状況</title><style>body{font:16px system-ui;margin:2rem;color:#172b3a}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:.7rem;text-align:left;overflow-wrap:anywhere}a{color:#075a9c}</style><h1>原典取得状況</h1><p>このキュー: ${new Set(entries.map(e => e.source.municipalityCode)).size}自治体・${entries.length}資料。本文取得済み: ${new Set(fetched.map(e => e.source.municipalityCode)).size}自治体・${fetched.length}資料。構造化: 未実施。</p><p>全国の収集完了を示すものではありません。年度・金額種別が未確認の資料は推測で補完しません。未取得の資料も原典リンクから閲覧できます。保存した原典は manifest.json の file に記録しています。</p><table><thead><tr><th>自治体</th><th>公開原典</th><th>取得</th><th>年度 / 金額種別</th><th>取得日時 / SHA256</th><th>詳細</th></tr></thead><tbody>${rows}</tbody></table></html>`;
}

export async function collect(input: Queue, options: Options) {
  const queue = validateQueue(input);
  const workers = options.workers ?? 2;
  const delayMs = options.delayMs ?? 1500;
  const maxBytes = options.maxBytes ?? 20 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isInteger(workers) || workers < 1 || workers > 4 || !Number.isFinite(delayMs) || delayMs < 1000 ||
      !Number.isInteger(maxBytes) || maxBytes < 1 || !Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error('Invalid limits');
  if (!options.execute) return { dryRun: true, documents: queue.sources.length, municipalities: new Set(queue.sources.map(s => s.municipalityCode)).size };
  await mkdir(options.outputDir, { recursive: true });
  // Prevent two processes from violating per-host pacing or overwriting state.
  const lockPath = join(options.outputDir, 'collection.lock');
  const lock = await open(lockPath, 'wx');
  try {
    const path = join(options.outputDir, 'manifest.json');
    const manifest = await readManifest(path);
    await mkdir(join(options.outputDir, 'objects'), { recursive: true });
    const request = options.fetchImpl ?? fetch;
    const now = options.now ?? Date.now;
    const pause = options.sleep ?? sleep;
    const groups = new Map<string, Source[]>();
    for (const source of queue.sources) {
      const key = hash(source.url);
      const prior = manifest.entries[key];
      if (prior && JSON.stringify(prior.source) !== JSON.stringify(source)) throw new Error('Existing source metadata differs; use a separate output directory');
      manifest.entries[key] ??= { source, state: 'pending', extraction: 'not_started' };
      const host = canonical(source.url).hostname;
      groups.set(host, [...(groups.get(host) ?? []), source]);
    }
    let saving = Promise.resolve();
    const save = () => {
      // Serialize snapshots across workers; an interrupted run keeps the latest complete checkpoint.
      const json = `${JSON.stringify(manifest, null, 2)}\n`;
      const html = renderIndex(manifest);
      saving = saving.then(async () => { await atomic(path, json); await atomic(join(options.outputDir, 'index.html'), html); });
      return saving;
    };
    await save();
    const pending = [...groups];
    const results = await Promise.allSettled(Array.from({ length: workers }, async () => {
      while (pending.length) {
        const [host, sources] = pending.shift()!;
        let nextAt = 0;
        for (const source of sources) {
          const entry = manifest.entries[hash(source.url)];
          // Terminal failures are not automatically retried on restart.
          if (entry.state === 'failed' || entry.state === 'blocked') continue;
          if (quarantined(host, queue.quarantineHosts) || manifest.blockedHosts[host] ||
              host === 'drive.google.com' || host.endsWith('.googleusercontent.com')) {
            entry.state = 'blocked'; entry.message = 'Host quarantined or requires separate warning approval'; await save(); continue;
          }
          if (entry.state === 'fetched') {
            if (!entry.sha256 || !/^[a-f0-9]{64}$/.test(entry.sha256) || entry.file !== `objects/${entry.sha256}.bin`) throw new Error('Invalid cache metadata');
            const bytes = await readFile(join(options.outputDir, entry.file));
            if (hash(bytes) !== entry.sha256 || bytes.length !== entry.bytes) throw new Error('Cache integrity failure; no automatic redownload');
            continue;
          }
          await pause(Math.max(0, nextAt - now()));
          entry.attemptedAt = new Date(now()).toISOString();
          // Persist before the request: uncertain interrupted requests must be reviewed,
          // not replayed as if no access restriction could have been received.
          entry.state = 'failed'; entry.message = 'Attempt started; if interrupted, review before retry';
          manifest.blockedHosts[host] = 'Attempt interrupted or incomplete; review before further requests';
          await save();
          try {
            const response = await request(source.url, {
              redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
              headers: { 'User-Agent': 'local-gov-vis-source-collection/1.0 (public municipal evaluation research)' },
            });
            entry.httpStatus = response.status;
            if (!response.ok) {
              await response.body?.cancel();
              // Redirect targets are intentionally not followed, even on the same host.
              throw new Stop(`HTTP ${response.status}; no retry or redirect follow`, true, response.status);
            }
            if (Number(response.headers.get('content-length')) > maxBytes) { await response.body?.cancel(); throw new Stop('Content exceeds size limit', false); }
            if (!response.body) throw new Stop('Empty response', false);
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = []; let length = 0;
            try {
              while (true) {
                const part = await reader.read(); if (part.done) break;
                length += part.value.length;
                if (length > maxBytes) throw new Stop('Content exceeds size limit', false);
                chunks.push(part.value);
              }
            } catch (error) { await reader.cancel(); throw error; }
            finally { reader.releaseLock(); }
            const bytes = Buffer.concat(chunks);
            if (!bytes.length) throw new Stop('Empty response', false);
            const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
            const sample = bytes.subarray(0, 128 * 1024).toString('utf8');
            if (/virus scan|can.t scan|ウイルス.*スキャン|access denied|access forbidden|captcha|認証が必要|アクセスが拒否|type\s*=\s*["']password/i.test(sample)) {
              throw new Stop('Access, authentication or scan warning detected; approval required', true);
            }
            if (/\.pdf$/i.test(new URL(source.url).pathname) && bytes.subarray(0, 5).toString() !== '%PDF-') throw new Stop('Expected PDF but received another format; review required', true);
            const sha256 = hash(bytes);
            const file = `objects/${sha256}.bin`;
            await atomic(join(options.outputDir, file), bytes);
            Object.assign(entry, { state: 'fetched', sha256, file, bytes: bytes.length, contentType, fetchedAt: new Date(now()).toISOString(), message: 'Original saved; numeric extraction not started' });
            delete manifest.blockedHosts[host];
          } catch (error) {
            const failure = error instanceof Stop ? error : new Stop('Transport failure; inspect environment before retry', true);
            entry.state = failure.block ? 'blocked' : 'failed';
            entry.message = failure.message;
            if (failure.block) manifest.blockedHosts[host] = failure.message;
            else delete manifest.blockedHosts[host];
          }
          // Minimum gap after completion, including errors, rather than between starts.
          nextAt = now() + delayMs;
          await save();
        }
      }
    }));
    await saving;
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected?.status === 'rejected') throw rejected.reason;
    return { dryRun: false, manifest };
  } finally { await lock.close(); await unlink(lockPath); }
}
