---
name: run-hmw-ext
description: Run, build, drive and screenshot the Help me write Chrome extension (hmw-ext) against mock Gmail pages. Use to launch the extension, click its Gmail toolbar button or extension icon, check a Gmail/card/insert change in a real browser, or take screenshots of the card.
---

# Run hmw-ext (Help me write for Gmail)

A Manifest V3 Chrome extension (WXT + Preact). There is no app to start: you build it
to `.output/chrome-mv3` and load it into Playwright's Chromium. Real Gmail needs a login,
so `https://mail.google.com/**` is routed to the HTML fixtures in `tests/fixtures/gmail/`.
A fake OpenAI-compatible server streams a fixed German reply.

**Agent path:** `.claude/skills/run-hmw-ext/driver.mjs`. All paths here are relative to the repo root.

## Prerequisites

Node 24 (`.nvmrc`), pnpm, and Playwright's Chromium. CI installs them with:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
```

## Build

The driver loads the **built** output, not `src/`. Rebuild after every source change:

```bash
pnpm build
```

## Run (agent path)

```bash
node .claude/skills/run-hmw-ext/driver.mjs                       # all scenarios
node .claude/skills/run-hmw-ext/driver.mjs button --out /some/dir # one scenario, custom screenshot dir
node .claude/skills/run-hmw-ext/driver.mjs icon toggle --headed   # watch it in a window
```

Each check prints a `PASS`/`FAIL` line, and screenshots are written to `--out` (default `./run-shots/`, which git ignores).
The driver exits with 0 when all checks pass, 1 when any fails or a scenario name is unknown, and 2 when there is no build.
**Look at the screenshots.** The fixtures are unstyled HTML, so plain Times text is expected.
The card should look like Gmail's own panel (rounded, shadowed, Google Sans).

| Scenario | What it does |
|---|---|
| `button` | Opens `reply-thread-de` and blocks all clicks the way real Gmail does on some toolbars. Presses the toolbar button with a real mouse press, then **Polish** → **Insert**, and checks the reply lands above the signature. |
| `cover` | Checks the button is the topmost element at the end of the toolbar, then puts a red box over it. The button should move next to Send and still open the card. |
| `icon` | Removes the composer, sends the icon's `open-card` message, then **Create** → **Copy**, and checks the clipboard and that the card closes. |
| `toggle` | On `compose-new`, sends `open-card` twice: the card opens, then closes. |

To add a flow, add a function to the `run` object in the driver. The helpers are `openGmail(fixture)`, `pressIcon()`, `shot(page, name)`, `check(label, ok)` and `cards(page)`.

## Tests

```bash
pnpm lint && pnpm typecheck && pnpm test   # unit (vitest + happy-dom)
pnpm build && pnpm test:e2e                # Playwright, same browser setup as the driver
```

## Run (human path)

`pnpm dev` (WXT) or `pnpm build`, then load `.output/chrome-mv3` with **Load unpacked** in
`chrome://extensions` and open real Gmail. After reloading the extension you must also
**refresh the Gmail tabs**. The old content script's button stays on the page and no longer responds.

## Gotchas

- **Stale build = old behaviour.** The driver checks only that `.output/chrome-mv3/manifest.json` exists, not that it is fresh. Always run `pnpm build` first.
- **`channel: 'chromium'` is required.** Playwright's default headless shell can't load extensions.
- **The toolbar icon can't be clicked from a script.** The driver sends the same `{type: 'open-card'}` message from the service worker that `action.onClicked` and Alt+H send.
- **`chrome.tabs.query({url})` returns nothing** because the extension has no `tabs` permission and can't see URLs. Use `{active: true, lastFocusedWindow: true}` after `page.bringToFront()`.
- **A page-wide click blocker breaks the card too.** The card's buttons use ordinary `onClick`. The `button` scenario removes its blocker once the card is open.
- **The button checks whether it can be reached** with `elementFromPoint` at its centre (`keepReachable` in `src/sites/gmail/adapter.ts`). This runs after DOM changes (300 ms debounce) and on resize, so a cover that appears by scrolling alone is caught only on the next mutation or resize. When the button is off-screen or not laid out (happy-dom), the check gives no answer and the button stays where it is.
- **On `compose-new` the open card covers the toolbar button**, so Playwright can't press the button a second time.
- **The clipboard needs permission:** `ctx.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: 'https://mail.google.com'})`.
- **Real Gmail differs from the fixtures.** Real compose dialogs nest the toolbar about 14 levels deep, and some toolbars swallow clicks. If something works here but not in real Gmail, have the user run a DevTools snippet to see the real page, then update the fixture.

## Troubleshooting

- **`button` fails with `FAIL button opens the card despite swallowed clicks`, then `locator.click: Timeout`:** the toolbar button opens only on `click`, which Gmail swallows. It must open on `pointerdown` (see `src/ui/ToolbarButton.tsx`). An old build also gives this result.
- **`No build at …/.output/chrome-mv3`:** run `pnpm build`.
- **A standalone script outside the repo can't import `@playwright/test`:** keep scripts inside the repo (this driver resolves the package from the repo's `node_modules`), or use `createRequire('<repo>/package.json')`.
