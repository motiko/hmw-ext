# Changelog

## [0.2.0](https://github.com/motiko/hmw-ext/compare/hmw-ext-v0.1.0...hmw-ext-v0.2.0) (2026-10-28)


### Features

* background generation pipeline and credential source ([c56d314](https://github.com/motiko/hmw-ext/commit/c56d31482dd4a978a42ca2c0a6ed988faf15c3a6))
* Gmail site adapter ([a6d3e59](https://github.com/motiko/hmw-ext/commit/a6d3e5913cab400ae2dd4b47b7d7c5924e39c4fd))
* Help me write card and Gmail content script ([570d4a2](https://github.com/motiko/hmw-ext/commit/570d4a26354169f2e91b251ae3e2975d2170ad16))
* language detection and prompt builder ([adb760d](https://github.com/motiko/hmw-ext/commit/adb760d9fb9a0b2cbcc09f47868ee314de7050bf))
* OpenAI-compatible and Anthropic streaming providers ([fbf4ede](https://github.com/motiko/hmw-ext/commit/fbf4edeb88c044677d01f82672623256e82e0c55))
* options page ([6acab53](https://github.com/motiko/hmw-ext/commit/6acab53378a7b100ca54eba8c5e130a69b3a90cc))
* **prompt:** write complete replies that mirror the thread's greeting and sign-off ([d28bdf9](https://github.com/motiko/hmw-ext/commit/d28bdf9f52ff39bfc3f9838b1277a1607a5b1ab7))
* settings and style profile store ([76fc194](https://github.com/motiko/hmw-ext/commit/76fc19459b3247887ec3de4ffd8342540f91358e))
* SSE parser and shared message types ([e77df4a](https://github.com/motiko/hmw-ext/commit/e77df4ad513ba839fd89d2a7dbd468ea7e7efd62))


### Bug Fixes

* decode SSE with TextDecoder for TS DOM typings ([225e0f3](https://github.com/motiko/hmw-ext/commit/225e0f31d88481be214987bdc1c5bfd23a0b22a8))
* default to model temperature, reasoning-safe test call, keep Azure query string ([db3b1cc](https://github.com/motiko/hmw-ext/commit/db3b1ccafa6ab3cbda1aec8d77ef36ba8ad177b2))
* detect languages with Chrome's built-in detector instead of franc-min ([6a6bc5e](https://github.com/motiko/hmw-ext/commit/6a6bc5e59a59fe5903dc2eeccfe8450b67aa04cf))
* **gmail:** find the toolbar in real compose dialogs ([c1f0b06](https://github.com/motiko/hmw-ext/commit/c1f0b069d8ed829e2e20f6e561a9929a83e21be1))
* keep inserted text out of Gmail's signature prefix ([3115d5d](https://github.com/motiko/hmw-ext/commit/3115d5dc1d0570e0b6e52d6a31d62c71fec28098))
* keep the service worker alive during long generations ([b14b075](https://github.com/motiko/hmw-ext/commit/b14b075823ccef3f47befe8a1f8e1699f336a65a))
* only treat Gmail quote blockquotes as quoted history ([b7f6d46](https://github.com/motiko/hmw-ext/commit/b7f6d46ac4a3822eb275b6c5cc488039f5515ed8))
* read thread context only from the composer's visible conversation view ([c0840d9](https://github.com/motiko/hmw-ext/commit/c0840d9d1ec211d230c1d6937125d5b519172189))
* recover cleanly when the extension is updated while Gmail is open ([dc5b0f3](https://github.com/motiko/hmw-ext/commit/dc5b0f3416cb6b49ae5803cf3a27c1d429ca118e))
* report empty completions and early failures as errors ([aa0355d](https://github.com/motiko/hmw-ext/commit/aa0355d2b89b10d54f5c8c1051db45193b197b5c))
