import { SEL } from './selectors';
import { escapeHtml, toHtml } from './text';

/** Range covering the user's own text: from the start of the body up to the signature/quote. */
export function draftRange(body: HTMLElement): { range: Range; hasBoundary: boolean } {
  const doc = body.ownerDocument;
  const range = doc.createRange();
  range.setStart(body, 0);
  const boundary = body.querySelector(SEL.notOwnText);
  let top: Node | null = boundary;
  while (top && top.parentNode !== body) top = top.parentNode;
  if (top) range.setEndBefore(top);
  else range.setEnd(body, body.childNodes.length);
  return { range, hasBoundary: Boolean(top) };
}

/**
 * Replaces `range` with `html`. Uses execCommand so the change lands on Gmail's undo stack;
 * falls back to direct DOM edits where execCommand is unavailable.
 */
export function replaceRange(body: HTMLElement, range: Range, html: string): void {
  const doc = body.ownerDocument;
  body.focus();
  const sel = doc.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  let done: boolean;
  try {
    done = typeof doc.execCommand === 'function' && doc.execCommand('insertHTML', false, html);
  } catch {
    done = false;
  }
  if (!done) {
    range.deleteContents();
    range.insertNode(range.createContextualFragment(html));
    body.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
  }
}

export function replaceDraft(body: HTMLElement, text: string): void {
  const { range, hasBoundary } = draftRange(body);
  replaceRange(body, range, toHtml(text) + (hasBoundary ? '<div><br></div>' : ''));
}

export function replaceSelection(body: HTMLElement, range: Range, text: string): void {
  replaceRange(body, range, text.includes('\n') ? toHtml(text) : escapeHtml(text));
}
