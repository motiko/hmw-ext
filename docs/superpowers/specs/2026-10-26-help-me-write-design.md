# Help Me Write — browser extension (v1: Gmail, Chromium)

## Context
Gmail's native "Help me write" (Gemini) is disabled in the user's Workspace (greyed-out sparkle-pen in the compose toolbar). Goal: a **public** Chromium extension that reproduces the native UX in Gmail, powered by a **user-supplied LLM endpoint + API key**, with drafts that match the user's language and tone using thread context and a locally learned style profile. Later sub-projects (separate spec/plan each): other websites, Firefox, SSO.

Repo `/Users/moti.koritz/gh/hmw-ext` is empty (not a git repo yet).

### Decisions (agreed in brainstorming)
- Audience: public → Chrome Web Store + Edge Add-ons; privacy policy; automated publish.
- Browsers: Chromium only (MV3). Firefox later (WXT keeps that cheap).
- Stack: **WXT + TypeScript + Preact**, injected UI in **Shadow DOM**, pnpm, Vitest, Playwright.
- Providers: **OpenAI-compatible** (`/chat/completions`) + **Anthropic native** (`/v1/messages`), both streaming.
- Context: current thread from DOM + **local style profile** (own messages seen in threads + pasted examples + style notes). No Gmail API/OAuth.
- No backend, no telemetry. All LLM calls from the service worker.

## Architecture
```
content script (mail.google.com)                    background service worker
 ├─ SiteAdapter: GmailAdapter                       ├─ ProviderRegistry
 │   findComposers / mountButton / getContext /     │   ├─ OpenAICompatibleProvider
 │   getDraft / insert                               │   └─ AnthropicProvider
 ├─ HelpMeWrite card (Preact, Shadow DOM)           ├─ CredentialSource (v1: ApiKeySource)
 └─ chrome.runtime Port  ── GenerateRequest ──────▶ ├─ PromptBuilder (pure)
                         ◀─ token / done / error ─── ├─ StyleStore (chrome.storage.local)
options page: provider, URL, key, model, test, style  └─ Settings
```

### Planned layout
```
wxt.config.ts  package.json  tsconfig.json  eslint.config.js  playwright.config.ts
src/entrypoints/
  gmail.content/index.tsx        # boots GmailAdapter + UI
  background.ts                  # port handler, provider dispatch, abort
  options/{index.html,main.tsx,App.tsx}
src/core/
  messages.ts                    # GenerateRequest/StreamEvent types for the Port
  prompt/builder.ts              # (task, instruction, thread, samples, notes, lang) → ChatMessage[]
  prompt/tasks.ts                # create | polish | formalize | elaborate | shorten | followup
  providers/{types.ts,openai.ts,anthropic.ts,sse.ts,registry.ts}
  credentials/{types.ts,apiKey.ts}
  settings.ts                    # typed get/set over chrome.storage.local, defaults
  style/store.ts                 # cap 50, dedupe (hash), newest-first
  style/select.ts                # pick 3–5 by language + recipient/domain
  lang.ts                        # lightweight language detection (franc-min)
src/sites/
  types.ts                       # SiteAdapter interface
  gmail/{adapter.ts,selectors.ts,thread.ts,insert.ts}
src/ui/
  HelpMeWriteCard.tsx  RefineMenu.tsx  ToolbarButton.tsx  mountShadow.ts  styles.css
tests/unit/**  tests/fixtures/gmail/*.html  tests/e2e/**  tests/mock-llm/server.ts
.github/workflows/{ci.yml,release.yml}  release-please-config.json
docs/privacy.md  docs/superpowers/specs/2026-10-26-help-me-write-design.md
```

## Component details
**GmailAdapter** (`src/sites/gmail/`)
- `MutationObserver` on body; composer = `div[role=dialog]`/inline reply containing `div[contenteditable=true][role=textbox]` (aria-label "Message Body"/localized → match by role, not label). All selectors only in `selectors.ts`.
- Mount ✨ button into the compose toolbar row (next to formatting `Aa`), plus `Alt+H` shortcut (`commands` in manifest → message to content script) when focus is in a composer.
- `getContext()`: subject, recipients, user's own address (from account button aria-label), thread messages (`[data-message-id]` → sender, date, plain text of `.a3s`), newest-first, token-budgeted (~6k tokens, chars/4 estimate).
- `getDraft()`: body text excluding `.gmail_signature` and `.gmail_quote`; selection if non-empty and inside body.
- `insert(text, mode)`: convert plaintext → `<div>` paragraphs (escaped), place caret (start of body / replace selection / replace own text before signature), `document.execCommand('insertHTML')` so Gmail undo works; dispatch `input` event.
- Side effect: own messages from thread → `StyleStore.add()` (if learning enabled).

**UI** (`src/ui/`) — states: `prompt` → `streaming` → `result` (Recreate / Refine▾ Formalize·Elaborate·Shorten·Polish / follow-up input / Insert); `refine` entry when draft non-empty; inline `error` (no config → "Open settings", 401, 429, network, aborted). Stop button aborts via Port message → `AbortController`. Language dropdown (Auto = thread language, else prompt language). Styled to Gmail look (Google Sans fallback, rounded card), positioned anchored to composer body.

**Background** — `chrome.runtime.onConnect` port per generation; loads settings + credential, builds prompt, streams provider tokens back; maps HTTP errors to typed `StreamEvent{type:'error', code}`.

**Providers** — shared `sse.ts` line parser. OpenAI: `POST {base}/chat/completions`, `Authorization: Bearer`, optional `api-key` header mode for Azure, parse `choices[0].delta.content`, `[DONE]`. Anthropic: `POST {base}/v1/messages`, `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`, system prompt split out, parse `content_block_delta`. `testConnection()` = tiny non-streaming call; `listModels()` where `/models` exists.

**Settings/options** — provider kind, base URL, key (masked), model (+fetch), temperature, default language, learning toggle, "never send quoted history", style notes, up to 5 pasted examples, view/delete learned samples. On save: `chrome.permissions.request({origins:[new URL(base).origin + '/*']})` (manifest: `optional_host_permissions: ["https://*/*","http://localhost/*"]`). Key in `storage.local` only.

**Manifest** (via wxt.config): MV3, `permissions: ["storage"]`, content script `https://mail.google.com/*`, `commands` Alt+H, options page, icons.

## Implementation phases (TDD per unit)
0. **Repo bootstrap**: `git init`, commit spec to `docs/superpowers/specs/2026-10-26-help-me-write-design.md`, WXT scaffold (`pnpm dlx wxt@latest init` preact-ts), ESLint/Prettier, Vitest, `.gitignore` (incl. `.superpowers/`).
1. **Core, pure**: `sse.ts`, `prompt/builder.ts`, `style/select.ts`, `lang.ts`, `settings.ts` — unit tests first.
2. **Providers + background**: OpenAI & Anthropic providers (tests with mocked `fetch` streams), Port protocol, abort, error mapping.
3. **Options page**: settings form, permission request, test connection, style management.
4. **Gmail adapter**: capture 3–4 DOM fixtures (new compose, inline reply, popout, thread with own messages; DE + EN UI); unit tests for find/context/draft/insert against fixtures (happy-dom/jsdom).
5. **UI card**: Preact states, Shadow DOM mount, keyboard shortcut, wire to Port.
6. **E2E**: Playwright launches Chromium with built extension (`--load-extension`), serves fixture page routed as `mail.google.com`, mock LLM SSE server; flow create → stream → insert → Ctrl+Z; refine flow.
7. **CI/Release**: `ci.yml` (install, lint, typecheck, unit, build, e2e; cache pnpm + Playwright). `release.yml` with release-please → on release: `wxt zip`, upload to GitHub Release, `wxt submit` to CWS + Edge (secrets: `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`); publish job skipped if secrets absent.
8. **Public readiness**: `docs/privacy.md` (GitHub Pages), README (setup per provider: OpenAI, Anthropic, OpenRouter, Ollama, Azure), store listing text/screenshots, fixture-refresh doc.

## Future sub-projects (not in v1)
- Other sites: new `SiteAdapter`s (generic contenteditable/textarea adapter, LinkedIn, Outlook web).
- Firefox build via WXT.
- SSO as new `CredentialSource`s: OpenRouter OAuth PKCE (feasible), Google Gemini via `chrome.identity` + generative-language scope (feasible, needs OAuth verification), OpenAI/Anthropic stay API-key (no third-party OAuth known) — verify at that time.

## Verification
- `pnpm lint && pnpm typecheck && pnpm test` green locally and in CI.
- `pnpm build && pnpm test:e2e` — full create/refine/insert/undo flow against fixtures + mock LLM.
- Manual: `pnpm dev` (WXT opens Chrome with extension), configure a real endpoint (e.g. Anthropic key or local Ollama), open real Gmail: reply in a German thread → draft in German matching tone; refine an existing draft; Ctrl+Z restores; signature/quote untouched; Test connection shows clear errors for bad key/URL.
- Release dry-run: push to a branch with release-please PR, verify zip artifact on GitHub Release; store submit job skips cleanly without secrets.
