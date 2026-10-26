import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, getSettings, isConfigured, saveSettings } from '../../src/core/settings';

beforeEach(() => fakeBrowser.reset());

describe('settings', () => {
  it('returns defaults on empty storage', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges and persists a patch', async () => {
    await saveSettings({ model: 'gpt-x', apiKey: 'k' });
    const s = await getSettings();
    expect(s.model).toBe('gpt-x');
    expect(s.apiKey).toBe('k');
    expect(s.temperature).toBe(DEFAULT_SETTINGS.temperature);
  });

  it('caps pasted examples at 5', async () => {
    const s = await saveSettings({ examples: ['1', '2', '3', '4', '5', '6'] });
    expect(s.examples).toHaveLength(5);
  });

  it('stores settings in local storage only', async () => {
    await saveSettings({ apiKey: 'secret' });
    expect(JSON.stringify(await fakeBrowser.storage.sync.get(null))).not.toContain('secret');
  });
});

describe('isConfigured', () => {
  const base = { ...DEFAULT_SETTINGS, baseUrl: 'https://api.openai.com/v1', apiKey: 'k', model: 'm' };
  it('is true with url, key and model', () => expect(isConfigured(base)).toBe(true));
  it('needs a model', () => expect(isConfigured({ ...base, model: '' })).toBe(false));
  it('needs a key for remote hosts', () => expect(isConfigured({ ...base, apiKey: '' })).toBe(false));
  it('allows no key for localhost', () =>
    expect(isConfigured({ ...base, apiKey: '', baseUrl: 'http://localhost:11434/v1' })).toBe(true));
  it('rejects an invalid url', () => expect(isConfigured({ ...base, baseUrl: 'not a url' })).toBe(false));
});
