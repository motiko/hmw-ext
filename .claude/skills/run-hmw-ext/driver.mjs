#!/usr/bin/env node
// Drives the BUILT extension (.output/chrome-mv3) in Playwright's Chromium against the
// Gmail fixtures in tests/fixtures/gmail, with a fake OpenAI-compatible LLM.
//
//   node .claude/skills/run-hmw-ext/driver.mjs [scenario ...] [--out DIR] [--headed]
//
// Scenarios (default: all): button, cover, icon, toggle. Each prints PASS/FAIL lines and saves
// screenshots to --out (default: ./run-shots). Exit code 1 if any check failed.
/* global chrome -- used only inside worker.evaluate(), which runs in the extension's service worker */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const EXT = resolve(ROOT, '.output/chrome-mv3');
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const OUT = resolve(flag('--out') ?? 'run-shots');
const headed = args.includes('--headed') && args.splice(args.indexOf('--headed'), 1);
const scenarios = args.length ? args : ['button', 'cover', 'icon', 'toggle'];
const REPLY = ['Hallo Anna,', '\n\n', 'Donnerstag passt. ', 'Bis dann!'];
const BUTTON = 'button[aria-label="Help me write"]';

if (!existsSync(resolve(EXT, 'manifest.json'))) {
  console.error(`No build at ${EXT}. Run: pnpm build`);
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

let failed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
};
const shot = async (page, name) => {
  await page.screenshot({ path: resolve(OUT, `${name}.png`) });
  console.log(`      screenshot ${resolve(OUT, `${name}.png`)}`);
};

// Fake OpenAI-compatible streaming endpoint.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const llm = createServer((req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, CORS).end();
  req.resume();
  req.on('end', () => {
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream' });
    for (const t of REPLY) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`);
    res.end('data: [DONE]\n\n');
  });
}).listen(0);
const llmUrl = `http://127.0.0.1:${llm.address().port}/v1`;

// channel 'chromium' = full Chromium in new headless mode; the default headless shell can't load extensions.
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: !headed,
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
await worker.evaluate((u) => chrome.storage.local.set({ settings: { provider: 'openai', baseUrl: u, apiKey: 'k', model: 'mock' } }), llmUrl);
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://mail.google.com' });

let fixture = 'reply-thread-de';
await ctx.route('https://mail.google.com/**', (r) =>
  r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: readFileSync(resolve(ROOT, 'tests/fixtures/gmail', `${fixture}.html`), 'utf8') }),
);
const openGmail = async (name) => {
  fixture = name;
  const page = await ctx.newPage();
  page.setDefaultTimeout(10_000); // a broken flow fails in 10 s, not Playwright's 30 s
  await page.goto('https://mail.google.com/mail/u/0/');
  await page.locator(BUTTON).waitFor();
  await page.bringToFront();
  return page;
};
/** What clicking the toolbar icon (or Alt+H) does: background sends 'open-card' to the active tab. */
const pressIcon = () =>
  worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return chrome.tabs.sendMessage(tab.id, { type: 'open-card' }).then(() => 'delivered', (e) => `failed: ${e.message}`);
  });
const cards = (page) => page.locator('[data-hmw-card]').count();

const run = {
  // Toolbar button on a page that swallows clicks (as real Gmail does on some toolbars), then refine + insert.
  async button() {
    const page = await openGmail('reply-thread-de');
    await shot(page, 'button-1-toolbar');
    await page.evaluate(() => {
      window.__swallow = (e) => e.stopImmediatePropagation();
      window.addEventListener('click', window.__swallow, true);
    });
    const box = await page.locator(BUTTON).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    check('button opens the card despite swallowed clicks', await page.getByRole('dialog', { name: 'Refine my draft' }).isVisible());
    await shot(page, 'button-2-card');
    // The swallow listener would also block the card's own buttons.
    await page.evaluate(() => window.removeEventListener('click', window.__swallow, true));
    await page.getByRole('button', { name: 'Polish' }).click();
    await page.getByRole('button', { name: 'Insert' }).click();
    const body = await page.locator('[role="textbox"]').innerText();
    check('insert puts the reply above the signature', body.indexOf('Donnerstag passt.') >= 0 && body.indexOf('Donnerstag passt.') < body.indexOf('Moti Koritz |'));
    await shot(page, 'button-3-inserted');
    await page.close();
  },

  // Something covers the button at the end of the toolbar: it moves next to Send and still opens.
  async cover() {
    const page = await openGmail('reply-thread-de');
    const topmost = () =>
      page.evaluate(() => {
        const host = document.querySelector('td[data-hmw-slot] > div');
        const r = host.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === host;
      });
    check('button is reachable at the end of the toolbar', await topmost());
    const r = await page.locator(BUTTON).boundingBox();
    await page.evaluate((r) => {
      const cover = document.createElement('div');
      Object.assign(cover.style, { position: 'fixed', left: `${r.x - 4}px`, top: `${r.y - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px`, zIndex: '10', background: 'rgba(255,0,0,.3)' });
      document.body.appendChild(cover);
    }, r);
    await page.waitForFunction(() => {
      const host = document.querySelector('td[data-hmw-slot] > div');
      const b = host.getBoundingClientRect();
      return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === host;
    }).catch(() => {});
    check('button moves out from under the cover', await topmost());
    await shot(page, 'cover-1-moved');
    await page.click(BUTTON);
    check('moved button opens the card', await page.getByRole('dialog', { name: 'Refine my draft' }).isVisible());
    await page.close();
  },

  // Extension icon with no composer on the page: card over the page, result copied.
  async icon() {
    const page = await openGmail('reply-thread-de');
    await page.evaluate(() => document.querySelectorAll('[role="textbox"]').forEach((el) => el.remove()));
    check('icon message reaches the content script', (await pressIcon()) === 'delivered');
    await page.getByPlaceholder(/Ask for a draft/).fill('Tell Anna Thursday works');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByRole('button', { name: 'Copy' }).waitFor();
    await shot(page, 'icon-1-copy');
    await page.getByRole('button', { name: 'Copy' }).click();
    check('copy puts the reply on the clipboard', (await page.evaluate(() => navigator.clipboard.readText())) === REPLY.join('').trim());
    check('card closes after copy', (await cards(page)) === 0);
    await page.close();
  },

  // Icon / Alt+H toggles the card.
  async toggle() {
    const page = await openGmail('compose-new');
    await pressIcon();
    const opened = await cards(page);
    await shot(page, 'toggle-1-open');
    await pressIcon();
    check('icon toggles the card', opened === 1 && (await cards(page)) === 0, `open=${opened}`);
    await page.close();
  },
};

for (const name of scenarios) {
  if (!run[name]) {
    console.error(`Unknown scenario "${name}". Known: ${Object.keys(run).join(', ')}`);
    failed++;
    continue;
  }
  console.log(`--- ${name}`);
  try {
    await run[name]();
  } catch (e) {
    check(`${name} finished`, false, e.message.split('\n')[0]);
  }
}
await ctx.close();
llm.close();
process.exit(failed ? 1 : 0);
