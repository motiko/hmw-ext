import { browser } from 'wxt/browser';
import type { StyleSample } from './messages';
import type { Settings } from './settings';

export type RuntimeMessage =
  | { type: 'test-connection'; settings?: Settings }
  | { type: 'list-models'; settings?: Settings }
  | { type: 'add-samples'; items: Omit<StyleSample, 'hash' | 'ts'>[] }
  | { type: 'open-options' };

export type RuntimeResult = { ok: true; models?: string[] } | { ok: false; code: string; message: string };

export async function sendRuntime(msg: RuntimeMessage): Promise<RuntimeResult> {
  try {
    return ((await browser.runtime.sendMessage(msg)) as RuntimeResult | undefined) ?? { ok: false, code: 'network', message: 'No response from extension' };
  } catch (e) {
    return { ok: false, code: 'network', message: (e as Error).message };
  }
}
