import { browser, type Browser } from 'wxt/browser';
import { PORT_NAME, type GenerateRequest, type StreamEvent } from '@/core/messages';

export type Generate = (req: GenerateRequest, onEvent: (e: StreamEvent) => void) => { abort(): void };

/** Streams one generation from the background worker over a dedicated port. */
const RELOAD_HINT = 'Help me write was updated or restarted. Reload Gmail and try again.';

export const startGeneration: Generate = (req, onEvent) => {
  let port: Browser.runtime.Port;
  try {
    port = browser.runtime.connect({ name: PORT_NAME });
    port.postMessage(req);
  } catch {
    // The extension was updated or reloaded while this tab kept the old content script.
    onEvent({ type: 'error', code: 'network', message: RELOAD_HINT });
    return { abort() {} };
  }
  let finished = false;
  const finish = () => {
    finished = true;
    try {
      port.disconnect();
    } catch {
      // already disconnected
    }
  };
  port.onMessage.addListener((event: StreamEvent) => {
    if (finished) return;
    onEvent(event);
    if (event.type !== 'token') finish();
  });
  port.onDisconnect.addListener(() => {
    if (finished) return;
    finished = true;
    onEvent({ type: 'error', code: 'network', message: 'Lost connection to Help me write. Please try again.' });
  });
  return {
    abort() {
      if (finished) return;
      try {
        port.postMessage({ type: 'abort' });
      } catch {
        // port already gone
      }
      finish();
    },
  };
};
