import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { fetchBoundedBytes, isCompressedAsset } from './boundedFetch';

const text = (bytes: ArrayBuffer) => new TextDecoder().decode(bytes);
function fetcherFor(files: Record<string, Uint8Array>, seen: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input); seen.push(url);
    const body = files[url];
    return body ? new Response(new Blob([body as Uint8Array<ArrayBuffer>])) : new Response('missing', { status: 404 });
  }) as typeof fetch;
}

describe('bounded fetch with compressed publication', () => {
  const plain = new TextEncoder().encode(JSON.stringify({ ok: true, text: '事務事業評価'.repeat(50) }));

  it('compresses only the large evaluation asset directories', () => {
    expect(isCompressedAsset('evaluation-evidence/documents/abc.json')).toBe(true);
    expect(isCompressedAsset('/evaluations-composed/13102-x.json')).toBe(true);
    expect(isCompressedAsset('/evaluations-index.json')).toBe(false);
    expect(isCompressedAsset('budgets/2024.json')).toBe(false);
  });

  it('fetches the .gz copy and returns the decompressed bytes unchanged', async () => {
    const seen: string[] = [];
    const bytes = await fetchBoundedBytes('evaluation-evidence/documents/a.json', new AbortController().signal, plain.length,
      fetcherFor({ '/evaluation-evidence/documents/a.json.gz': gzipSync(plain) }, seen), true);
    expect(seen).toEqual(['/evaluation-evidence/documents/a.json.gz']);
    expect(new Uint8Array(bytes)).toEqual(plain);
  });

  it('bounds the decompressed size, not just the archive size', async () => {
    const bomb = gzipSync(new Uint8Array(1024 * 1024));
    expect(bomb.length).toBeLessThan(4096);
    await expect(fetchBoundedBytes('evaluations-composed/x.json', new AbortController().signal, 64 * 1024,
      fetcherFor({ '/evaluations-composed/x.json.gz': bomb }), true)).rejects.toThrow('上限');
  });

  it('rejects a corrupt archive instead of returning partial data', async () => {
    await expect(fetchBoundedBytes('evaluations-municipal/x.json', new AbortController().signal, 1024,
      fetcherFor({ '/evaluations-municipal/x.json.gz': new TextEncoder().encode('not gzip at all') }), true)).rejects.toThrow();
  });

  it('keeps plain JSON for uncompressed builds and for non-evaluation files', async () => {
    const seen: string[] = [];
    const files = { '/evaluation-evidence/index.json': plain, '/evaluations-index.json': plain };
    expect(text(await fetchBoundedBytes('evaluation-evidence/index.json', new AbortController().signal, plain.length, fetcherFor(files, seen), false))).toContain('ok');
    expect(text(await fetchBoundedBytes('/evaluations-index.json', new AbortController().signal, plain.length, fetcherFor(files, seen), true))).toContain('ok');
    expect(seen).toEqual(['/evaluation-evidence/index.json', '/evaluations-index.json']);
  });
});
