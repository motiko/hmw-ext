import { browser, type Browser } from 'wxt/browser';
import { providerConfig, runGeneration } from '@/core/generate';
import { PORT_NAME, type GenerateRequest } from '@/core/messages';
import { getProvider, ProviderError } from '@/core/providers/registry';
import type { RuntimeMessage, RuntimeResult } from '@/core/runtime';
import { getSettings } from '@/core/settings';
import { addSamples } from '@/core/style/store';

function failure(e: unknown): RuntimeResult {
  const err = e instanceof ProviderError ? e : new ProviderError('network', (e as Error).message);
  return { ok: false, code: err.code, message: err.message };
}

async function handleMessage(msg: RuntimeMessage): Promise<RuntimeResult> {
  try {
    switch (msg.type) {
      case 'test-connection': {
        const s = msg.settings ?? (await getSettings());
        await getProvider(s.provider).test(await providerConfig(s));
        return { ok: true };
      }
      case 'list-models': {
        const s = msg.settings ?? (await getSettings());
        return { ok: true, models: await getProvider(s.provider).listModels(await providerConfig(s)) };
      }
      case 'add-samples':
        if ((await getSettings()).learnStyle) await addSamples(msg.items);
        return { ok: true };
      case 'open-options':
        await browser.runtime.openOptionsPage();
        return { ok: true };
    }
  } catch (e) {
    return failure(e);
  }
}

function handlePort(port: Browser.runtime.Port) {
  if (port.name !== PORT_NAME) return;
  const controller = new AbortController();
  let started = false;
  port.onDisconnect.addListener(() => controller.abort());
  port.onMessage.addListener((msg: GenerateRequest | { type: 'abort' }) => {
    if (msg.type === 'abort') {
      controller.abort();
      return;
    }
    if (started) return;
    started = true;
    void runGeneration(
      msg,
      (event) => {
        try {
          port.postMessage(event);
        } catch {
          controller.abort();
        }
      },
      controller.signal,
    );
  });
}

export default defineBackground(() => {
  browser.runtime.onConnect.addListener(handlePort);
  browser.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
    void handleMessage(msg).then(sendResponse);
    return true;
  });
  browser.commands.onCommand.addListener(async (command, tab) => {
    if (command !== 'open-help-me-write' || tab?.id === undefined) return;
    await browser.tabs.sendMessage(tab.id, { type: 'open-card' }).catch(() => {});
  });
});
