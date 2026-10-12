import * as http from 'node:http';

type ProxyRuntime = { setGlobalProxyFromEnv?: () => () => void };

/** Configure this standalone collector's HTTP client from existing operator
 * settings only. Do not supply proxy URLs, rewrite NO_PROXY or fall back to a
 * direct connection if proxy setup fails. Native support was added in 24.14.0.
 * https://nodejs.org/docs/latest-v24.x/api/http.html#httpsetglobalproxyfromenvproxyenv
 */
export function useExistingProxy(
  runtime: ProxyRuntime = http as ProxyRuntime,
  environment: NodeJS.ProcessEnv = process.env,
): () => void {
  const configured = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'].some(key => Boolean(environment[key]));
  if (!configured) {
    if (environment.ALL_PROXY || environment.all_proxy) throw new Error('Only ALL_PROXY is configured; native HTTP proxy setup is unsupported; no request made');
    return () => {};
  }
  if (typeof runtime.setGlobalProxyFromEnv !== 'function') {
    throw new Error('Existing proxy requires Node.js 24.14+ native proxy setup; no request made');
  }
  try {
    // No arguments: Node consumes the existing process.env with its own
    // precedence and NO_PROXY rules. Never log or persist its values.
    return runtime.setGlobalProxyFromEnv();
  } catch {
    // Configuration errors can embed credentials. Do not emit the original.
    throw new Error('Existing proxy setup failed; no direct fallback or request made');
  }
}
