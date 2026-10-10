import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OfficialSourceFetcher, assertAllowedUrl } from '../src/evaluations/fetch';

const host = 'www.city.sapporo.jp';
const url = `https://${host}/example.pdf`;
async function setup(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
  const cacheDir = await mkdtemp(join(tmpdir(), 'eval-fetch-'));
  return { cacheDir, client: new OfficialSourceFetcher({ cacheDir, allowedHosts: [host], delayMs: 0, sleep: async () => {}, fetchImpl, ...extra }) };
}
test('official host allowlist rejects redirects/credentials/plain HTTP/ports and lookalikes', () => {
  for (const value of ['http://' + host, 'https://user:secret@' + host, 'https://' + host + ':8443', 'https://' + host + '.evil.test']) {
    assert.throws(() => assertAllowedUrl(value, [host]), /allowlist/);
  }
  assert.equal(assertAllowedUrl(url + '#page=2', [host]).href, url);
});
test('disallowed redirect is never fetched', async () => {
  const seen: string[] = [];
  const { client } = await setup(async (input) => {
    seen.push(String(input));
    return new Response(null, { status: 302, headers: { location: 'https://evil.test/secret' } });
  });
  await assert.rejects(client.get(url), /allowlist/);
  assert.deepEqual(seen, [url]);
});
test('403 is recorded without retries or host bypass', async () => {
  let calls = 0;
  const { client } = await setup(async () => { calls++; return new Response('Denied', { status: 403 }); });
  await assert.rejects(client.get(url), /HTTP 403/);
  assert.equal(calls, 1);
});
test('503 retries are bounded and recover; repeated URL fetched once per run', async () => {
  let calls = 0;
  const { client } = await setup(async () => { calls++; return new Response(calls < 3 ? 'Unavailable' : 'PDF', { status: calls < 3 ? 503 : 200 }); });
  const one = await client.get(url);
  assert.equal(Buffer.from(one.bytes).toString(), 'PDF');
  assert.equal(await client.get(url), one);
  assert.equal(calls, 3);
});
test('honors a Retry-After longer than the bounded job by failing instead of retrying early', async () => {
  let calls = 0;
  const { client } = await setup(async () => { calls++; return new Response(null, { status: 429, headers: { 'retry-after': '300' } }); });
  await assert.rejects(client.get(url), /Retry-After/);
  assert.equal(calls, 1);
});
test('conditional response preserves original hash and provenance fetch time; offline uses verified bytes', async () => {
  const { client, cacheDir } = await setup(async () => new Response('original', { headers: { etag: '"v1"' } }));
  const one = await client.get(url);
  const conditional = new OfficialSourceFetcher({ cacheDir, allowedHosts: [host], delayMs: 0, fetchImpl: async (_input, init) => {
    assert.equal((init?.headers as Record<string, string>)['If-None-Match'], '"v1"');
    return new Response(null, { status: 304 });
  } });
  assert.deepEqual(await conditional.get(url), one);
  const offline = new OfficialSourceFetcher({ cacheDir, allowedHosts: [host], offline: true, fetchImpl: async () => { throw new Error('must not connect'); } });
  assert.deepEqual(await offline.get(url), one);
  await writeFile(join(cacheDir, `${one.sha256}.bin`), 'corrupted');
  await assert.rejects(new OfficialSourceFetcher({ cacheDir, allowedHosts: [host], offline: true }).get(url), /Offline cache miss/);
});
test('byte limit applies even without Content-Length, request cap bounds work', async () => {
  const { client } = await setup(async () => new Response('too large'), { maxBytes: 4 });
  await assert.rejects(client.get(url), /exceeds/);
  const empty = await setup(async () => new Response('ok'), { maxRequests: 0 });
  await assert.rejects(empty.client.get(url), /request limit/);
});
