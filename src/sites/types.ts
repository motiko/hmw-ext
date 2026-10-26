import type { ComposeContext } from '@/core/messages';

export interface Composer {
  root: HTMLElement;
  body: HTMLElement;
  toolbar: HTMLElement | null;
}

export type InsertMode = 'replace-draft' | 'replace-selection';

/** Everything the core needs from a website to offer Help me write in its editors. */
export interface SiteAdapter {
  findComposers(doc: Document): Composer[];
  getContext(composer: Composer, doc: Document): ComposeContext;
  /** Captures the selection (if any) so a later insert can replace it after focus moved away. */
  getDraft(composer: Composer): { text: string; isSelection: boolean };
  insert(composer: Composer, text: string, mode: InsertMode): void;
  /** Element to host the toolbar button, created on first call. */
  mountPoint(composer: Composer): HTMLElement | null;
}
