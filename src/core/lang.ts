import { franc } from 'franc-min';

const ISO3_TO_1: Record<string, string> = {
  deu: 'de',
  eng: 'en',
  fra: 'fr',
  spa: 'es',
  ita: 'it',
  nld: 'nl',
  por: 'pt',
  pol: 'pl',
};

/** ISO-639-1 code of the text's language, or 'und' when unsure. */
export function detectLanguage(text: string): string {
  const code = franc(text, { minLength: 20, only: Object.keys(ISO3_TO_1) });
  return ISO3_TO_1[code] ?? 'und';
}

export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}
