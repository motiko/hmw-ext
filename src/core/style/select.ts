import type { StyleSample } from '../messages';

const domainOf = (email: string) => email.split('@')[1]?.toLowerCase() ?? '';

/** Picks the samples most likely to reflect how the user writes to these recipients in this language. */
export function selectSamples(
  all: StyleSample[],
  opts: { lang: string; recipients: string[] },
  n = 4,
): StyleSample[] {
  const recipients = new Set(opts.recipients.map((r) => r.toLowerCase()));
  const domains = new Set(opts.recipients.map(domainOf).filter(Boolean));
  const score = (s: StyleSample) =>
    (recipients.has(s.recipient.toLowerCase()) ? 3 : 0) +
    (domains.has(domainOf(s.recipient)) ? 2 : 0) +
    (s.lang === opts.lang ? 2 : 0);
  return [...all].sort((a, b) => score(b) - score(a) || b.ts - a.ts).slice(0, n);
}
