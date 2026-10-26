import { runGeneration, type GenerationDeps } from '../../src/core/generate';
import { DEFAULT_SETTINGS, type Settings } from '../../src/core/settings';
import { ProviderError, type Provider } from '../../src/core/providers/registry';
import type { GenerateRequest, StreamEvent } from '../../src/core/messages';

const req: GenerateRequest = {
  type: 'generate',
  task: 'create',
  instruction: 'say hi',
  context: { subject: '', recipients: [], userEmail: '', thread: [] },
  language: 'en',
};
const configured: Settings = { ...DEFAULT_SETTINGS, apiKey: 'k', model: 'm' };

function provider(stream: Provider['stream']): Provider {
  return { stream, test: async () => {}, listModels: async () => [] };
}

function deps(over: Partial<GenerationDeps> = {}): GenerationDeps {
  return {
    getSettings: async () => configured,
    getSamples: async () => [],
    getCredential: async () => 'k',
    getProvider: () =>
      provider(async function* () {
        yield 'Hi';
        yield ' there';
      }),
    ...over,
  };
}

async function run(d: GenerationDeps, signal = new AbortController().signal) {
  const events: StreamEvent[] = [];
  await runGeneration(req, (e) => events.push(e), signal, d);
  return events;
}

describe('runGeneration', () => {
  it('emits not_configured when settings are incomplete', async () => {
    const events = await run(deps({ getSettings: async () => DEFAULT_SETTINGS }));
    expect(events).toEqual([expect.objectContaining({ type: 'error', code: 'not_configured' })]);
  });

  it('emits tokens then done', async () => {
    expect(await run(deps())).toEqual([
      { type: 'token', text: 'Hi' },
      { type: 'token', text: ' there' },
      { type: 'done' },
    ]);
  });

  it('passes the credential and settings to the provider', async () => {
    let seen: unknown;
    await run(
      deps({
        getCredential: async () => 'from-source',
        getProvider: () =>
          provider(async function* (_m, cfg) {
            yield* [];
            seen = cfg;
          }),
      }),
    );
    expect(seen).toMatchObject({ apiKey: 'from-source', model: 'm', baseUrl: configured.baseUrl });
  });

  it('maps a ProviderError to an error event with its code', async () => {
    const events = await run(
      deps({
        getProvider: () =>
          provider(async function* () {
            yield* [];
            throw new ProviderError('unauthorized', 'bad key', 401);
          }),
      }),
    );
    expect(events).toEqual([{ type: 'error', code: 'unauthorized', message: 'bad key' }]);
  });

  it('reports an empty completion as bad_response instead of done', async () => {
    const events = await run(
      deps({
        getProvider: () =>
          provider(async function* () {
            yield '  ';
          }),
      }),
    );
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'bad_response' });
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });

  it('emits an error when settings cannot be read', async () => {
    const events = await run(deps({ getSettings: async () => Promise.reject(new Error('storage broken')) }));
    expect(events).toEqual([expect.objectContaining({ type: 'error', message: expect.stringContaining('storage broken') })]);
  });

  it('emits nothing after abort', async () => {
    const ac = new AbortController();
    const events = await run(
      deps({
        getProvider: () =>
          provider(async function* () {
            yield 'one';
            ac.abort();
            yield 'two';
          }),
      }),
      ac.signal,
    );
    expect(events).toEqual([{ type: 'token', text: 'one' }]);
  });
});
