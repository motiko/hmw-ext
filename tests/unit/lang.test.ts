import { detectLanguage, languageName } from '../../src/core/lang';

describe('detectLanguage', () => {
  it('detects German', () => {
    expect(detectLanguage('Entschuldige, das habe ich leider verpasst. Passt dir Donnerstag um zehn Uhr?')).toBe('de');
  });
  it('detects English', () => {
    expect(detectLanguage('Sorry, I missed that. Would Thursday at ten work for you instead?')).toBe('en');
  });
  it('returns und for too-short text', () => {
    expect(detectLanguage('ok')).toBe('und');
  });
});

describe('languageName', () => {
  it('names a language in English', () => {
    expect(languageName('de')).toBe('German');
  });
});
