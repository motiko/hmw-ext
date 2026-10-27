const BLOCK = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'TR', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE']);

/** Plain text of rendered email HTML, keeping paragraph breaks. */
export function htmlToText(root: Node): string {
  let out = '';
  const newline = () => {
    if (out && !out.endsWith('\n')) out += '\n';
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += (node.textContent ?? '').replace(/[ \t\r\n]+/g, ' ');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (el.tagName === 'BR') {
      out += '\n';
      return;
    }
    const block = BLOCK.has(el.tagName);
    if (block) newline();
    el.childNodes.forEach(walk);
    if (block) newline();
  };
  walk(root);
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Text of an element without signatures and quoted history. */
export function ownText(el: Element, notOwn: string): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll(notOwn).forEach((n) => n.remove());
  return htmlToText(clone);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Plain text to Gmail-style paragraphs: one <div> per line, <div><br></div> for blank lines. */
export function toHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => (line ? `<div>${escapeHtml(line)}</div>` : '<div><br></div>'))
    .join('');
}
