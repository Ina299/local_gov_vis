import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import * as https from 'node:https';
import { connect, type Socket } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Entry } from '../../src/source-collection/collector';

let directory: string;
let key: Buffer;
let cert: Buffer;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'collector-native-'));
  // Ephemeral fixture CA/key, never used to trust external websites.
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem'),
    '-subj', '/CN=city.example.jp', '-addext', 'subjectAltName=DNS:city.example.jp,DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
  key = await readFile(join(directory, 'key.pem')); cert = await readFile(join(directory, 'cert.pem'));
});
after(async () => { await rm(directory, { recursive: true, force: true }); });
const nativeProxy = true; // Explicit dispatcher works with native fetch on Node 20 and 24.
type Mode = 'direct' | 'proxy' | 'deny-proxy' | 'reset-proxy';
async function fixture(mode: Mode, path: string, timeoutMs = 3000) {
  const sockets = new Set<Socket>(); let connects = 0; let originRequests = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (callback: () => void, ms: number) => { const timer = setTimeout(callback, ms); timers.add(timer); };
  const origin = https.createServer({ key, cert }, (req, res) => {
    originRequests++;
    if (req.url === '/redirect.pdf') { res.writeHead(302, { location: '/stream.pdf' }); res.end(); return; }
    if (req.url === '/slow-redirect.pdf') { later(() => { res.writeHead(302, { location: '/stream.pdf' }); res.end(); }, 80); return; }
    if (req.url === '/denied.pdf') { res.writeHead(403); res.end('Denied'); return; }
    if (req.url === '/header-timeout.pdf') { later(() => res.end('%PDF-1.7 fixture'), 800); return; }
    res.writeHead(200, { 'content-type': 'application/pdf' });
    res.write('%PDF-1.7\n');
    if (req.url === '/reset.pdf') { later(() => res.destroy(), 20); return; }
    later(() => res.end('local fixture body'), req.url === '/body-timeout.pdf' ? 800 : 40);
  });
  const proxy = http.createServer((_req, res) => { res.writeHead(405); res.end(); });
  proxy.on('connect', (req, socket, head) => {
    connects++;
    // Never forward to arbitrary destinations, even if a test is changed accidentally.
    if (req.url !== 'city.example.jp:443') { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    if (mode === 'deny-proxy') { socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'); return; }
    if (mode === 'reset-proxy') { socket.destroy(); return; }
    const upstream = connect({ host: '127.0.0.1', port: (origin.address() as { port: number }).port }, () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream); upstream.pipe(socket);
    });
    sockets.add(upstream);
    upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
  });
  for (const server of [origin, proxy]) {
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  }
  try {
    const output = await mkdtemp(join(directory, 'run-'));
    // Fresh child environment: no inherited production proxy values/credentials,
    // no changes to the agent environment, and no insecure TLS bypass.
    const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, NODE_EXTRA_CA_CERTS: join(directory, 'cert.pem') };
    if (mode !== 'direct') env.HTTPS_PROXY = `http://127.0.0.1:${(proxy.address() as { port: number }).port}`;
    const args = ['--import', 'tsx', fileURLToPath(new URL('./live-fixture.ts', import.meta.url)), output,
      String((origin.address() as { port: number }).port), mode === 'direct' ? 'direct' : 'proxy', path, String(timeoutMs)];
    const entry = await new Promise<Entry>((resolve, reject) => {
      const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = ''; let stderr = '';
      const guard = setTimeout(() => {
        child.kill();
        let summary = 'no completed entry';
        try { const e = JSON.parse(stdout) as Entry; summary = JSON.stringify({ state: e.state, failureKind: e.failureKind, elapsedMs: e.elapsedMs, timeoutTriggered: e.timeoutTriggered, message: e.message, connects }); } catch { /* no output */ }
        reject(new Error(`Local fixture exceeded 10-second process bound: ${summary}`));
      }, 10_000);
      child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
      child.on('error', reject);
      child.on('close', code => { clearTimeout(guard); if (code !== 0) reject(new Error(`Local fixture exit ${code}: ${stderr}`));
        else { try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); } } });
    });
    return { entry, connects, originRequests, output };
  } finally {
    for (const timer of timers) clearTimeout(timer);
    for (const socket of sockets) socket.destroy();
    await Promise.all([origin, proxy].map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  }
}
test('native fetch reads real delayed TLS stream and process waits for persisted bytes', async () => {
  const { entry, connects, output } = await fixture('direct', 'stream.pdf');
  assert.equal(entry.state, 'fetched'); assert.equal(entry.httpStatus, 200); assert.equal(connects, 0);
  assert.match((await readFile(join(output, entry.file!))).toString(), /local fixture body/);
  assert.equal(entry.timeoutTriggered, false); assert.ok(entry.elapsedMs! >= 30);
});
test('native fetch follows same-host manual redirect and consumes final body', async () => {
  const { entry, originRequests } = await fixture('direct', 'redirect.pdf');
  assert.equal(entry.state, 'fetched'); assert.equal(originRequests, 2); assert.equal(entry.redirects?.length, 1);
});
for (const path of ['header-timeout.pdf', 'body-timeout.pdf']) test(`native fetch ${path} records actual deadline, not denial`, async () => {
  const { entry } = await fixture('direct', path, 150);
  assert.equal(entry.state, 'paused'); assert.equal(entry.failureKind, 'timeout'); assert.equal(entry.timeoutTriggered, true);
  assert.ok(entry.elapsedMs! >= 100 && entry.elapsedMs! < 3000);
  if (path.startsWith('body')) assert.equal(entry.httpStatus, 200);
});
test('native redirect wait is included in total document deadline', async () => {
  const { entry, originRequests } = await fixture('direct', 'slow-redirect.pdf', 150);
  assert.equal(entry.failureKind, 'timeout'); assert.equal(originRequests, 1);
  assert.ok(entry.elapsedMs! < 1200, 'abort must interrupt the 1500ms redirect wait');
});
test('native socket reset during streamed body is transport pause, not timeout or denial', async () => {
  const { entry } = await fixture('direct', 'reset.pdf');
  assert.equal(entry.state, 'paused'); assert.equal(entry.failureKind, 'transport'); assert.equal(entry.timeoutTriggered, false);
  assert.equal(entry.httpStatus, 200); assert.equal(entry.file, undefined);
});
test('real origin HTTP 403 remains a stopped denial', async () => {
  const { entry } = await fixture('direct', 'denied.pdf');
  assert.equal(entry.state, 'blocked'); assert.equal(entry.failureKind, 'http_denial'); assert.equal(entry.httpStatus, 403);
});
test('native environment proxy tunnels only to local TLS fixture and completes', { skip: !nativeProxy }, async () => {
  const { entry, connects, originRequests } = await fixture('proxy', 'stream.pdf');
  assert.equal(entry.state, 'fetched'); assert.ok(connects >= 1); assert.equal(originRequests, 1);
});
test('native CONNECT rejection records proxy 403 separately from origin HTTP status', { skip: !nativeProxy }, async () => {
  const { entry, connects, originRequests } = await fixture('deny-proxy', 'stream.pdf');
  assert.equal(entry.state, 'blocked'); assert.equal(entry.failureKind, 'proxy_denial'); assert.equal(entry.proxyHttpStatus, 403); assert.equal(entry.httpStatus, undefined);
  assert.match(entry.message!, /UND_ERR_ABORTED/); assert.equal(entry.timeoutTriggered, false);
  assert.ok(entry.elapsedMs! < entry.timeoutMs!); assert.ok(connects >= 1); assert.equal(originRequests, 0);
});
test('native proxy socket close before CONNECT is a transport pause', { skip: !nativeProxy }, async () => {
  const { entry, originRequests, connects } = await fixture('reset-proxy', 'stream.pdf', 500);
  assert.equal(entry.state, 'paused'); assert.equal(entry.failureKind, 'transport');
  assert.equal(entry.httpStatus, undefined); assert.equal(originRequests, 0); assert.equal(connects, 1);
  assert.match(entry.message!, /COLLECTOR_PROXY_CONNECT_FAILED/);
});
