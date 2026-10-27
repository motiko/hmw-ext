import type { Settings } from './settings';

/** Where the API credential comes from. v1: the key typed into settings; SSO sources plug in later. */
export interface CredentialSource {
  getCredential(settings: Settings): Promise<string>;
}

export const apiKeySource: CredentialSource = {
  async getCredential(settings) {
    return settings.apiKey;
  },
};
