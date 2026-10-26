import { expect, test } from './fixtures';

const body = '[role="textbox"][contenteditable="true"]';
const button = 'button[aria-label="Help me write"]';

test('create → stream → insert keeps the signature', async ({ openGmail, configure }) => {
  await configure();
  const page = await openGmail('compose-new');
  await page.click(button);
  await page.getByPlaceholder(/Ask for a draft/).fill('Tell the team Thursday works');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'Insert' }).click();
  await expect(page.locator(body)).toContainText('Donnerstag passt.');
  await expect(page.locator(`${body} .gmail_signature`)).toHaveText('Moti Koritz | Example GmbH');
  await expect(page.locator('[data-hmw-card]')).toHaveCount(0);
});

test('undo after insert restores the previous draft', async ({ openGmail, configure }) => {
  await configure();
  const page = await openGmail('reply-thread-de');
  const before = await page.locator(body).innerText();
  await page.click(button);
  await page.getByRole('button', { name: 'Polish' }).click();
  await page.getByRole('button', { name: 'Insert' }).click();
  await expect(page.locator(body)).toContainText('Donnerstag passt.');
  await page.locator(body).focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator(body)).not.toContainText('Donnerstag passt.');
  expect(await page.locator(body).innerText()).toBe(before);
});

test('refine replaces the draft, keeps quote, and prompts in German with thread context', async ({ openGmail, configure, llm }) => {
  await configure();
  const page = await openGmail('reply-thread-de');
  await page.click(button);
  await expect(page.getByRole('dialog', { name: 'Refine my draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Polish' }).click();
  await page.getByRole('button', { name: 'Insert' }).click();
  await expect(page.locator(body)).not.toContainText('Habe ich vermisst');
  await expect(page.locator(`${body} .gmail_quote`)).toContainText('wir hatten heute um 10 Uhr einen Termin');
  const sent = llm.requests.find((r) => r.path === '/v1/chat/completions')!.body as { messages: { content: string }[] };
  const prompt = sent.messages.map((m) => m.content).join('\n');
  expect(prompt).toContain('Write in German');
  expect(prompt).toContain('Wann passt es dir stattdessen?');
  expect(prompt).toContain('Habe ich vermisst');
});

test('missing settings offer the settings page', async ({ openGmail }) => {
  const page = await openGmail('compose-new');
  await page.click(button);
  await page.getByPlaceholder(/Ask for a draft/).fill('anything');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('button', { name: 'Open settings' })).toBeVisible();
});

test('typing in the card does not leak keys to the page', async ({ openGmail, configure }) => {
  await configure();
  const page = await openGmail('compose-new');
  await page.evaluate(() => {
    (window as unknown as { leaked: string[] }).leaked = [];
    document.addEventListener('keydown', (e) => (window as unknown as { leaked: string[] }).leaked.push(e.key));
  });
  await page.click(button);
  await page.getByPlaceholder(/Ask for a draft/).pressSequentially('c?');
  expect(await page.evaluate(() => (window as unknown as { leaked: string[] }).leaked)).toEqual([]);
});
