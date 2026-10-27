import type { ProviderKind } from '../settings';
import { anthropicProvider } from './anthropic';
import { openaiProvider } from './openai';
import type { Provider } from './types';

export { joinUrl, ProviderError, errorFromStatus } from './types';
export type { Provider, ProviderConfig } from './types';

export function getProvider(kind: ProviderKind): Provider {
  return kind === 'anthropic' ? anthropicProvider : openaiProvider;
}
