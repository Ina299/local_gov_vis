import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface Artifact {
  bytes: Uint8Array;
  fetchedAt: string;
  sha256: string;
}
interface CacheEntry {
  url: string;
  sha256: string;
  fetchedAt: string;
  etag?: string;
  lastModified?: string;
}
export interface FetchOptions {
  cacheDir: string;
  allowedHosts: string[];
  offline?: boolean;
  maxBytes?: number;
  maxRequests?: number;
  delayMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** No alternate-host fallbacks: each URL, including redirects, is checked before use. */
export function assertAllowedUrl(value: string, allowedHosts: string[]): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !allowedHosts.includes(url.hostname)) {
    throw new Error(`Official-source allowlist rejected URL: ${value}`);
  }
  url.hash = '';
  return url;
}

export async function atomicJson(path: string, data: unknown): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`);
  await rename(temporary, path);
}

export class OfficialSourceFetcher {
  private requests = 0;
  private nextRequestAt = 0;
  private memory = new Map<string, Artifact>();
  private sleep: (ms: number) => Promise<void>;
  private request: typeof fetch;
  constructor(private options: FetchOptions) {
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.request = options.fetchImpl ?? fetch;
  }

  async get(value: string): Promise<Artifact> {
    const url = assertAllowedUrl(value, this.options.allowedHosts).href;
    const existing = this.memory.get(url);
    if (existing) return existing;
    await mkdir(this.options.cacheDir, { recursive: true });
    const key = createHash('sha256').update(url).digest('hex');
    const metadataPath = join(this.options.cacheDir, `${key}.json`);
    let cached: CacheEntry | undefined;
    let cachedBytes: Uint8Array | undefined;
    try {
      cached = JSON.parse(await readFile(metadataPath, 'utf8')) as CacheEntry;
      if (cached.url !== url || !/^[a-f0-9]{64}$/.test(cached.sha256)) throw new Error('Invalid cache');
      cachedBytes = await readFile(join(this.options.cacheDir, `${cached.sha256}.bin`));
      if (createHash('sha256').update(cachedBytes).digest('hex') !== cached.sha256) throw new Error('Cache hash mismatch');
    } catch {
      cached = undefined;
      cachedBytes = undefined;
    }
    const cacheArtifact = (): Artifact => ({ bytes: cachedBytes!, fetchedAt: cached!.fetchedAt, sha256: cached!.sha256 });
    if (this.options.offline) {
      if (!cached || !cachedBytes) throw new Error(`Offline cache miss: ${url}`);
      const artifact = cacheArtifact();
      this.memory.set(url, artifact);
      return artifact;
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      let current = url;
      let response: Response | undefined;
      for (let redirect = 0; redirect <= 4; redirect++) {
        assertAllowedUrl(current, this.options.allowedHosts);
        if (this.requests >= (this.options.maxRequests ?? 1000)) throw new Error('Run request limit reached');
        await this.sleep(Math.max(0, this.nextRequestAt - Date.now()));
        this.requests++;
        this.nextRequestAt = Date.now() + (this.options.delayMs ?? 1000);
        response = await this.request(current, {
          redirect: 'manual',
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
          headers: {
            'User-Agent': 'local-gov-vis-evaluations/1.0 (public municipal evaluation research)',
            ...(cached?.etag ? { 'If-None-Match': cached.etag } : {}),
            ...(cached?.lastModified ? { 'If-Modified-Since': cached.lastModified } : {}),
          },
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirect === 4) throw new Error(`Invalid or excessive redirects: ${url}`);
        current = assertAllowedUrl(new URL(location, current).href, this.options.allowedHosts).href;
      }
      if (!response) throw new Error(`No response: ${url}`);
      if (response.status === 304 && cached && cachedBytes) {
        const artifact = cacheArtifact();
        this.memory.set(url, artifact);
        return artifact;
      }
      if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
        const retryAfter = response.headers.get('retry-after');
        const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null;
        const dateDelay = retryAfter && seconds === null ? Date.parse(retryAfter) - Date.now() : NaN;
        const delay = seconds !== null ? seconds * 1000 : Number.isFinite(dateDelay) ? Math.max(0, dateDelay) : 1000 * 2 ** attempt;
        await response.body?.cancel();
        // Do not ignore a provider's requested waiting period or keep a job alive indefinitely.
        if (delay > 30_000) throw new Error(`HTTP ${response.status}: Retry-After exceeds this run's wait bound (${url})`);
        await this.sleep(delay);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}: ${url}`);
      }
      const maxBytes = this.options.maxBytes ?? 20 * 1024 * 1024;
      if (Number(response.headers.get('content-length')) > maxBytes) {
        await response.body?.cancel();
        throw new Error(`Source exceeds ${maxBytes} bytes: ${url}`);
      }
      const chunks: Uint8Array[] = [];
      let length = 0;
      if (!response.body) throw new Error(`Empty response: ${url}`);
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          length += chunk.length;
          if (length > maxBytes) throw new Error(`Source exceeds ${maxBytes} bytes: ${url}`);
          chunks.push(chunk);
        }
      } catch (error) {
        await reader.cancel();
        throw error;
      } finally {
        reader.releaseLock();
      }
      const bytes = Buffer.concat(chunks);
      if (!bytes.length) throw new Error(`Empty source: ${url}`);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const fetchedAt = cached?.sha256 === sha256 ? cached.fetchedAt : new Date().toISOString();
      await writeFile(join(this.options.cacheDir, `${sha256}.bin`), bytes);
      await atomicJson(metadataPath, {
        url, sha256, fetchedAt,
        etag: response.headers.get('etag') ?? undefined,
        lastModified: response.headers.get('last-modified') ?? undefined,
      });
      const artifact = { bytes, sha256, fetchedAt };
      this.memory.set(url, artifact);
      return artifact;
    }
    throw new Error(`Retry limit reached: ${url}`);
  }
}
