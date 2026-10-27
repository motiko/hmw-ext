import type { ChatMessage } from '../messages';
import { parseSSE } from './sse';
import { joinUrl, ProviderError, request, wrapStreamError, type Provider, type ProviderConfig } from './types';

const MAX_TOKENS = 2048;

function headers(cfg: ProviderConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': cfg.apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

function split(messages: ChatMessage[]) {
  return {
    system: messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n'),
    messages: messages.filter((m) => m.role !== 'system').map(({ role, content }) => ({ role, content })),
  };
}

export const anthropicProvider: Provider = {
  async *stream(messages, cfg, signal) {
    const res = await request(joinUrl(cfg.baseUrl, '/v1/messages'), {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: MAX_TOKENS,
        stream: true,
        ...(cfg.temperature === null ? {} : { temperature: cfg.temperature }),
        ...split(messages),
      }),
      signal,
    });
    try {
      for await (const ev of parseSSE(res.body!)) {
        let parsed;
        try {
          parsed = JSON.parse(ev.data);
        } catch {
          continue;
        }
        if (parsed.type === 'error') throw new ProviderError('bad_response', parsed.error?.message ?? 'Provider error');
        if (parsed.type === 'message_stop') return;
        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') yield parsed.delta.text;
      }
    } catch (e) {
      throw wrapStreamError(e, signal);
    }
  },

  async test(cfg) {
    await request(joinUrl(cfg.baseUrl, '/v1/messages'), {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify({ model: cfg.model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
    });
  },

  async listModels(cfg) {
    const res = await request(joinUrl(cfg.baseUrl, '/v1/models'), { headers: headers(cfg) });
    const json = await res.json();
    return (json.data ?? []).map((m: { id: string }) => m.id).sort();
  },
};
