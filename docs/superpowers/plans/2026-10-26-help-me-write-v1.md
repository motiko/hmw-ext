# Help Me Write v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chromium MV3 extension that adds a native-feeling "Help me write" card to Gmail compose, powered by a user-configured OpenAI-compatible or Anthropic endpoint, using thread context and a local style profile.

**Architecture:** WXT project. Content script on `mail.google.com` (Gmail adapter + Preact card in a Shadow DOM) talks to the background service worker over a `chrome.runtime` Port; the worker builds the prompt, calls the provider with streaming, and relays tokens. Options page stores settings in `chrome.storage.local`.

**Tech Stack:** WXT 0.21, TypeScript (strict), Preact + `@preact/preset-vite`, franc-min, Vitest + happy-dom, Playwright, ESLint (typescript-eslint), pnpm 10, Node 24, GitHub Actions, release-please.

**Spec:** `docs/superpowers/specs/2026-10-26-help-me-write-design.md`

## Global Constraints
- MV3, Chromium only. `permissions: ["storage"]`; `optional_host_permissions: ["https://*/*", "http://localhost/*", "http://127.0.0.1/*"]`; content script match `https://mail.google.com/*`.
- No backend, no telemetry, no third-party requests except the user's configured endpoint.
- API key only in `chrome.storage.local` (never `storage.sync`), only read in the background worker.
- All Gmail selectors live in `src/sites/gmail/selectors.ts`.
- Thread context budget: 24 000 chars (~6k tokens), newest messages first.
- Style store cap: 50 samples, newest kept, de-duplicated by hash. Pasted examples: max 5. Samples per request: 4.
- Anthropic headers: `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`.
- Shortcut: `Alt+H` (manifest `commands`, rebindable).
- License MIT; public repo `motiko/hmw-ext`.

## Review Focus
1. Gmail DOM differs from fixtures (selector miss) → button simply doesn't appear; no exceptions thrown, nothing else on the page breaks. Test: adapter on an empty/unknown document returns `[]` / safe defaults (Task 8).
2. Insert into a reply with signature + quoted history → only the user's own text is replaced; `.gmail_signature` and `.gmail_quote` survive byte-identical (Task 8).
3. Endpoint misconfiguration (trailing slash in base URL, base URL already ending in `/v1`, 401, 429, non-SSE HTML error page) → typed error code shown, never a hang (Tasks 5, 6).
4. User closes the card / clicks Stop mid-stream → fetch aborted, no further tokens rendered, port closed (Tasks 6, 9).
5. HTML/script-looking text in a model reply → inserted as literal text, never as markup (Task 8 `toHtml` escaping).

---

### Task 1: Scaffold, tooling, CI baseline, GitHub repo

**Files:** Create `package.json`, `wxt.config.ts`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `LICENSE`, `README.md` (stub), `src/entrypoints/background.ts` (stub), `.github/workflows/ci.yml`, `.nvmrc`, `scripts/icons.mjs`, `assets/icon.svg`, `public/icon/{16,32,48,128}.png`.

**Produces:** scripts `dev`, `build`, `zip`, `lint`, `typecheck`, `test`, `test:e2e`, `icons`; `srcDir: 'src'`.

- [ ] Write config: WXT with `srcDir: 'src'`, `vite: () => ({ plugins: [preact()] })`, manifest per Global Constraints, `commands: { 'open-help-me-write': { suggested_key: { default: 'Alt+H' }, description: 'Open Help me write' } }`.
- [ ] `scripts/icons.mjs`: render `assets/icon.svg` to PNGs at 16/32/48/128 via Playwright Chromium screenshots; run it, commit PNGs.
- [ ] `ci.yml`: on push/PR → checkout, pnpm/action-setup, setup-node (cache pnpm), `pnpm install --frozen-lockfile`, lint, typecheck, test, build. (E2E job added in Task 10.)
- [ ] Verify: `pnpm lint && pnpm typecheck && pnpm test --passWithNoTests && pnpm build` all exit 0; `.output/chrome-mv3/manifest.json` contains the commands and optional host permissions.
- [ ] `gh repo create motiko/hmw-ext --public --source . --push`; commit `chore: scaffold WXT + Preact extension`.

### Task 2: Shared types + SSE parser

**Files:** Create `src/core/messages.ts`, `src/core/providers/sse.ts`; Test `tests/unit/sse.test.ts`.

**Produces:**
```ts
// messages.ts
export type Task = 'create' | 'polish' | 'formalize' | 'elaborate' | 'shorten' | 'followup';
export interface ThreadMessage { from: string; fromEmail: string; date: string; text: string; isOwn: boolean }
export interface ComposeContext { subject: string; recipients: string[]; userEmail: string; thread: ThreadMessage[] }
export interface GenerateRequest { type: 'generate'; task: Task; instruction: string; draft?: string; previous?: string; context: ComposeContext; language: string /* 'auto' | ISO-639-1 */ }
export type ErrorCode = 'not_configured' | 'unauthorized' | 'rate_limited' | 'network' | 'bad_response' | 'aborted';
export type StreamEvent = { type: 'token'; text: string } | { type: 'done' } | { type: 'error'; code: ErrorCode; message: string };
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export const PORT_NAME = 'hmw-generate';
// sse.ts
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event?: string; data: string }>
```

- [ ] Tests: `parses data lines split across chunks`, `handles CRLF and multi-line data joined with \n`, `captures event: field`, `ignores comments (:) and blank keep-alives`, `flushes final event without trailing blank line`.
- [ ] Run → FAIL; implement (TextDecoder stream, buffer by line, dispatch on blank line); run → PASS; commit `feat: SSE parser and shared message types`.

### Task 3: Language detection, prompt builder

**Files:** Create `src/core/lang.ts`, `src/core/prompt/tasks.ts`, `src/core/prompt/builder.ts`; Test `tests/unit/lang.test.ts`, `tests/unit/builder.test.ts`.

**Produces:**
```ts
export function detectLanguage(text: string): string // ISO-639-1 or 'und'; franc-min, minLength 20; map deu→de, eng→en, fra→fr, spa→es, ita→it, nld→nl, por→pt, pol→pl
export function languageName(code: string): string   // Intl.DisplayNames(['en'], {type:'language'})
export const TASK_INSTRUCTIONS: Record<Task, string>
export interface StyleSample { hash: string; text: string; lang: string; recipient: string; ts: number }
export interface PromptInput { request: GenerateRequest; samples: StyleSample[]; styleNotes: string; examples: string[]; sendQuotedHistory: boolean; maxContextChars?: number /* default 24000 */ }
export function resolveLanguage(req: GenerateRequest): string // explicit > newest thread msg > draft > instruction > 'und'
export function buildPrompt(input: PromptInput): ChatMessage[] // [system, user]
```

- [ ] Tests (lang): German sentence → `de`; English → `en`; `"ok"` → `und`.
- [ ] Tests (builder): system message says "Write only the email body", names target language (`German` for a German thread with language `auto`), includes style notes and each sample/example text; `polish` task includes the draft and the polish instruction; `followup` includes `previous` and instruction; thread rendered newest-first and truncated so total thread chars ≤ `maxContextChars` (oldest dropped); `sendQuotedHistory:false` → no thread messages but subject/recipients present.
- [ ] Run → FAIL; implement; run → PASS; commit `feat: language detection and prompt builder`.

### Task 4: Settings, style store, sample selection

**Files:** Create `src/core/settings.ts`, `src/core/style/store.ts`, `src/core/style/select.ts`; Test `tests/unit/settings.test.ts`, `tests/unit/style.test.ts` (use `wxt/testing` fakeBrowser via `WxtVitest()` plugin).

**Produces:**
```ts
export type ProviderKind = 'openai' | 'anthropic';
export interface Settings { provider: ProviderKind; baseUrl: string; apiKey: string; authHeader: 'bearer' | 'api-key'; model: string; temperature: number; defaultLanguage: string; learnStyle: boolean; sendQuotedHistory: boolean; styleNotes: string; examples: string[] }
export const DEFAULT_SETTINGS: Settings // provider 'openai', baseUrl 'https://api.openai.com/v1', model '', temperature 0.7, defaultLanguage 'auto', learnStyle true, sendQuotedHistory true, examples []
export async function getSettings(): Promise<Settings>
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> // examples sliced to 5
export function isConfigured(s: Settings): boolean // baseUrl && apiKey && model (apiKey optional when baseUrl host is localhost/127.0.0.1)
export async function addSamples(items: Omit<StyleSample, 'hash' | 'ts'>[]): Promise<void> // cap 50, dedupe
export async function getSamples(): Promise<StyleSample[]>
export async function deleteSample(hash: string): Promise<void>
export async function clearSamples(): Promise<void>
export function selectSamples(all: StyleSample[], opts: { lang: string; recipients: string[] }, n?: number /* 4 */): StyleSample[]
```
Selection score: same recipient +3, same recipient domain +2, same lang +2, then newest. Samples with text < 40 chars ignored on add.

- [ ] Tests: defaults returned on empty storage; save merges and persists; examples capped at 5; `isConfigured` cases incl. localhost without key; store dedupes identical text, keeps newest 50 of 60; `selectSamples` prefers same recipient over same lang, returns ≤ n.
- [ ] Run → FAIL; implement (hash = SHA-256 hex via `crypto.subtle` of normalized text); run → PASS; commit `feat: settings and style profile store`.

### Task 5: Providers

**Files:** Create `src/core/providers/{types.ts,openai.ts,anthropic.ts,registry.ts}`; Test `tests/unit/providers.test.ts` (stub `fetch` with `ReadableStream` bodies).

**Produces:**
```ts
export interface ProviderConfig { baseUrl: string; apiKey: string; model: string; temperature: number; authHeader: 'bearer' | 'api-key' }
export class ProviderError extends Error { constructor(public code: ErrorCode, message: string, public status?: number) }
export interface Provider { stream(messages: ChatMessage[], cfg: ProviderConfig, signal: AbortSignal): AsyncGenerator<string>; test(cfg: ProviderConfig): Promise<void>; listModels(cfg: ProviderConfig): Promise<string[]> }
export function getProvider(kind: ProviderKind): Provider
export function joinUrl(base: string, path: string): string // strips trailing '/', avoids '/v1/v1'
export function errorFromStatus(status: number, body: string): ProviderError // 401/403→unauthorized, 429→rate_limited, else bad_response
```
OpenAI: `joinUrl(base,'/chat/completions')`, body `{model, messages, temperature, stream:true}`; auth `Authorization: Bearer` or `api-key` header. Anthropic: `joinUrl(base,'/v1/messages')` (base default `https://api.anthropic.com`), system split out, `max_tokens: 2048`; deltas from `content_block_delta.delta.text`; `error` event → `bad_response`.

- [ ] Tests: OpenAI yields deltas and stops at `[DONE]`; sends bearer vs api-key header; Anthropic yields `text_delta`s, sends required headers, puts system in top-level `system`; 401 → `unauthorized`; 429 → `rate_limited`; `text/html` 200 response → `bad_response`; fetch TypeError → `network`; aborted signal → `aborted`; `joinUrl('https://x/v1/','/v1/messages')` → `https://x/v1/messages`.
- [ ] Run → FAIL; implement; run → PASS; commit `feat: OpenAI-compatible and Anthropic streaming providers`.

### Task 6: Background worker

**Files:** Create `src/core/generate.ts`; Modify `src/entrypoints/background.ts`; Test `tests/unit/generate.test.ts`.

**Consumes:** Tasks 2–5. **Produces:**
```ts
export async function runGeneration(req: GenerateRequest, emit: (e: StreamEvent) => void, signal: AbortSignal, deps?: { getSettings; getSamples; getProvider }): Promise<void>
```
Background: `browser.runtime.onConnect` for `PORT_NAME` → on first `GenerateRequest` start `runGeneration` with an `AbortController`; `{type:'abort'}` message or port disconnect aborts. `browser.runtime.onMessage` handlers: `{type:'test-connection'}` → `{ok:true}|{ok:false,code,message}`; `{type:'list-models'}`; `{type:'add-samples', items}`. `browser.commands.onCommand('open-help-me-write')` → `tabs.sendMessage(tab.id, {type:'open-card'})`.

- [ ] Tests: not configured → single `error not_configured`; happy path emits tokens then `done`; ProviderError mapped to `error` with its code; abort → no `done`, emits nothing after abort.
- [ ] Run → FAIL; implement; run → PASS; `pnpm build` passes; commit `feat: background generation pipeline`.

### Task 7: Options page

**Files:** Create `src/entrypoints/options/{index.html,main.tsx,App.tsx,style.css}`; Test `tests/unit/options.test.tsx` (@testing-library/preact).

- [ ] Form fields per `Settings`; provider switch fills base URL default only if current base is the other default; key input `type=password` with show toggle; "Fetch models" → `list-models` → datalist; "Test connection" shows ✓ or error message; Save → `browser.permissions.request({ origins: [new URL(baseUrl).origin + '/*'] })` then `saveSettings`; style section: notes textarea, up to 5 example textareas, learned samples list with delete + "Clear all", learning toggle, "Send quoted history" toggle.
- [ ] Tests: renders saved values; save calls `permissions.request` with origin pattern `https://api.anthropic.com/*` and persists; switching provider updates default base URL; sixth example cannot be added.
- [ ] Run → FAIL; implement; run → PASS; commit `feat: options page`.

### Task 8: Gmail adapter + fixtures

**Files:** Create `src/sites/types.ts`, `src/sites/gmail/{selectors.ts,adapter.ts,thread.ts,insert.ts}`, `tests/fixtures/gmail/{compose-new.html,reply-thread-de.html}`, `docs/fixtures.md`; Test `tests/unit/gmail.test.ts` (happy-dom).

**Produces:**
```ts
export interface Composer { root: HTMLElement; body: HTMLElement; toolbar: HTMLElement | null }
export interface SiteAdapter {
  findComposers(doc: Document): Composer[];
  getContext(composer: Composer, doc: Document): ComposeContext;
  getDraft(composer: Composer): { text: string; isSelection: boolean };
  insert(composer: Composer, text: string, mode: 'replace-draft' | 'replace-selection'): void;
  mountPoint(composer: Composer): HTMLElement | null; // toolbar cell to host the button
}
export const gmailAdapter: SiteAdapter
export function getUserEmail(doc: Document): string // account aria-label email, fallback document.title regex
export function toHtml(text: string): string        // escape &<>"'; blank-line paragraphs → <div>..</div><div><br></div>
```
Selectors (first match wins, arrays): body `div[contenteditable="true"][role="textbox"]`; composer root = `body.closest('div[role="dialog"], .M9, .ip, .aoI') ?? body.parentElement`; toolbar `tr.btC`; send button `div[role="button"].T-I.aoO`; thread messages `div.adn[data-message-id], div[data-message-id]`; sender `span.gD[email]`; date `span.g3[title]`; body `div.a3s`; subject `h2.hP`; recipients `[data-hovercard-id], span[email]` inside composer root; signature `.gmail_signature`; quote `.gmail_quote, .gmail_extra`.
Fixtures are hand-built to Gmail's known structure (German UI, own message, signature, quote); `docs/fixtures.md` explains replacing them with real sanitized snapshots via `copy(document.documentElement.outerHTML)` in DevTools.

- [ ] Tests: finds 1 composer in each fixture with toolbar; unknown document → `[]`, `getUserEmail` → `''`; context: subject, recipients, userEmail, thread newest-first, `isOwn` set for user's messages, quote/signature stripped from message text; `getDraft` excludes signature + quote; selection inside body → `isSelection:true`; `insert('replace-draft')` (fallback path, no execCommand in happy-dom) replaces own text, leaves `.gmail_signature`/`.gmail_quote` `outerHTML` unchanged; `toHtml('<script>x</script>')` contains `&lt;script&gt;`.
- [ ] Run → FAIL; implement (`insert`: select range of own text, then `document.execCommand('insertHTML', false, toHtml(text))`; if it returns false, manual Range replace + dispatch `input` event); run → PASS; commit `feat: Gmail site adapter`.

### Task 9: Help Me Write card + content script

**Files:** Create `src/ui/{HelpMeWriteCard.tsx,RefineMenu.tsx,ToolbarButton.tsx,port.ts,styles.css}`, `src/entrypoints/gmail.content/index.tsx`; Test `tests/unit/card.test.tsx`.

**Consumes:** `gmailAdapter`, `PORT_NAME`, message types. **Produces:**
```ts
export function startGeneration(req: GenerateRequest, onEvent: (e: StreamEvent) => void): { abort(): void } // port.ts
export interface CardProps { mode: 'create' | 'refine'; getContext(): ComposeContext; getDraft(): { text: string; isSelection: boolean }; onInsert(text: string, mode: 'replace-draft' | 'replace-selection'): void; onClose(): void; generate?: typeof startGeneration; openSettings(): void }
```
States: `prompt` (textarea "Ask for a draft…" / refine chips Polish·Formalize·Elaborate·Shorten + free text, language select Auto/de/en/fr/es/it/nl), `streaming` (text + Stop), `result` (Recreate, Refine ▾, follow-up input, Insert), `error` (message; `not_configured` shows "Open settings"). Esc closes (aborts). Content script: WXT `createIntegratedUi`/`createShadowRootUi` per composer; `MutationObserver` (debounced 300 ms) mounts `ToolbarButton` into `mountPoint`, marks composer `data-hmw="1"`; button opens card anchored above the body; `open-card` message opens it for the focused composer. On thread view, sends own messages (`isOwn`) as `add-samples` when `learnStyle`.

- [ ] Tests (fake `generate`): Create sends `task:'create'` + instruction; tokens stream into preview; Stop calls `abort`; Insert calls `onInsert(text,'replace-draft')`; refine mode with selection sends `task:'polish'` and `draft`, inserts with `replace-selection`; Formalize on result sends `task:'formalize'` with `previous`; `not_configured` error shows "Open settings" button.
- [ ] Run → FAIL; implement; run → PASS; `pnpm build`; commit `feat: Help me write card and Gmail content script`.

### Task 10: End-to-end tests

**Files:** Create `playwright.config.ts`, `tests/e2e/fixtures.ts`, `tests/e2e/gmail.spec.ts`, `tests/mock-llm/server.ts`; Modify `.github/workflows/ci.yml` (e2e job).

- [ ] `fixtures.ts`: `launchPersistentContext('', { channel: 'chromium', args: ['--disable-extensions-except=…','--load-extension=…'] })` from `.output/chrome-mv3`; get service worker; set storage `{ settings: { provider:'openai', baseUrl:'http://127.0.0.1:<port>/v1', apiKey:'test', model:'mock', … } }`; `context.route('https://mail.google.com/**')` → fulfill fixture HTML.
- [ ] Mock server: `POST /v1/chat/completions` streams `["Hallo ","Anna,","\n\nDonnerstag passt."]` as SSE with CORS headers (`*`, allow `authorization, content-type`), answers `OPTIONS`.
- [ ] Specs: `create → stream → insert` (body contains "Donnerstag passt.", signature still present); `Ctrl+Z after insert restores previous body`; `refine existing draft replaces it`; `missing settings shows Open settings`.
- [ ] Run `pnpm build && pnpm test:e2e` → PASS; CI e2e job (`pnpm exec playwright install --with-deps chromium`, upload report on failure); commit `test: e2e Gmail flow with mock LLM`.

### Task 11: Release pipeline + public readiness

**Files:** Create `.github/workflows/release.yml`, `release-please-config.json`, `.release-please-manifest.json`, `docs/privacy.md`, `docs/store-listing.md`; Modify `README.md`.

- [ ] `release.yml` on push to `main`: `googleapis/release-please-action@v4` (`release-type: node`); if `release_created`: build, `pnpm zip`, `gh release upload ${tag} .output/*-chrome.zip`; then `wxt submit --chrome-zip … --edge-zip …` only if `secrets.CHROME_EXTENSION_ID != ''` (env `CHROME_EXTENSION_ID, CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, CHROME_REFRESH_TOKEN, EDGE_PRODUCT_ID, EDGE_CLIENT_ID, EDGE_API_KEY`). `wxt.config` keeps manifest version from `package.json`.
- [ ] `docs/privacy.md`: what is read (open thread, draft), where it goes (only the configured endpoint), what is stored locally (settings, key, ≤50 samples), no telemetry, how to delete. README: features, install, per-provider setup (OpenAI, Anthropic, OpenRouter, Ollama with `OLLAMA_ORIGINS`, Azure), dev commands, release process + required secrets.
- [ ] Verify: `actionlint`-clean (run via `pnpm dlx` if available, else `gh workflow view` after push); push; CI green on GitHub; commit `ci: release-please and store publishing`.

## Verification (whole plan)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` green locally; GitHub Actions CI green on `main`.
- Manual (user): `pnpm dev`, configure real endpoint, real Gmail German reply → German draft, refine, Ctrl+Z, signature/quote intact.
