import { dataUrl } from './paths';

/**
 * Large evaluation assets are published gzip-compressed (`<path>.gz`) when the build sets
 * NEXT_PUBLIC_COMPRESSED_DATA=1, to stay within the static hosting size limit. The repository and
 * the dev server keep plain JSON. Integrity checks always run on the decompressed bytes.
 */
export const COMPRESSED_DATA = process.env.NEXT_PUBLIC_COMPRESSED_DATA === '1';
const COMPRESSED_PREFIXES = ['evaluation-evidence/', 'evaluation-evidence-prefectures/', 'evaluations-composed/', 'evaluations-municipal/'];

export function isCompressedAsset(path: string): boolean {
  const relative = path.replace(/^\//, '');
  return COMPRESSED_PREFIXES.some((prefix) => relative.startsWith(prefix)) && relative.endsWith('.json');
}

function notAborted(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('読み込みを中止しました。', 'AbortError');
}
const tooLarge = () => new Error('データのサイズが上限を超えています。');

/**
 * Fetches `path` (leading slash optional) and returns at most `maximum` bytes of content.
 * Streams bound memory even when Content-Length is absent or wrong; for compressed assets the
 * bound applies to the decompressed bytes, so a small archive cannot expand without limit.
 */
export async function fetchBoundedBytes(path: string, signal: AbortSignal, maximum: number, fetcher: typeof fetch, compressed = COMPRESSED_DATA): Promise<ArrayBuffer> {
  notAborted(signal);
  const gzip = compressed && isCompressedAsset(path);
  const url = dataUrl(`/${path.replace(/^\//, '')}${gzip ? '.gz' : ''}`);
  const response = await fetcher(url, { signal, cache: 'no-cache', redirect: 'error' });
  if (!response.ok) throw new Error(`データを取得できませんでした（HTTP ${response.status}）。`);
  const declared = response.headers.get('content-length');
  if (declared && Number(declared) > maximum) throw tooLarge();
  let body: ReadableStream<Uint8Array> | null = response.body;
  if (!body) {
    if (gzip) body = new Blob([await response.arrayBuffer()]).stream() as ReadableStream<Uint8Array>;
    else {
      const bytes = await response.arrayBuffer(); notAborted(signal);
      if (bytes.byteLength > maximum) throw tooLarge();
      return bytes;
    }
  }
  const stream: ReadableStream<Uint8Array> = gzip ? body.pipeThrough(new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>) : body;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      notAborted(signal);
      const { done, value } = await reader.read(); notAborted(signal);
      if (done) break;
      total += value.byteLength;
      if (total > maximum) throw tooLarge();
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (gzip && error instanceof TypeError) throw new Error('圧縮データを展開できませんでした。');
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}
