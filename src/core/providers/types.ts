import type { ChatMessage, ErrorCode } from '../messages';

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  authHeader: 'bearer' | 'api-key';
}

export class ProviderError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface Provider {
  stream(messages: ChatMessage[], cfg: ProviderConfig, signal: AbortSignal): AsyncGenerator<string>;
  test(cfg: ProviderConfig): Promise<void>;
  listModels(cfg: ProviderConfig): Promise<string[]>;
}

/** Joins base URL and path without doubling a shared segment like '/v1'. */
export function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  const firstSegment = p.match(/^\/[^/]+/)?.[0];
  if (firstSegment && p !== firstSegment && b.endsWith(firstSegment)) return b + p.slice(firstSegment.length);
  return b + p;
}

function snippet(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const msg = parsed?.error?.message ?? parsed?.error ?? parsed?.message;
    if (typeof msg === 'string') return msg;
  } catch {
    // not JSON
  }
  return body.slice(0, 200);
}

export function errorFromStatus(status: number, body: string): ProviderError {
  const detail = snippet(body);
  if (status === 401 || status === 403) return new ProviderError('unauthorized', `Unauthorized (${status}): ${detail}`, status);
  if (status === 429) return new ProviderError('rate_limited', `Rate limited: ${detail}`, status);
  return new ProviderError('bad_response', `HTTP ${status}: ${detail}`, status);
}

/** fetch() with errors mapped to ProviderError and a check that the reply is not an HTML page. */
export async function request(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (init.signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
      throw new ProviderError('aborted', 'Request cancelled');
    }
    throw new ProviderError('network', `Could not reach ${new URL(url).origin}: ${(e as Error).message}`);
  }
  if (!res.ok) throw errorFromStatus(res.status, await res.text().catch(() => ''));
  if ((res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new ProviderError('bad_response', 'The endpoint returned an HTML page. Check the base URL.', res.status);
  }
  return res;
}

export function wrapStreamError(e: unknown, signal: AbortSignal): ProviderError {
  if (e instanceof ProviderError) return e;
  if (signal.aborted) return new ProviderError('aborted', 'Request cancelled');
  return new ProviderError('network', `Connection lost: ${(e as Error).message}`);
}
