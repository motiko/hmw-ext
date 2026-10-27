import { browser } from 'wxt/browser';
import type { StyleSample } from '../messages';

const KEY = 'styleSamples';
export const MAX_SAMPLES = 50;
export const MIN_SAMPLE_CHARS = 40;

async function hashText(text: string): Promise<string> {
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getSamples(): Promise<StyleSample[]> {
  return ((await browser.storage.local.get(KEY))[KEY] as StyleSample[] | undefined) ?? [];
}

async function setSamples(samples: StyleSample[]): Promise<void> {
  await browser.storage.local.set({ [KEY]: samples });
}

/** Adds samples newest-first, dropping duplicates, short texts and anything past the cap. */
export async function addSamples(items: Omit<StyleSample, 'hash' | 'ts'>[]): Promise<void> {
  const existing = await getSamples();
  const seen = new Set(existing.map((s) => s.hash));
  const fresh: StyleSample[] = [];
  const now = Date.now();
  for (const item of items) {
    if (item.text.trim().length < MIN_SAMPLE_CHARS) continue;
    const hash = await hashText(item.text);
    if (seen.has(hash)) continue;
    seen.add(hash);
    fresh.push({ ...item, text: item.text.trim(), hash, ts: now + fresh.length });
  }
  if (!fresh.length) return;
  const merged = [...fresh.reverse(), ...existing].sort((a, b) => b.ts - a.ts).slice(0, MAX_SAMPLES);
  await setSamples(merged);
}

export async function deleteSample(hash: string): Promise<void> {
  await setSamples((await getSamples()).filter((s) => s.hash !== hash));
}

export async function clearSamples(): Promise<void> {
  await setSamples([]);
}
