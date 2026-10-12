import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collect, validateQueue, type Queue, type Source } from '../../src/source-collection/collector';

const source = (path = 'one.pdf', host = 'city.example.jp'): Source => ({
  url: `https://${host}/${path}`, sourcePageUrl: `https://${host}/index.html`,
  municipalityCode: '12345', municipalityName: 'テスト市', title: '<原典>',
  fiscalYear: null, amountKind: null,
  review: { checkedAt: '2026-10-12T00:00:00Z', evidence: 'Offline fixture only; not approved for live fetching' },
});
const queue = (sources = [source()], quarantineHosts: string[] = []): Queue => ({ version: 1, sources, quarantineHosts });
const setup = async () => ({ outputDir: await mkdtemp(join(tmpdir(), 'source-collection-')), execute: true, sleep: async () => {} });
const pdf = () => new Response('%PDF-1.7\nfixture', { headers: { 'content-type': 'application/pdf' } });
test('dry-run neither connects nor creates output', async () => {
  const root = await setup(); const outputDir = join(root.outputDir, 'absent');
  const result = await collect(queue(), { outputDir, fetchImpl: async () => { throw new Error('network'); } });
  assert.equal(result.dryRun, true); await assert.rejects(access(outputDir));
});
test('requires explicit review and rejects unsafe URL forms or duplicate sources', () => {
  for (const url of ['http://city.example.jp/a', 'https://u:p@city.example.jp/a', 'https://localhost/a', 'https://127.0.0.1/a', 'https://city.example.jp/a#page=1']) {
    assert.throws(() => validateQueue(queue([{ ...source(), url }])));
  }
  assert.throws(() => validateQueue(queue([{ ...source(), review: { checkedAt: '', evidence: '' } }])));
  assert.throws(() => validateQueue(queue([source(), source()])));
});
test('stores verified original, provenance and unextracted source link; restart never connects', async () => {
  const options = await setup(); let calls = 0;
  const first = await collect(queue(), { ...options, fetchImpl: async () => { calls++; return pdf(); } });
  assert.ok('manifest' in first);
  const entry = Object.values(first.manifest!.entries)[0];
  assert.equal(entry.state, 'fetched'); assert.equal(entry.extraction, 'not_started');
  assert.equal(entry.sha256?.length, 64); assert.ok(entry.fetchedAt);
  assert.equal((await readFile(join(options.outputDir, entry.file!))).toString(), '%PDF-1.7\nfixture');
  const html = await readFile(join(options.outputDir, 'index.html'), 'utf8');
  assert.match(html, /&lt;原典&gt;/); assert.match(html, /構造化: 未実施/);
  assert.match(html, /href="https:\/\/city.example.jp\/one.pdf"/);
  await collect(queue(), { ...options, fetchImpl: async () => { calls++; throw new Error('network'); } });
  assert.equal(calls, 1);
});
test('corrupt cache is rejected without redownload', async () => {
  const options = await setup(); const result = await collect(queue(), { ...options, fetchImpl: async () => pdf() });
  const entry = Object.values(result.manifest!.entries)[0];
  await writeFile(join(options.outputDir, entry.file!), 'corrupt');
  await assert.rejects(collect(queue(), { ...options, fetchImpl: async () => { throw new Error('network must not run'); } }), /integrity/);
});
test('corrupt manifest is never discarded', async () => {
  const options = await setup(); await writeFile(join(options.outputDir, 'manifest.json'), '{');
  await assert.rejects(collect(queue(), options), SyntaxError);
});
test('parent-domain quarantine blocks subdomains without requests', async () => {
  let calls = 0;
  const result = await collect(queue([source()], ['example.jp']), { ...await setup(), fetchImpl: async () => { calls++; return pdf(); } });
  assert.equal(calls, 0); assert.equal(Object.values(result.manifest!.entries)[0].state, 'blocked');
});
for (const status of [301, 401, 403, 429, 503]) test(`HTTP ${status} stops host and is not retried across runs`, async () => {
  const options = await setup(); let calls = 0;
  const input = queue([source(), source('two.pdf')]);
  const fetchImpl: typeof fetch = async () => { calls++; return new Response(null, { status, headers: { location: 'https://other.example.jp/a', 'retry-after': '3600' } }); };
  const result = await collect(input, { ...options, fetchImpl });
  assert.equal(calls, 1); assert.ok(Object.values(result.manifest!.entries).every(e => e.state === 'blocked'));
  await collect(input, { ...options, fetchImpl }); assert.equal(calls, 1);
});
test('Google Drive warning path is never requested', async () => {
  const result = await collect(queue([source('download.zip', 'drive.google.com')]), { ...await setup(), fetchImpl: async () => { throw new Error('must not connect'); } });
  assert.equal(Object.values(result.manifest!.entries)[0].state, 'blocked');
});
test('HTTP 200 warning is blocked and no body is accepted as a document', async () => {
  const result = await collect(queue([source('index.html')]), { ...await setup(), fetchImpl: async () => new Response('Google Drive cannot scan this file for viruses. Virus scan warning') });
  const entry = Object.values(result.manifest!.entries)[0]; assert.equal(entry.state, 'blocked'); assert.equal(entry.file, undefined);
});
test('PDF URL returning HTML is blocked', async () => {
  const result = await collect(queue(), { ...await setup(), fetchImpl: async () => new Response('<html>login</html>') });
  assert.equal(Object.values(result.manifest!.entries)[0].state, 'blocked');
});
test('streamed bytes obey limit even without Content-Length', async () => {
  const result = await collect(queue(), { ...await setup(), maxBytes: 4, fetchImpl: async () => pdf() });
  const entry = Object.values(result.manifest!.entries)[0]; assert.equal(entry.state, 'failed'); assert.equal(entry.file, undefined);
});
test('concurrent workers serialize requests within each host and obey completion gap', async () => {
  let clock = 10000; const starts: number[] = []; let active = 0;
  const result = await collect(queue([source(), source('two.pdf')]), {
    ...await setup(), now: () => clock, sleep: async ms => { clock += ms; },
    fetchImpl: async () => { assert.equal(active++, 0); starts.push(clock); clock += 200; active--; return pdf(); },
  });
  assert.equal(starts[1] - starts[0], 1700);
  assert.ok(Object.values(result.manifest!.entries).every(e => e.state === 'fetched'));
});
test('different hosts proceed independently and a denial does not stop another host', async () => {
  const result = await collect(queue([source(), source('one.pdf', 'second.example.jp')]), {
    ...await setup(), fetchImpl: async url => String(url).includes('second.') ? pdf() : new Response(null, { status: 403 }),
  });
  assert.deepEqual(Object.values(result.manifest!.entries).map(e => e.state), ['blocked', 'fetched']);
});
test('existing lock prevents another run', async () => {
  const options = await setup(); await writeFile(join(options.outputDir, 'collection.lock'), '');
  await assert.rejects(collect(queue(), options), /EEXIST/);
});
test('modified source metadata cannot overwrite an existing provenance record', async () => {
  const options = await setup(); await collect(queue(), { ...options, fetchImpl: async () => pdf() });
  await assert.rejects(collect(queue([{ ...source(), fiscalYear: 2025 }]), options), /metadata differs/);
});
test('interrupted host checkpoint prevents later source requests on restart', async () => {
  const options = await setup();
  await writeFile(join(options.outputDir, 'manifest.json'), JSON.stringify({ version: 1, entries: {}, blockedHosts: { 'city.example.jp': 'Interrupted attempt; review required' } }));
  let calls = 0;
  const result = await collect(queue(), { ...options, fetchImpl: async () => { calls++; return pdf(); } });
  assert.equal(calls, 0); assert.equal(Object.values(result.manifest!.entries)[0].state, 'blocked');
});
test('same exact HTTPS host redirect follows with pacing and records resolved URL', async () => {
  const seen: string[] = []; const delays: number[] = [];
  const result = await collect(queue(), { ...await setup(), sleep: async ms => { delays.push(ms); }, fetchImpl: async url => {
    seen.push(String(url));
    return seen.length === 1 ? new Response(null, { status: 302, headers: { location: '/final.pdf' } }) : pdf();
  } });
  const entry = Object.values(result.manifest!.entries)[0];
  assert.deepEqual(seen, [source().url, 'https://city.example.jp/final.pdf']);
  assert.equal(entry.resolvedUrl, seen[1]); assert.equal(entry.state, 'fetched'); assert.ok(delays.includes(1500));
});
test('www variant is a distinct host and is never followed', async () => {
  let calls = 0;
  const result = await collect(queue(), { ...await setup(), fetchImpl: async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://www.city.example.jp/final.pdf' } }); } });
  assert.equal(calls, 1); assert.equal(Object.values(result.manifest!.entries)[0].state, 'blocked');
});
test('same-host redirect loop is bounded', async () => {
  let calls = 0;
  const result = await collect(queue(), { ...await setup(), fetchImpl: async () => { calls++; return new Response(null, { status: 302, headers: { location: '/one.pdf' } }); } });
  assert.equal(calls, 1); assert.equal(Object.values(result.manifest!.entries)[0].state, 'blocked');
});
test('transport diagnostics preserve cause code but do not leak URL or credentials', async () => {
  const result = await collect(queue(), { ...await setup(), fetchImpl: async () => {
    const cause = Object.assign(new Error('https://secret:password@proxy.invalid'), { code: 'ECONNRESET' });
    throw new TypeError('fetch failed for signed secret URL', { cause });
  } });
  const entry = Object.values(result.manifest!.entries)[0];
  assert.equal(entry.state, 'blocked'); assert.match(entry.message!, /ECONNRESET/);
  assert.doesNotMatch(entry.message!, /password|proxy.invalid|signed secret/);
});
