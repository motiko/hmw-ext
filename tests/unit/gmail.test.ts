import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gmailAdapter, getUserEmail, toHtml } from '../../src/sites/gmail/adapter';

const fixture = (name: string) => readFileSync(resolve('tests/fixtures/gmail', `${name}.html`), 'utf8');

function load(name: string) {
  const html = fixture(name);
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.title = parsed.title;
  document.body.innerHTML = parsed.body.innerHTML;
}

const only = () => {
  const list = gmailAdapter.findComposers(document);
  expect(list).toHaveLength(1);
  return list[0]!;
};

describe('findComposers', () => {
  it('finds the inline reply with its toolbar', () => {
    load('reply-thread-de');
    expect(only().toolbar?.classList.contains('btC')).toBe(true);
  });

  it('finds a new compose dialog', () => {
    load('compose-new');
    expect(only().root.closest('[role="dialog"]')).not.toBeNull();
  });

  it('returns nothing for an unknown page', () => {
    document.title = 'Something else';
    document.body.innerHTML = '<div contenteditable="true">chat</div>';
    expect(gmailAdapter.findComposers(document)).toEqual([]);
    expect(getUserEmail(document)).toBe('');
  });
});

describe('getUserEmail', () => {
  it('reads the account email', () => {
    load('reply-thread-de');
    expect(getUserEmail(document)).toBe('moti@example.com');
  });
});

describe('getContext', () => {
  it('reads subject, recipients and thread newest-first', () => {
    load('reply-thread-de');
    const ctx = gmailAdapter.getContext(only(), document);
    expect(ctx.subject).toBe('Termin am Freitag');
    expect(ctx.recipients).toEqual(['anna@example.org']);
    expect(ctx.userEmail).toBe('moti@example.com');
    expect(ctx.thread.map((m) => m.date)).toEqual([
      'Fr., 24. Okt. 2026, 10:20',
      'Mi., 22. Okt. 2026, 11:30',
      'Mi., 22. Okt. 2026, 09:01',
    ]);
    expect(ctx.thread[0]!.text).toContain('Wann passt es dir stattdessen?');
  });

  it('marks own messages and strips their quote and signature', () => {
    load('reply-thread-de');
    const own = gmailAdapter.getContext(only(), document).thread.filter((m) => m.isOwn);
    expect(own).toHaveLength(1);
    expect(own[0]!.text).toContain('Freitag 10 Uhr passt mir gut');
    expect(own[0]!.text).not.toContain('Moti Koritz | Example GmbH');
    expect(own[0]!.text).not.toContain('schrieb Anna');
  });

  it('keeps line breaks in message text', () => {
    load('reply-thread-de');
    expect(gmailAdapter.getContext(only(), document).thread[0]!.text).toMatch(/^Hallo Moti,\n\nwir hatten/);
  });

  it('does not attach an unrelated thread to a new compose dialog', () => {
    load('reply-thread-de');
    const dialog = document.createElement('div');
    dialog.innerHTML = fixture('compose-new').match(/<div class="dw">[\s\S]*<\/div>\s*<\/body>/)![0].replace('</body>', '');
    document.body.appendChild(dialog);
    const compose = gmailAdapter.findComposers(document).find((c) => c.root.closest('[role="dialog"]'))!;
    const ctx = gmailAdapter.getContext(compose, document);
    expect(ctx.subject).toBe('Release update');
    expect(ctx.recipients).toEqual(['team@example.org', 'boss@example.org']);
    expect(ctx.thread).toEqual([]);
  });
});

describe('getDraft', () => {
  it('excludes signature and quoted history', () => {
    load('reply-thread-de');
    expect(gmailAdapter.getDraft(only())).toEqual({ text: 'Sorry,\n\nHabe ich vermisst', isSelection: false });
  });

  it('returns the selection when text inside the body is selected', () => {
    load('reply-thread-de');
    const body = only().body;
    const range = document.createRange();
    range.setStart(body.childNodes[3]!, 0);
    range.setEnd(body.childNodes[3]!, 4);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    expect(gmailAdapter.getDraft(only())).toEqual({ text: 'Habe', isSelection: true });
  });

  it('is empty for a fresh compose', () => {
    load('compose-new');
    expect(gmailAdapter.getDraft(only()).text).toBe('');
  });
});

describe('insert', () => {
  it('replaces the draft but leaves signature and quote untouched', () => {
    load('reply-thread-de');
    const c = only();
    const sig = c.body.querySelector('.gmail_signature')!.outerHTML;
    const quote = c.body.querySelector('.gmail_quote')!.outerHTML;
    gmailAdapter.insert(c, 'Hallo Anna,\n\nentschuldige bitte.', 'replace-draft');
    expect(c.body.textContent).toContain('entschuldige bitte.');
    expect(c.body.textContent).not.toContain('Habe ich vermisst');
    expect(c.body.querySelector('.gmail_signature')!.outerHTML).toBe(sig);
    expect(c.body.querySelector('.gmail_quote')!.outerHTML).toBe(quote);
    expect(c.body.textContent!.indexOf('entschuldige')).toBeLessThan(c.body.textContent!.indexOf('Moti Koritz | Example GmbH'));
  });

  it('replaces only the selection captured by getDraft', () => {
    load('reply-thread-de');
    const c = only();
    const range = document.createRange();
    range.setStart(c.body.childNodes[3]!, 0);
    range.setEnd(c.body.childNodes[3]!, 4);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    gmailAdapter.getDraft(c);
    getSelection()!.removeAllRanges(); // focus moved to the card
    gmailAdapter.insert(c, 'Ich habe es', 'replace-selection');
    expect(c.body.textContent).toContain('Sorry,');
    expect(c.body.textContent).toContain('Ich habe es ich vermisst');
  });

  it('fires an input event so Gmail saves the draft', () => {
    load('compose-new');
    const c = only();
    const spy = vi.fn();
    c.body.addEventListener('input', spy);
    gmailAdapter.insert(c, 'Hello team', 'replace-draft');
    expect(spy).toHaveBeenCalled();
  });
});

describe('mountPoint', () => {
  it('adds one toolbar cell after the formatting button, idempotently', () => {
    load('reply-thread-de');
    const c = only();
    const a = gmailAdapter.mountPoint(c);
    const b = gmailAdapter.mountPoint(c);
    expect(a).toBe(b);
    const cells = [...c.toolbar!.children];
    expect(cells.indexOf(a!.closest('td')!)).toBe(2);
  });
});

describe('toHtml', () => {
  it('escapes markup', () => {
    expect(toHtml('<script>alert(1)</script>')).toContain('&lt;script&gt;');
  });
  it('turns lines into divs and blank lines into <br> divs', () => {
    expect(toHtml('a\n\nb')).toBe('<div>a</div><div><br></div><div>b</div>');
  });
});

describe('indented text', () => {
  it('treats a user-indented blockquote as part of the draft', () => {
    load('compose-new');
    const c = only();
    c.body.innerHTML = 'Intro<blockquote style="margin:0 0 0 40px">indented point</blockquote>Outro<br><div class="gmail_signature_prefix">-- </div><div class="gmail_signature">Sig</div>';
    expect(gmailAdapter.getDraft(c).text).toBe('Intro\nindented point\nOutro');
  });
});

describe('stale views', () => {
  function addHiddenOldThread() {
    const old = document.createElement('div');
    old.setAttribute('role', 'main');
    old.style.display = 'none';
    old.innerHTML =
      '<h2 class="hP">Old unrelated thread</h2><div class="adn ads" data-message-id="#msg-f:9"><span class="gD" email="old@example.org" name="Old">Old</span><span class="g3" title="gestern">gestern</span><div class="a3s">OLD THREAD TEXT that must not leak</div></div>';
    document.body.prepend(old);
  }

  it('reads only the thread around an inline reply, not hidden earlier views', () => {
    load('reply-thread-de');
    addHiddenOldThread();
    const ctx = gmailAdapter.getContext(only(), document);
    expect(ctx.subject).toBe('Termin am Freitag');
    expect(ctx.thread.map((m) => m.text).join()).not.toContain('OLD THREAD TEXT');
    expect(ctx.thread).toHaveLength(3);
  });

  it('matches a pop-out reply to the visible thread only', () => {
    load('reply-thread-de');
    addHiddenOldThread();
    const dialog = document.createElement('div');
    dialog.innerHTML = fixture('compose-new').match(/<div class="dw">[\s\S]*<\/div>\s*<\/body>/)![0].replace('</body>', '');
    dialog.querySelector('input')!.setAttribute('value', 'AW: Termin am Freitag');
    document.body.appendChild(dialog);
    const pop = gmailAdapter.findComposers(document).find((c) => c.root.closest('[role="dialog"]'))!;
    const ctx = gmailAdapter.getContext(pop, document);
    expect(ctx.thread).toHaveLength(3);
    expect(ctx.thread.map((m) => m.text).join()).not.toContain('OLD THREAD TEXT');
  });
});
