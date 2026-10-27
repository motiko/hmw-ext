import type { ComposeContext } from '@/core/messages';
import type { Composer, SiteAdapter } from '../types';
import { draftRange, replaceDraft, replaceSelection } from './insert';
import { MAX_COMPOSER_DEPTH, SEL } from './selectors';
import { htmlToText } from './text';
import { readThread } from './thread';

export { toHtml } from './text';

const EMAIL = /[^\s@()<>]+@[^\s@()<>]+\.[^\s@()<>]+/;
const savedSelections = new WeakMap<HTMLElement, Range>();

export function getUserEmail(doc: Document): string {
  const fromTitle = doc.title.match(/ - ([^\s@]+@[^\s@]+\.[^\s@]+) - /)?.[1];
  if (fromTitle) return fromTitle;
  return doc.querySelector(SEL.account)?.getAttribute('aria-label')?.match(EMAIL)?.[0] ?? '';
}

const stripReplyPrefix = (s: string) => s.replace(/^((re|aw|wg|fw|fwd|antw|tr)\s*:\s*)+/i, '').trim().toLowerCase();

function isHidden(el: Element): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if ((n as HTMLElement).hidden) return true;
    const style = n.ownerDocument.defaultView?.getComputedStyle(n);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return true;
  }
  return false;
}

/**
 * The conversation view a composer belongs to. Gmail keeps earlier views hidden in the DOM,
 * so inline replies use their own view and dialogs use the visible one.
 */
function threadView(composer: Composer, doc: Document): Element | null {
  const own = composer.root.closest(SEL.view);
  if (own) return own;
  return [...doc.querySelectorAll(SEL.view)].find((v) => v.querySelector(SEL.threadSubject) && !isHidden(v)) ?? null;
}

function findComposerRoot(body: HTMLElement): { root: HTMLElement; toolbar: HTMLElement } | null {
  let el: HTMLElement | null = body.parentElement;
  for (let i = 0; el && i < MAX_COMPOSER_DEPTH; i++, el = el.parentElement) {
    const toolbar = el.querySelector<HTMLElement>(SEL.toolbar);
    if (toolbar) return { root: el, toolbar };
  }
  return null;
}

export const gmailAdapter: SiteAdapter = {
  findComposers(doc) {
    const out: Composer[] = [];
    doc.querySelectorAll<HTMLElement>(SEL.body).forEach((body) => {
      const found = findComposerRoot(body);
      if (found) out.push({ body, ...found });
    });
    return out;
  },

  getContext(composer, doc): ComposeContext {
    const userEmail = getUserEmail(doc);
    const subjectInput = composer.root.querySelector<HTMLInputElement>(SEL.subjectInput)?.value.trim() ?? '';
    const view = threadView(composer, doc);
    const threadSubject = view?.querySelector(SEL.threadSubject)?.textContent?.trim() ?? '';
    const inDialog = Boolean(composer.root.closest(SEL.dialog));
    // A compose dialog only belongs to the visible thread if it is a reply to it (pop-out reply).
    const isReply =
      Boolean(threadSubject) && (!inDialog || stripReplyPrefix(subjectInput) === stripReplyPrefix(threadSubject));
    const recipients: string[] = [];
    composer.root.querySelectorAll(SEL.recipients).forEach((el) => {
      const email = (el.getAttribute('email') ?? el.getAttribute('data-hovercard-id') ?? '').toLowerCase();
      if (EMAIL.test(email) && email !== userEmail.toLowerCase() && !recipients.includes(email)) recipients.push(email);
    });
    return {
      subject: subjectInput || (isReply ? threadSubject : ''),
      recipients,
      userEmail,
      thread: isReply && view ? readThread(view, userEmail) : [],
    };
  },

  getDraft(composer) {
    const sel = composer.body.ownerDocument.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    if (range && !range.collapsed && composer.body.contains(range.commonAncestorContainer)) {
      savedSelections.set(composer.body, range.cloneRange());
      return { text: range.toString().trim(), isSelection: true };
    }
    savedSelections.delete(composer.body);
    const container = composer.body.ownerDocument.createElement('div');
    container.appendChild(draftRange(composer.body).range.cloneContents());
    return { text: htmlToText(container), isSelection: false };
  },

  insert(composer, text, mode) {
    const saved = savedSelections.get(composer.body);
    if (mode === 'replace-selection' && saved && composer.body.contains(saved.commonAncestorContainer)) {
      replaceSelection(composer.body, saved, text);
    } else {
      replaceDraft(composer.body, text);
    }
    savedSelections.delete(composer.body);
  },

  mountPoint(composer) {
    const toolbar = composer.toolbar;
    if (!toolbar) return null;
    const existing = toolbar.querySelector<HTMLElement>(`${SEL.toolbarSlot} > div`);
    if (existing) return existing;
    const doc = toolbar.ownerDocument;
    const cell = doc.createElement('td');
    cell.className = 'gU';
    cell.setAttribute('data-hmw-slot', '');
    const host = doc.createElement('div');
    cell.appendChild(host);
    const after = toolbar.children[1] ?? null;
    toolbar.insertBefore(cell, after ? after.nextSibling : null);
    return host;
  },
};
