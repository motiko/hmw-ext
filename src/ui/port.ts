import { browser } from 'wxt/browser';
import { PORT_NAME, type GenerateRequest, type StreamEvent } from '@/core/messages';

export type Generate = (req: GenerateRequest, onEvent: (e: StreamEvent) => void) => { abort(): void };

/** Streams one generation from the background worker over a dedicated port. */
export const startGeneration: Generate = (req, onEvent) => {
  const port = browser.runtime.connect({ name: PORT_NAME });
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
    onEvent({ type: 'error', code: 'network', message: 'Lost connection to the extension. Reload the page and try again.' });
  });
  port.postMessage(req);
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
