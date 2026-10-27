import type { ThreadMessage } from '@/core/messages';
import { SEL } from './selectors';
import { ownText } from './text';

/** Messages of the open conversation, newest first. Collapsed messages without a body are skipped. */
export function readThread(scope: ParentNode, userEmail: string): ThreadMessage[] {
  const selector = SEL.messages.find((s) => scope.querySelector(s));
  if (!selector) return [];
  const me = userEmail.toLowerCase();
  const out: ThreadMessage[] = [];
  scope.querySelectorAll(selector).forEach((el) => {
    const body = el.querySelector(SEL.messageBody);
    if (!body) return;
    const sender = el.querySelector(SEL.sender);
    const fromEmail = sender?.getAttribute('email') ?? '';
    const dateEl = el.querySelector(SEL.date);
    const text = ownText(body, SEL.notOwnText);
    if (!text) return;
    out.push({
      from: sender?.getAttribute('name') ?? sender?.textContent?.trim() ?? '',
      fromEmail,
      date: dateEl?.getAttribute('title') ?? dateEl?.textContent?.trim() ?? '',
      text,
      isOwn: Boolean(me) && fromEmail.toLowerCase() === me,
    });
  });
  return out.reverse();
}
