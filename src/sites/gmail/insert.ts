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

const anchors = new WeakMap<HTMLElement, HTMLElement>();
const watched = new WeakSet<HTMLElement>();

/** Undo restores our anchor block as an empty line; drop it so undo returns the original draft. */
function watchUndo(body: HTMLElement): void {
  if (watched.has(body)) return;
  watched.add(body);
  body.addEventListener('input', (e) => {
    if ((e as InputEvent).inputType !== 'historyUndo') return;
    const anchor = anchors.get(body);
    if (anchor?.isConnected && anchor.childNodes.length === 1 && anchor.firstChild?.nodeName === 'BR') {
      anchor.remove();
      anchors.delete(body);
    }
  });
}

export function replaceDraft(body: HTMLElement, text: string): void {
  const { range, hasBoundary } = draftRange(body);
  if (!hasBoundary) {
    replaceRange(body, range, toHtml(text));
    return;
  }
  // Chrome moves the caret into the next block after deleting a selection that ends right
  // before it, which would put our text inside the signature prefix. Ending the selection
  // inside a block of our own keeps the insertion in front of the signature/quote.
  const anchor = body.ownerDocument.createElement('div');
  anchor.appendChild(body.ownerDocument.createElement('br'));
  const end = range.endContainer.childNodes[range.endOffset] ?? null;
  body.insertBefore(anchor, end);
  range.setEnd(anchor, anchor.childNodes.length);
  anchors.set(body, anchor);
  watchUndo(body);
  replaceRange(body, range, toHtml(text) + '<div><br></div>');
}

export function replaceSelection(body: HTMLElement, range: Range, text: string): void {
  replaceRange(body, range, text.includes('\n') ? toHtml(text) : escapeHtml(text));
}
