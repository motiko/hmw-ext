# Help me write

[![CI](https://github.com/motiko/hmw-ext/actions/workflows/ci.yml/badge.svg)](https://github.com/motiko/hmw-ext/actions/workflows/ci.yml)

A browser extension that brings a **"Help me write"** experience to Gmail, powered by **your own AI endpoint**. It's meant for people whose Gmail doesn't offer Gemini, or who'd rather use a different model.

- ✨ A button in the compose toolbar (or press **Alt+H**) opens a card like Gmail's native one.
- **Write** a new email or reply from a short instruction, or **refine** your draft (Polish · Formalize · Elaborate · Shorten · or any change you describe).
- Replies follow the **language and context of the thread**.
- **Learns your tone** from your own messages, stored only in your browser. You can also add style notes and example emails.
- Inserting a draft keeps your signature and quoted history. **Ctrl+Z** undoes it.
- No backend, no telemetry. See [privacy policy](docs/privacy.md).

Chromium browsers only (Chrome, Edge, Brave, Arc). Firefox and other websites are planned.

## Install

- **From source:** run `pnpm install && pnpm build`, open `chrome://extensions`, enable Developer mode, then **Load unpacked** → `.output/chrome-mv3`.
- **From a release:** download the zip from [Releases](https://github.com/motiko/hmw-ext/releases), unzip it, and load it unpacked as above.
- The Chrome Web Store and Edge Add-ons listings aren't available yet.

## Configure your endpoint

Open the extension's options (right-click the toolbar icon → Options), fill in the fields, then click **Test connection** and **Save**. When you save, the browser asks for permission to contact that host.

| Provider | API format | Base URL | Notes |
| --- | --- | --- | --- |
| OpenAI | OpenAI-compatible | `https://api.openai.com/v1` | Model e.g. `gpt-4.1-mini` |
| Anthropic | Anthropic | `https://api.anthropic.com` | Model e.g. `claude-sonnet-5-5` |
| OpenRouter | OpenAI-compatible | `https://openrouter.ai/api/v1` | Any OpenRouter model id |
| Azure OpenAI | OpenAI-compatible, auth header `api-key` | `https://<resource>.openai.azure.com/openai/deployments/<deployment>` | Append `?api-version=…` if your deployment requires it |
| Ollama | OpenAI-compatible | `http://localhost:11434/v1` | No key needed. Start Ollama with `OLLAMA_ORIGINS=chrome-extension://*` |
| LiteLLM / vLLM | OpenAI-compatible | your proxy URL ending in `/v1` | |

## Development

```sh
pnpm install
pnpm dev          # opens Chrome with the extension and hot reload
pnpm test         # unit tests (Vitest + happy-dom)
pnpm build && pnpm test:e2e   # Playwright e2e against Gmail fixtures + mock LLM
pnpm lint && pnpm typecheck
```

How the code is organised: `src/core` holds the providers, prompt building, settings and style profile. `src/sites/gmail` is the Gmail DOM adapter; all its selectors are in `selectors.ts`. `src/ui` is the Preact card, rendered in Shadow DOM. `src/entrypoints` contains the background, content script and options page. When Gmail changes its markup, see [docs/fixtures.md](docs/fixtures.md).

## Releases

Releases use [release-please](https://github.com/googleapis/release-please) and [Conventional Commits](https://www.conventionalcommits.org/). Merging the release PR on `main` tags a version, attaches the extension zip to the GitHub release and, if the secrets below are set, submits it to the stores. If a store's secrets are missing, that store is skipped.

| Store | Repository secrets |
| --- | --- |
| Chrome Web Store (API v2) | `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`, `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` |
| Edge Add-ons | `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY` |

The first Chrome Web Store upload has to be done by hand in the developer dashboard to get an extension ID. Step-by-step setup is in [docs/publishing.md](docs/publishing.md); listing copy is in [docs/store-listing.md](docs/store-listing.md).

## License

MIT
