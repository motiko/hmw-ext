import { browser } from 'wxt/browser';

export type ProviderKind = 'openai' | 'anthropic';

export interface Settings {
  provider: ProviderKind;
  baseUrl: string;
  apiKey: string;
  /** 'api-key' header is used by Azure OpenAI. */
  authHeader: 'bearer' | 'api-key';
  model: string;
  temperature: number;
  defaultLanguage: string;
  learnStyle: boolean;
  sendQuotedHistory: boolean;
  styleNotes: string;
  examples: string[];
}

export const DEFAULT_BASE_URLS: Record<ProviderKind, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
};

export const DEFAULT_SETTINGS: Settings = {
  provider: 'openai',
  baseUrl: DEFAULT_BASE_URLS.openai,
  apiKey: '',
  authHeader: 'bearer',
  model: '',
  temperature: 0.7,
  defaultLanguage: 'auto',
  learnStyle: true,
  sendQuotedHistory: true,
  styleNotes: '',
  examples: [],
};

export const MAX_EXAMPLES = 5;
const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const stored = (await browser.storage.local.get(KEY))[KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  next.examples = next.examples.slice(0, MAX_EXAMPLES);
  await browser.storage.local.set({ [KEY]: next });
  return next;
}

export function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function isConfigured(s: Settings): boolean {
  try {
    new URL(s.baseUrl);
  } catch {
    return false;
  }
  return Boolean(s.model && (s.apiKey || isLocalUrl(s.baseUrl)));
}
