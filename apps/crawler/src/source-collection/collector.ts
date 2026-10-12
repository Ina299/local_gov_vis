/** Independent raw-source collector. Cache/allowlist design follows PR #1's
 * evaluations/fetch.ts; it never writes the existing evaluation or budget data. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { createTransport, type Transport } from './network';

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
  state: 'pending' | 'fetched' | 'failed' | 'blocked' | 'paused';
  failureKind?: 'http_denial' | 'http_error' | 'proxy_denial' | 'proxy_error' | 'redirect' | 'warning' | 'content' | 'timeout' | 'transport' | 'interrupted';
  proxyHttpStatus?: number;
  elapsedMs?: number;
  timeoutMs?: number;
  timeoutTriggered?: boolean;
  completedAt?: string;
  attemptedAt?: string;
  fetchedAt?: string;
  sha256?: string;
  bytes?: number;
  contentType?: string;
  file?: string;
  httpStatus?: number;
  resolvedUrl?: string;
  redirects?: string[];
  message?: string;
  extraction: 'not_started';
}
interface Manifest {
  version: 1;
  entries: Record<string, Entry>;
  blockedHosts: Record<string, string>;
  hostFailures?: Record<string, Pick<Entry, 'failureKind' | 'httpStatus' | 'proxyHttpStatus'>>;
}
export interface Options {
  outputDir: string;
  execute?: boolean;
  workers?: number;
  delayMs?: number;
  maxBytes?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
}
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms: number, signal?: AbortSignal) => wait(ms, undefined, { signal });
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
    // Older versions used one stop label for both denial and unknown transport
    // errors. Preserve every host stop; only correct the diagnostic category.
    for (const entry of Object.values(value.entries)) {
      if (entry.state === 'blocked' && !entry.failureKind && entry.message?.startsWith('Transport failure')) {
        entry.state = 'paused'; entry.failureKind = 'transport';
      }
    }
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, entries: {}, blockedHosts: {} };
    throw error;
  }
}
class Stop extends Error {
  constructor(message: string, readonly block: boolean, readonly status?: number) { super(message); }
}
export function transportError(error: unknown): string {
  // Keep only bounded diagnostic identifiers, never error messages containing URLs,
  // credentials, proxy addresses or response bodies.
  const fields: string[] = [];
  let current = error;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth++) {
    const value = current as { name?: unknown; code?: unknown; cause?: unknown };
    for (const identifier of [value.name, value.code]) {
      if (typeof identifier === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(identifier)) fields.push(identifier);
    }
    current = value.cause;
  }
  return `Transport failure${fields.length ? ` (${[...new Set(fields)].join(', ')})` : ''}; inspect environment before retry`;
}
function proxyStatus(error: unknown): number | undefined {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const value = current as { message?: unknown; cause?: unknown };
    // Undici exposes CONNECT status in this exact fixed-format error, rather
    // than a Response. Extract only the integer; never retain raw messages.
    const match = typeof value.message === 'string' && /^Proxy response \((\d{3})\) !== 200 when HTTP Tunneling$/.exec(value.message);
    if (match) return Number(match[1]);
    current = value.cause;
  }
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function stateLabel(entry: Entry): string {
  if (entry.failureKind === 'proxy_denial' || entry.failureKind === 'proxy_error') return `プロキシ HTTP ${entry.proxyHttpStatus} による停止（自治体の応答なし）`;
  if (entry.failureKind === 'timeout') return '通信タイムアウト（拒否とは未判定）';
  if (entry.failureKind === 'http_denial') return `HTTP ${entry.httpStatus} による拒否`;
  if (entry.state === 'paused' || entry.message?.startsWith('Transport failure')) return '通信未完了・原因確認待ち（拒否とは未判定）';
  return entry.state;
}
export function renderIndex(manifest: Manifest): string {
  const entries = Object.values(manifest.entries);
  const fetched = entries.filter((entry) => entry.state === 'fetched');
  const rows = entries.map((entry) => {
    const s = entry.source;
    return `<tr><td>${escapeHtml(s.municipalityName)} (${escapeHtml(s.municipalityCode)})</td><td><a href="${escapeHtml(s.url)}" rel="noreferrer">${escapeHtml(s.title)}</a><br><a href="${escapeHtml(s.sourcePageUrl)}" rel="noreferrer">公式掲載ページ</a></td><td>${escapeHtml(stateLabel(entry))}</td><td>${s.fiscalYear ?? '未確認'} / ${escapeHtml(s.amountKind ?? '未確認')}</td><td>${escapeHtml(entry.fetchedAt ?? '未取得')}<br>${escapeHtml(entry.sha256 ?? '')}</td><td>${escapeHtml(entry.message ?? '')}</td></tr>`;
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
    manifest.hostFailures ??= {};
    await mkdir(join(options.outputDir, 'objects'), { recursive: true });
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
          if (entry.state === 'failed' || entry.state === 'blocked' || entry.state === 'paused') continue;
          if (quarantined(host, queue.quarantineHosts) || manifest.blockedHosts[host] ||
              host === 'drive.google.com' || host.endsWith('.googleusercontent.com')) {
            const previous = manifest.blockedHosts[host];
            const detail = manifest.hostFailures![host];
            entry.state = detail?.failureKind === 'proxy_denial' || detail?.failureKind === 'http_denial' ? 'blocked' :
              previous?.startsWith('Transport failure') || /^(Attempt interrupted|Interrupted attempt)/.test(previous ?? '') ? 'paused' : 'blocked';
            if (entry.state === 'paused') entry.failureKind = previous?.startsWith('Transport failure') ? 'transport' : 'interrupted';
            if (detail) Object.assign(entry, detail);
            entry.message = previous ?? 'Host quarantined or requires separate warning approval'; await save(); continue;
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
          entry.state = 'paused'; entry.failureKind = 'interrupted'; entry.message = 'Attempt started; if interrupted, review before retry';
          manifest.blockedHosts[host] = 'Attempt interrupted or incomplete; review before further requests';
          manifest.hostFailures![host] = { failureKind: 'interrupted' };
          await save();
          const started = performance.now();
          const controller = new AbortController();
          entry.timeoutMs = timeoutMs;
          const timer = setTimeout(() => controller.abort(new DOMException('Document deadline exceeded', 'TimeoutError')), timeoutMs);
          let transport: Transport | undefined;
          try {
            // Each document owns and destroys its sockets, including after abort.
            // Injected offline transports never configure the environment's proxy.
            const request = options.fetchImpl ?? (transport = createTransport()).request;
            let current = source.url;
            let response: Response;
            const redirects: string[] = [];
            for (;;) {
              controller.signal.throwIfAborted();
              response = await request(current, {
                redirect: 'manual', signal: controller.signal,
                headers: { 'User-Agent': 'local-gov-vis-source-collection/1.0 (public municipal evaluation research)' },
              });
              entry.httpStatus = response.status;
              if (![301, 302, 303, 307, 308].includes(response.status)) break;
              const location = response.headers.get('location');
              await response.body?.cancel();
              if (!location || redirects.length >= 4) throw new Stop('Missing or excessive redirect; stopped', true, response.status);
              const target = canonical(new URL(location, current).href);
              if (target.hostname !== host) throw new Stop('Cross-host redirect; target not requested', true, response.status);
              if (redirects.includes(target.href) || target.href === source.url) throw new Stop('Redirect loop; stopped', true, response.status);
              redirects.push(target.href);
              entry.redirects = [...redirects];
              current = target.href;
              await pause(delayMs, controller.signal);
            }
            entry.resolvedUrl = current;
            entry.httpStatus = response.status;
            if (!response.ok) {
              await response.body?.cancel();
              throw new Stop(`HTTP ${response.status}; no retry`, true, response.status);
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
            } catch (error) { await reader.cancel().catch(() => {}); throw error; }
            finally { reader.releaseLock(); }
            const bytes = Buffer.concat(chunks);
            clearTimeout(timer);
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
            delete entry.failureKind;
            delete manifest.blockedHosts[host];
            delete manifest.hostFailures![host];
          } catch (error) {
            const failure = error instanceof Stop ? error : new Stop(transportError(error), true);
            if (!(error instanceof Stop)) {
              entry.proxyHttpStatus = proxyStatus(error);
              entry.failureKind = entry.proxyHttpStatus ? [401, 403, 407].includes(entry.proxyHttpStatus) ? 'proxy_denial' : 'proxy_error' : controller.signal.aborted ? 'timeout' : 'transport';
              entry.state = entry.failureKind === 'proxy_denial' ? 'blocked' : 'paused';
            } else {
              entry.failureKind = failure.status === 401 || failure.status === 403 ? 'http_denial' :
                failure.status && failure.status >= 300 && failure.status < 400 ? 'redirect' :
                failure.status ? 'http_error' : failure.message.includes('warning') ? 'warning' : 'content';
              entry.state = failure.block ? 'blocked' : 'failed';
            }
            entry.message = failure.message;
            if (failure.block) manifest.blockedHosts[host] = failure.message;
            else delete manifest.blockedHosts[host];
            if (failure.block) manifest.hostFailures![host] = { failureKind: entry.failureKind, httpStatus: entry.httpStatus, proxyHttpStatus: entry.proxyHttpStatus };
            else delete manifest.hostFailures![host];
          } finally {
            clearTimeout(timer);
            await transport?.destroy();
            entry.elapsedMs = Math.round((performance.now() - started) * 1000) / 1000;
            entry.timeoutTriggered = controller.signal.aborted;
            entry.completedAt = new Date(now()).toISOString();
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
