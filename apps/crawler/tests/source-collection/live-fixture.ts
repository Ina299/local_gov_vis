// Child process for loopback-only integration tests. Never called by production CLI.
import { collect, type Queue } from '../../src/source-collection/collector';
const [outputDir, originPort, mode, path, timeout] = process.argv.slice(2);
const url = `https://city.example.jp/${path}`;
const queue: Queue = { version: 1, quarantineHosts: [], sources: [{
  url, sourcePageUrl: url, municipalityCode: '12345', municipalityName: 'Local fixture',
  title: 'Loopback integration test', fiscalYear: null, amountKind: null,
  review: { checkedAt: '2026-10-12T00:00:00Z', evidence: 'TEST FIXTURE ONLY. Proxy accepts only this fixture and forwards only to loopback.' },
}] };
const result = await collect(queue, {
  outputDir, execute: true, workers: 1, timeoutMs: Number(timeout),
  // Direct tests still use actual native fetch, TLS, sockets and the collector's
  // AbortSignal/stream lifecycle. Only the fixture origin URL is rewritten.
  fetchImpl: mode === 'direct' ? (input, init) => fetch(`https://127.0.0.1:${originPort}${new URL(String(input)).pathname}`, init) : undefined,
});
console.log(JSON.stringify(Object.values(result.manifest!.entries)[0]));
