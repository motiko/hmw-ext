import { parseSSE } from './sse';
import { joinUrl, ProviderError, request, wrapStreamError, type Provider, type ProviderConfig } from './types';

function headers(cfg: ProviderConfig): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) {
    if (cfg.authHeader === 'api-key') h['api-key'] = cfg.apiKey;
    else h.Authorization = `Bearer ${cfg.apiKey}`;
  }
  return h;
}

export const openaiProvider: Provider = {
  async *stream(messages, cfg, signal) {
    const res = await request(joinUrl(cfg.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify({ model: cfg.model, messages, temperature: cfg.temperature, stream: true }),
      signal,
    });
    try {
      for await (const ev of parseSSE(res.body!)) {
        if (ev.data === '[DONE]') return;
        let parsed;
        try {
          parsed = JSON.parse(ev.data);
        } catch {
          continue;
        }
        if (parsed.error) throw new ProviderError('bad_response', parsed.error.message ?? String(parsed.error));
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) yield text;
      }
    } catch (e) {
      throw wrapStreamError(e, signal);
    }
  },

  async test(cfg) {
    await request(joinUrl(cfg.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
    });
  },

  async listModels(cfg) {
    const res = await request(joinUrl(cfg.baseUrl, '/models'), { headers: headers(cfg) });
    const json = await res.json();
    return (json.data ?? []).map((m: { id: string }) => m.id).sort();
  },
};
