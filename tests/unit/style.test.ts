import { fakeBrowser } from 'wxt/testing/fake-browser';
import { addSamples, clearSamples, deleteSample, getSamples } from '../../src/core/style/store';
import { selectSamples } from '../../src/core/style/select';
import type { StyleSample } from '../../src/core/messages';

beforeEach(() => fakeBrowser.reset());

const long = (n: number) => `Hallo zusammen, das ist Beispieltext Nummer ${n} mit genug Inhalt für ein Muster.`;

describe('style store', () => {
  it('dedupes identical text', async () => {
    await addSamples([{ text: long(1), lang: 'de', recipient: 'a@x.com' }]);
    await addSamples([{ text: long(1), lang: 'de', recipient: 'a@x.com' }]);
    expect(await getSamples()).toHaveLength(1);
  });

  it('ignores short samples', async () => {
    await addSamples([{ text: 'Danke!', lang: 'de', recipient: 'a@x.com' }]);
    expect(await getSamples()).toHaveLength(0);
  });

  it('keeps the newest 50', async () => {
    for (let i = 0; i < 60; i++) await addSamples([{ text: long(i), lang: 'de', recipient: 'a@x.com' }]);
    const all = await getSamples();
    expect(all).toHaveLength(50);
    expect(all.some((s) => s.text === long(59))).toBe(true);
    expect(all.some((s) => s.text === long(0))).toBe(false);
  });

  it('deletes one and clears all', async () => {
    await addSamples([
      { text: long(1), lang: 'de', recipient: 'a@x.com' },
      { text: long(2), lang: 'de', recipient: 'a@x.com' },
    ]);
    const [first] = await getSamples();
    await deleteSample(first!.hash);
    expect(await getSamples()).toHaveLength(1);
    await clearSamples();
    expect(await getSamples()).toHaveLength(0);
  });
});

describe('selectSamples', () => {
  const s = (hash: string, lang: string, recipient: string, ts: number): StyleSample => ({ hash, text: hash, lang, recipient, ts });
  const all = [
    s('en-other', 'en', 'z@other.com', 5),
    s('de-other', 'de', 'z@other.com', 4),
    s('en-same-recipient', 'en', 'anna@example.org', 1),
    s('de-same-domain', 'de', 'boss@example.org', 2),
  ];

  it('prefers same recipient over same language', () => {
    expect(selectSamples(all, { lang: 'de', recipients: ['anna@example.org'] }, 1)[0]!.hash).toBe('en-same-recipient');
  });

  it('ranks same domain + language above language only', () => {
    const picked = selectSamples(all, { lang: 'de', recipients: ['anna@example.org'] }).map((x) => x.hash);
    expect(picked.indexOf('de-same-domain')).toBeLessThan(picked.indexOf('de-other'));
  });

  it('returns at most n (default 4)', () => {
    expect(selectSamples([...all, s('x', 'de', 'q@q.com', 9)], { lang: 'de', recipients: [] })).toHaveLength(4);
  });
});
