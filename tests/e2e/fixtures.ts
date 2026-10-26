import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startMockLlm, type MockLlm } from '../mock-llm/server';

const EXTENSION = resolve('.output/chrome-mv3');

interface Fixtures {
  context: BrowserContext;
  worker: Worker;
  llm: MockLlm;
  openGmail(fixture: 'reply-thread-de' | 'compose-new'): Promise<Page>;
  configure(settings?: Record<string, unknown>): Promise<void>;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  llm: async ({}, use) => {
    const llm = await startMockLlm();
    await use(llm);
    await llm.close();
  },
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await use(context);
    await context.close();
  },
  worker: async ({ context }, use) => {
    await use(context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker')));
  },
  configure: async ({ worker, llm }, use) => {
    await use(async (settings) => {
      const value = settings ?? { provider: 'openai', baseUrl: llm.url, apiKey: 'test-key', model: 'mock-model' };
      await worker.evaluate((s) => chrome.storage.local.set({ settings: s }), value);
    });
  },
  openGmail: async ({ context }, use) => {
    await use(async (fixture) => {
      const html = readFileSync(resolve('tests/fixtures/gmail', `${fixture}.html`), 'utf8');
      await context.route('https://mail.google.com/**', (route) =>
        route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }),
      );
      const page = await context.newPage();
      await page.goto('https://mail.google.com/mail/u/0/');
      return page;
    });
  },
});

export const expect = test.expect;
