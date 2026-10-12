import test from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from 'undici';
import { createTransport } from '../../src/source-collection/network';
import { transportError } from '../../src/source-collection/collector';

test('scoped dispatcher inherits environment without passing proxy overrides or mutating it', async () => {
  const environment = { HTTPS_PROXY: 'test-only-placeholder', NO_PROXY: 'test-only-placeholder' };
  const before = { ...environment }; const agent = new Agent(); let used = false;
  const transport = createTransport(options => {
    assert.deepEqual(Object.keys(options), ['clientFactory']); return agent;
  }, environment, async (_input, init) => {
    used = true; assert.equal((init as RequestInit & { dispatcher: unknown }).dispatcher, agent); return new Response('fixture');
  });
  await transport.request('https://city.example.jp/fixture');
  assert.equal(used, true); assert.deepEqual(environment, before);
  await transport.destroy(); assert.equal(agent.destroyed, true);
});
test('lowercase proxy variables are detected without requiring native runtime setup', async () => {
  const agent = new Agent();
  const transport = createTransport(() => agent, { https_proxy: 'placeholder' });
  await transport.destroy(); assert.equal(agent.destroyed, true);
});
test('no proxy still owns its connections and cleanup', async () => {
  const agent = new Agent(); const transport = createTransport(() => agent, {});
  await transport.destroy(); assert.equal(agent.destroyed, true);
});
test('independent collectors own distinct dispatchers', async () => {
  const first = new Agent(); const second = new Agent();
  const a = createTransport(() => first, {}); const b = createTransport(() => second, {});
  await a.destroy(); assert.equal(first.destroyed, true); assert.equal(second.destroyed, false);
  await b.destroy();
});
test('unsupported ALL_PROXY-only environment fails closed', () => {
  assert.throws(() => createTransport(() => { throw new Error('must not run'); }, { ALL_PROXY: 'placeholder' }), /no request made/);
});
test('proxy initialization error is sanitized with no direct fallback', () => {
  assert.throws(() => createTransport(() => { throw new Error('https://user:secret@private.invalid'); }, { HTTPS_PROXY: 'placeholder' }), error => {
    assert.match((error as Error).message, /no direct fallback/);
    assert.doesNotMatch((error as Error).message, /secret|private.invalid/); return true;
  });
});
for (const code of ['ECONNRESET', 'ENETUNREACH', 'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'CERT_HAS_EXPIRED']) {
  test(`safe transport cause ${code} is retained without the original message`, () => {
    const cause = Object.assign(new Error('credential-bearing message must not appear'), { code });
    const text = transportError(new TypeError('sensitive URL', { cause }));
    assert.match(text, new RegExp(code)); assert.doesNotMatch(text, /credential|sensitive URL/);
  });
}
test('timeout exception name is safely preserved', () => {
  assert.match(transportError(new DOMException('private URL', 'TimeoutError')), /TimeoutError/);
});
