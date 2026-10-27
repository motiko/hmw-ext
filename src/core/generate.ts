import { apiKeySource } from './credentials';
import type { GenerateRequest, StreamEvent, StyleSample } from './messages';
import { buildPrompt, resolveLanguage } from './prompt/builder';
import { getProvider, ProviderError, type Provider } from './providers/registry';
import { getSettings, isConfigured, type ProviderKind, type Settings } from './settings';
import { selectSamples } from './style/select';
import { getSamples } from './style/store';

export interface GenerationDeps {
  getSettings(): Promise<Settings>;
  getSamples(): Promise<StyleSample[]>;
  getCredential(settings: Settings): Promise<string>;
  getProvider(kind: ProviderKind): Provider;
}

const defaultDeps: GenerationDeps = {
  getSettings,
  getSamples,
  getCredential: (s) => apiKeySource.getCredential(s),
  getProvider,
};

export async function providerConfig(settings: Settings, getCredential = defaultDeps.getCredential) {
  return {
    baseUrl: settings.baseUrl,
    apiKey: await getCredential(settings),
    model: settings.model,
    temperature: settings.temperature,
    authHeader: settings.authHeader,
  };
}

export async function runGeneration(
  req: GenerateRequest,
  emit: (e: StreamEvent) => void,
  signal: AbortSignal,
  deps: GenerationDeps = defaultDeps,
): Promise<void> {
  try {
    const settings = await deps.getSettings();
    if (!isConfigured(settings)) {
      emit({ type: 'error', code: 'not_configured', message: 'Set up your AI endpoint in the extension settings.' });
      return;
    }
    const detected = await resolveLanguage(req);
    // The default language is only a fallback; it never overrides the thread's language.
    const lang = detected === 'und' && settings.defaultLanguage !== 'auto' ? settings.defaultLanguage : detected;
    const samples = settings.learnStyle
      ? selectSamples(await deps.getSamples(), { lang, recipients: req.context.recipients })
      : [];
    const messages = buildPrompt({
      request: req,
      language: lang,
      samples,
      styleNotes: settings.styleNotes,
      examples: settings.examples,
      sendQuotedHistory: settings.sendQuotedHistory,
    });
    const cfg = await providerConfig(settings, deps.getCredential);
    let received = '';
    for await (const text of deps.getProvider(settings.provider).stream(messages, cfg, signal)) {
      if (signal.aborted) return;
      received += text;
      emit({ type: 'token', text });
    }
    if (signal.aborted) return;
    if (!received.trim()) {
      emit({ type: 'error', code: 'bad_response', message: 'The endpoint returned no text. Check the base URL and model.' });
      return;
    }
    emit({ type: 'done' });
  } catch (e) {
    if (signal.aborted) return;
    const err = e instanceof ProviderError ? e : new ProviderError('network', (e as Error).message);
    emit({ type: 'error', code: err.code, message: err.message });
  }
}
