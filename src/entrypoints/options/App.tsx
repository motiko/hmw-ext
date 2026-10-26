import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import type { StyleSample } from '@/core/messages';
import { sendRuntime } from '@/core/runtime';
import { DEFAULT_BASE_URLS, getSettings, MAX_EXAMPLES, saveSettings, type ProviderKind, type Settings } from '@/core/settings';
import { clearSamples, deleteSample, getSamples } from '@/core/style/store';

const LANGUAGES = [
  ['auto', 'Auto-detect'],
  ['en', 'English'],
  ['de', 'German'],
  ['fr', 'French'],
  ['es', 'Spanish'],
  ['it', 'Italian'],
  ['nl', 'Dutch'],
];

type Status = { kind: 'ok' | 'error' | 'info'; text: string } | null;

async function requestOrigin(baseUrl: string): Promise<boolean> {
  try {
    return await browser.permissions.request({ origins: [`${new URL(baseUrl).origin}/*`] });
  } catch {
    return false;
  }
}

export function App() {
  const [s, setS] = useState<Settings | null>(null);
  const [samples, setSamples] = useState<StyleSample[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSettings().then(setS);
    void getSamples().then(setSamples);
  }, []);

  if (!s) return <main class="page">Loading…</main>;

  const keyProps = {
    id: 'apiKey',
    value: s.apiKey,
    autoComplete: 'off',
    onInput: (e: Event) => set('apiKey', (e.currentTarget as HTMLInputElement).value),
  };

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setS({ ...s, [key]: value });

  const changeProvider = (provider: ProviderKind) => {
    const isDefault = Object.values(DEFAULT_BASE_URLS).includes(s.baseUrl) || !s.baseUrl;
    setS({ ...s, provider, baseUrl: isDefault ? DEFAULT_BASE_URLS[provider] : s.baseUrl });
  };

  const withPermission = async (): Promise<boolean> => {
    const granted = await requestOrigin(s.baseUrl);
    if (!granted) setStatus({ kind: 'error', text: `Access to ${s.baseUrl} was not granted. Requests may fail unless the endpoint allows CORS.` });
    return granted;
  };

  const save = async () => {
    setBusy(true);
    const granted = await withPermission();
    setS(await saveSettings(s));
    if (granted) setStatus({ kind: 'ok', text: 'Saved.' });
    setBusy(false);
  };

  const test = async () => {
    setBusy(true);
    setStatus({ kind: 'info', text: 'Testing…' });
    await withPermission();
    const res = await sendRuntime({ type: 'test-connection', settings: s });
    setStatus(res.ok ? { kind: 'ok', text: 'Connection works.' } : { kind: 'error', text: res.message });
    setBusy(false);
  };

  const fetchModels = async () => {
    await withPermission();
    const res = await sendRuntime({ type: 'list-models', settings: s });
    if (res.ok) {
      setModels(res.models ?? []);
      setStatus({ kind: 'info', text: `${res.models?.length ?? 0} models found.` });
    } else setStatus({ kind: 'error', text: res.message });
  };

  const removeSample = async (hash: string) => {
    await deleteSample(hash);
    setSamples(await getSamples());
  };

  return (
    <main class="page">
      <header>
        <img src="/icon/48.png" alt="" width={32} height={32} />
        <h1>Help me write</h1>
      </header>

      <section>
        <h2>AI endpoint</h2>
        <label>
          API format
          <select value={s.provider} onChange={(e) => changeProvider(e.currentTarget.value as ProviderKind)}>
            <option value="openai">OpenAI-compatible (OpenAI, Azure, OpenRouter, Ollama, LiteLLM…)</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>
        <label>
          Base URL
          <input type="url" value={s.baseUrl} onInput={(e) => set('baseUrl', e.currentTarget.value)} />
        </label>
        {s.provider === 'openai' && (
          <label>
            Auth header
            <select value={s.authHeader} onChange={(e) => set('authHeader', e.currentTarget.value as Settings['authHeader'])}>
              <option value="bearer">Authorization: Bearer</option>
              <option value="api-key">api-key (Azure OpenAI)</option>
            </select>
          </label>
        )}
        <div class="field">
          <label for="apiKey">API key</label>
          <span class="row">
            {showKey ? <input type="text" {...keyProps} /> : <input type="password" {...keyProps} />}
            <button type="button" class="secondary" onClick={() => setShowKey(!showKey)}>
              {showKey ? 'Hide' : 'Show'}
            </button>
          </span>
        </div>
        <div class="field">
          <label for="model">Model</label>
          <span class="row">
            <input id="model" list="models" value={s.model} onInput={(e) => set('model', e.currentTarget.value)} />
            <button type="button" class="secondary" onClick={fetchModels}>
              Fetch models
            </button>
          </span>
          <datalist id="models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <label>
          Temperature ({s.temperature.toFixed(1)})
          <input type="range" min="0" max="1" step="0.1" value={s.temperature} onInput={(e) => set('temperature', Number(e.currentTarget.value))} />
        </label>
      </section>

      <section>
        <h2>Language &amp; privacy</h2>
        <label>
          Fallback language
          <select value={s.defaultLanguage} onChange={(e) => set('defaultLanguage', e.currentTarget.value)}>
            {LANGUAGES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <small>Drafts follow the thread's language; this is used when it can't be detected.</small>
        </label>
        <label class="check">
          <input type="checkbox" checked={s.sendQuotedHistory} onChange={(e) => set('sendQuotedHistory', e.currentTarget.checked)} />
          Send previous messages of the thread as context
        </label>
        <label class="check">
          <input type="checkbox" checked={s.learnStyle} onChange={(e) => set('learnStyle', e.currentTarget.checked)} />
          Learn my writing style from my own messages (stored only in this browser)
        </label>
      </section>

      <section>
        <h2>Writing style</h2>
        <label>
          Style notes
          <textarea
            rows={3}
            placeholder="e.g. I use 'du' with colleagues and sign off with 'VG Moti'."
            value={s.styleNotes}
            onInput={(e) => set('styleNotes', e.currentTarget.value)}
          />
        </label>
        {s.examples.map((ex, i) => (
          <div class="field" key={i}>
            <label for={`example-${i}`}>Example {i + 1}</label>
            <span class="row">
              <textarea
                id={`example-${i}`}
                rows={3}
                value={ex}
                onInput={(e) => set('examples', s.examples.map((x, j) => (j === i ? e.currentTarget.value : x)))}
              />
              <button type="button" class="secondary" onClick={() => set('examples', s.examples.filter((_, j) => j !== i))}>
                Remove
              </button>
            </span>
          </div>
        ))}
        <button
          type="button"
          class="secondary"
          disabled={s.examples.length >= MAX_EXAMPLES}
          onClick={() => set('examples', [...s.examples, ''])}
        >
          Add example
        </button>

        <h3>Learned samples ({samples.length})</h3>
        {samples.length === 0 ? (
          <p class="muted">None yet. Open threads where you replied and they'll be collected here.</p>
        ) : (
          <ul class="samples">
            {samples.map((x) => (
              <li key={x.hash}>
                <span class="sample-meta">
                  {x.lang} · {x.recipient || 'unknown'}
                </span>
                <span class="sample-text">{x.text.slice(0, 160)}</span>
                <button type="button" class="link" onClick={() => removeSample(x.hash)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        {samples.length > 0 && (
          <button
            type="button"
            class="secondary"
            onClick={async () => {
              await clearSamples();
              setSamples([]);
            }}
          >
            Clear all samples
          </button>
        )}
      </section>

      <footer>
        <button type="button" class="secondary" disabled={busy} onClick={test}>
          Test connection
        </button>
        <button type="button" disabled={busy} onClick={save}>
          Save
        </button>
        {status && (
          <span class={`status ${status.kind}`} role="status">
            {status.text}
          </span>
        )}
      </footer>
    </main>
  );
}
