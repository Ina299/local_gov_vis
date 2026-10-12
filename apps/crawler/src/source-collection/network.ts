import { Client, EnvHttpProxyAgent, type Dispatcher } from 'undici';

/** Avoid Undici 7's reconnect loop when a proxy closes before CONNECT completes.
 * A fresh CONNECT failure is not a recoverable established-origin socket error.
 * The upstream fix uses the same distinction (nodejs/undici#3897).
 */
class SingleAttemptProxyClient extends Client {
  connect(options: Omit<Dispatcher.ConnectOptions, 'origin'>): Promise<Dispatcher.ConnectData>;
  connect(options: Omit<Dispatcher.ConnectOptions, 'origin'>, callback: (err: Error | null, data: Dispatcher.ConnectData) => void): void;
  connect(options: Omit<Dispatcher.ConnectOptions, 'origin'>, callback?: (err: Error | null, data: Dispatcher.ConnectData) => void): Promise<Dispatcher.ConnectData> | void {
    const result = super.connect(options).catch((cause: unknown) => {
      if ((cause as { code?: string })?.code === 'UND_ERR_SOCKET') {
        throw Object.assign(new Error('Proxy CONNECT interrupted', { cause }), { code: 'COLLECTOR_PROXY_CONNECT_FAILED' });
      }
      throw cause;
    });
    if (callback) { void result.then(data => callback(null, data), error => callback(error, undefined!)); return; }
    return result;
  }
}

export interface Transport {
  request: typeof fetch;
  destroy: () => Promise<void>;
}
export function createTransport(
  createAgent: (options: EnvHttpProxyAgent.Options) => Dispatcher = options => new EnvHttpProxyAgent(options),
  environment: NodeJS.ProcessEnv = process.env,
  nativeFetch: typeof fetch = fetch,
): Transport {
  const configured = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'].some(key => Boolean(environment[key]));
  if (!configured && (environment.ALL_PROXY || environment.all_proxy)) {
    throw new Error('Only ALL_PROXY is configured; supported existing HTTP proxy is required; no request made');
  }
  let dispatcher: Dispatcher;
  try {
    // No proxy values supplied: EnvHttpProxyAgent consumes the existing process.env
    // including NO_PROXY. No global dispatcher or environment setting is changed.
    dispatcher = createAgent({ clientFactory: (origin, options) => new SingleAttemptProxyClient(origin, options) });
  } catch {
    throw new Error('Existing proxy setup failed; no direct fallback or request made');
  }
  return {
    request: (input, init) => nativeFetch(input, { ...init, dispatcher } as RequestInit),
    destroy: () => dispatcher.destroy(),
  };
}
