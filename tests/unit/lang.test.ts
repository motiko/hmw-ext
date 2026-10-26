import { fakeBrowser } from 'wxt/testing/fake-browser';
import { detectLanguage, languageName } from '../../src/core/lang';

const LONG = 'Hej, jag missade tyvärr vårt möte i dag. Passar det dig på torsdag klockan tio istället?';

function stubCld(result: { isReliable: boolean; languages: { language: string; percentage: number }[] }) {
  return vi.spyOn(fakeBrowser.i18n, 'detectLanguage').mockResolvedValue(result as never);
}

describe('detectLanguage', () => {
  it("returns Chrome's top language when reliable", async () => {
    stubCld({ isReliable: true, languages: [{ language: 'sv', percentage: 97 }] });
    expect(await detectLanguage(LONG)).toBe('sv');
  });

  it('strips region/script subtags', async () => {
    stubCld({ isReliable: true, languages: [{ language: 'zh-Hant', percentage: 99 }] });
    expect(await detectLanguage(LONG)).toBe('zh');
  });

  it('returns und when unreliable and not dominant', async () => {
    stubCld({ isReliable: false, languages: [{ language: 'en', percentage: 40 }] });
    expect(await detectLanguage(LONG)).toBe('und');
  });

  it('returns und for too-short text without asking Chrome', async () => {
    const spy = stubCld({ isReliable: true, languages: [{ language: 'en', percentage: 100 }] });
    expect(await detectLanguage('ok')).toBe('und');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns und when detection throws', async () => {
    vi.spyOn(fakeBrowser.i18n, 'detectLanguage').mockRejectedValue(new Error('nope'));
    expect(await detectLanguage(LONG)).toBe('und');
  });
});

describe('languageName', () => {
  it('names a language in English', () => {
    expect(languageName('de')).toBe('German');
  });
});
