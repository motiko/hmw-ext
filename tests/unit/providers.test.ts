import { getProvider, joinUrl, ProviderError, type ProviderConfig } from '../../src/core/providers/registry';
import type { ChatMessage } from '../../src/core/messages';

const enc = new TextEncoder();
function sse(lines: string[], contentType = 'text/event-stream'): Response {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const l of lines) c.enqueue(enc.encode(l));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': contentType } });
}

const messages: ChatMessage[] = [
  { role: 'system', content: 'SYS' },
  { role: 'user', content: 'hi' },
];
const cfg = (over: Partial<ProviderConfig> = {}): ProviderConfig => ({
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-test',
  model: 'm1',
  temperature: 0.5,
  authHeader: 'bearer',
  ...over,
});

async function collect(it: AsyncIterable<string>) {
  const out: string[] = [];
  for await (const t of it) out.push(t);
  return out;
}

function stubFetch(res: Response | (() => Promise<Response>)) {
  const fn = vi.fn(typeof res === 'function' ? res : async () => res);
  vi.stubGlobal('fetch', fn);
  return fn;
}

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as ProviderError).code;
  }
  return 'no-error';
}

describe('joinUrl', () => {
  it('keeps a query string at the end (Azure api-version)', () =>
    expect(joinUrl('https://r.openai.azure.com/openai/deployments/d?api-version=2024-10-21', '/chat/completions')).toBe(
      'https://r.openai.azure.com/openai/deployments/d/chat/completions?api-version=2024-10-21',
    ));
  it('avoids a doubled /v1', () => expect(joinUrl('https://x/v1/', '/v1/messages')).toBe('https://x/v1/messages'));
  it('strips trailing slashes', () => expect(joinUrl('https://x/v1//', '/chat/completions')).toBe('https://x/v1/chat/completions'));
  it('appends to a bare host', () => expect(joinUrl('https://api.anthropic.com', '/v1/messages')).toBe('https://api.anthropic.com/v1/messages'));
});

describe('OpenAI-compatible provider', () => {
  const p = getProvider('openai');
  const chunk = (t: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`;

  it('yields deltas and stops at [DONE]', async () => {
    stubFetch(sse([chunk('Hal'), chunk('lo'), 'data: [DONE]\n\n', chunk('ignored')]));
    expect(await collect(p.stream(messages, cfg(), new AbortController().signal))).toEqual(['Hal', 'lo']);
  });

  it('posts to /chat/completions with a bearer token and stream:true', async () => {
    const f = stubFetch(sse(['data: [DONE]\n\n']));
    await collect(p.stream(messages, cfg(), new AbortController().signal));
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body as string)).toMatchObject({ model: 'm1', stream: true, temperature: 0.5, messages });
  });

  it('omits temperature when the model default is selected', async () => {
    const f = stubFetch(sse(['data: [DONE]\n\n']));
    await collect(p.stream(messages, cfg({ temperature: null }), new AbortController().signal));
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).not.toHaveProperty('temperature');
  });

  it('tests the connection without token-limit parameters reasoning models reject', async () => {
    const f = stubFetch(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    await p.test(cfg());
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).not.toHaveProperty('max_tokens');
    expect(body).not.toHaveProperty('temperature');
  });

  it('uses the api-key header when configured (Azure)', async () => {
    const f = stubFetch(sse(['data: [DONE]\n\n']));
    await collect(p.stream(messages, cfg({ authHeader: 'api-key' }), new AbortController().signal));
    const headers = (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['api-key']).toBe('sk-test');
    expect(headers.Authorization).toBeUndefined();
  });

  it('sends no auth header without a key (local servers)', async () => {
    const f = stubFetch(sse(['data: [DONE]\n\n']));
    await collect(p.stream(messages, cfg({ apiKey: '' }), new AbortController().signal));
    const headers = (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('maps 401 to unauthorized', async () => {
    stubFetch(new Response('{"error":"bad key"}', { status: 401 }));
    expect(await codeOf(collect(p.stream(messages, cfg(), new AbortController().signal)))).toBe('unauthorized');
  });

  it('maps 429 to rate_limited', async () => {
    stubFetch(new Response('slow down', { status: 429 }));
    expect(await codeOf(collect(p.stream(messages, cfg(), new AbortController().signal)))).toBe('rate_limited');
  });

  it('maps an HTML 200 page to bad_response', async () => {
    stubFetch(new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    expect(await codeOf(collect(p.stream(messages, cfg(), new AbortController().signal)))).toBe('bad_response');
  });

  it('maps an in-stream error object to bad_response', async () => {
    stubFetch(sse([`data: ${JSON.stringify({ error: { message: 'model not found' } })}\n\n`]));
    expect(await codeOf(collect(p.stream(messages, cfg(), new AbortController().signal)))).toBe('bad_response');
  });

  it('maps a fetch TypeError to network', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await codeOf(collect(p.stream(messages, cfg(), new AbortController().signal)))).toBe('network');
  });

  it('maps an aborted signal to aborted', async () => {
    stubFetch(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    const ac = new AbortController();
    ac.abort();
    expect(await codeOf(collect(p.stream(messages, cfg(), ac.signal)))).toBe('aborted');
  });

  it('lists models from /models', async () => {
    stubFetch(new Response(JSON.stringify({ data: [{ id: 'b' }, { id: 'a' }] }), { status: 200 }));
    expect(await p.listModels(cfg())).toEqual(['a', 'b']);
  });
});

describe('Anthropic provider', () => {
  const p = getProvider('anthropic');
  const delta = (t: string) =>
    `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: t } })}\n\n`;

  it('yields text deltas until message_stop', async () => {
    stubFetch(sse([`event: message_start\ndata: {"type":"message_start"}\n\n`, delta('Hal'), delta('lo'), `event: message_stop\ndata: {"type":"message_stop"}\n\n`]));
    expect(await collect(p.stream(messages, cfg({ baseUrl: 'https://api.anthropic.com' }), new AbortController().signal))).toEqual(['Hal', 'lo']);
  });

  it('sends required headers and a top-level system prompt', async () => {
    const f = stubFetch(sse([`event: message_stop\ndata: {"type":"message_stop"}\n\n`]));
    await collect(p.stream(messages, cfg({ baseUrl: 'https://api.anthropic.com' }), new AbortController().signal));
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: 'm1', system: 'SYS', stream: true, max_tokens: 2048 });
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('maps an error event to bad_response', async () => {
    stubFetch(sse([`event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n`]));
    expect(await codeOf(collect(p.stream(messages, cfg(), new AbortController().signal)))).toBe('bad_response');
  });

  it('maps 403 to unauthorized', async () => {
    stubFetch(new Response('{}', { status: 403 }));
    expect(await codeOf(collect(p.stream(messages, cfg(), new AbortController().signal)))).toBe('unauthorized');
  });
});
