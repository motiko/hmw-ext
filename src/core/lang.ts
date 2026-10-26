import { browser } from 'wxt/browser';

export type Detect = (text: string) => Promise<string>;

const MIN_CHARS = 20;
const MIN_PERCENT_IF_UNRELIABLE = 60;

/** ISO-639-1 code of the text's language via Chrome's built-in detector (CLD), or 'und'. */
export const detectLanguage: Detect = async (text) => {
  if (text.trim().length < MIN_CHARS) return 'und';
  try {
    const { isReliable, languages } = await browser.i18n.detectLanguage(text);
    const top = languages[0];
    if (!top || (!isReliable && top.percentage < MIN_PERCENT_IF_UNRELIABLE)) return 'und';
    return top.language.split('-')[0]!.toLowerCase() || 'und';
  } catch {
    return 'und';
  }
};

export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}
