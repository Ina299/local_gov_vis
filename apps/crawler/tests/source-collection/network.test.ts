import test from 'node:test';
import assert from 'node:assert/strict';
import { useExistingProxy } from '../../src/source-collection/network';
import { transportError } from '../../src/source-collection/collector';

test('existing proxy uses native environment setup with no supplied values and restores', () => {
  const environment = { HTTPS_PROXY: 'test-only-placeholder', NO_PROXY: 'test-only-placeholder' };
  const before = { ...environment }; let calls = 0; let restored = false;
  const restore = useExistingProxy({ setGlobalProxyFromEnv: (...args: unknown[]) => {
    calls++; assert.equal(args.length, 0); return () => { restored = true; };
  } }, environment);
  assert.equal(calls, 1); assert.deepEqual(environment, before);
  restore(); assert.equal(restored, true);
});
test('lowercase proxy variables are also detected', () => {
  let calls = 0;
  useExistingProxy({ setGlobalProxyFromEnv: () => { calls++; return () => {}; } }, { https_proxy: 'placeholder' });
  assert.equal(calls, 1);
});
test('no proxy does not alter agents', () => {
  useExistingProxy({ setGlobalProxyFromEnv: () => { throw new Error('must not run'); } }, {})();
});
test('unsupported runtime stops before requests rather than silently ignoring proxy', () => {
  assert.throws(() => useExistingProxy({}, { HTTPS_PROXY: 'placeholder' }), /no request made/);
});
test('unsupported ALL_PROXY-only environment fails closed', () => {
  assert.throws(() => useExistingProxy({}, { ALL_PROXY: 'placeholder' }), /unsupported/);
});
test('proxy initialization error is sanitized with no direct fallback', () => {
  assert.throws(() => useExistingProxy({ setGlobalProxyFromEnv: () => { throw new Error('https://user:secret@private.invalid'); } }, { HTTPS_PROXY: 'placeholder' }), error => {
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
