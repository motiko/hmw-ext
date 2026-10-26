// Every Gmail DOM assumption lives here. Gmail obfuscates class names, so prefer
// roles and data attributes; the class names below have been stable for years.
export const SEL = {
  body: 'div[contenteditable="true"][role="textbox"]',
  toolbar: 'tr.btC',
  toolbarSlot: 'td[data-hmw-slot]',
  dialog: '[role="dialog"]',
  subjectInput: 'input[name="subjectbox"]',
  threadSubject: 'h2.hP',
  recipients: '[data-hovercard-id], span[email]',
  messages: ['div.adn[data-message-id]', 'div[data-message-id]'],
  sender: 'span.gD[email]',
  date: 'span.g3',
  messageBody: 'div.a3s',
  account: 'a[aria-label*="@"]',
  /** Parts of a draft or message that are not the author's own words. */
  notOwnText: '.gmail_signature_prefix, .gmail_signature, .gmail_quote, .gmail_extra, blockquote',
} as const;

/** Max ancestors to climb from the editable body to find its toolbar. */
export const MAX_COMPOSER_DEPTH = 12;
