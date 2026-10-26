# Store listing

## Name
Help me write: AI email drafts for Gmail

## Short description (≤132 chars)
Draft and refine Gmail emails with your own AI. Matches your language and tone. Works with OpenAI, Anthropic, Azure and Ollama.

## Description
Help me write adds a ✨ button to Gmail's compose toolbar that works like Gmail's built-in "Help me write". The difference is that it uses the AI provider you choose.

• Write a new email or a reply from a one-line instruction.
• Refine your draft: Polish, Formalize, Elaborate, Shorten, or describe any change you want.
• Replies follow the conversation's language and context.
• Learns your tone from your own messages. That data stays in your browser.
• Inserting a draft keeps your signature and quoted history, and Ctrl+Z undoes it.
• Bring your own endpoint: OpenAI, Anthropic, Azure OpenAI, OpenRouter, LiteLLM, Ollama or anything OpenAI-compatible.
• No account, no server, no tracking. Requests go straight from your browser to your endpoint.

## Category
Productivity

## Privacy policy URL
https://github.com/motiko/hmw-ext/blob/main/docs/privacy.md

## Single purpose (CWS)
Help the user write and refine emails in Gmail with an AI model the user configures.

## Permission justifications
- storage: save the user's settings, API key and writing-style samples on the device.
- host permission mail.google.com: insert the Help me write button and read and write the compose draft.
- optional host permissions: requested at runtime only for the AI endpoint URL the user enters, so the extension can call it.

## Screenshots
Take them with `pnpm dev`, using a real Gmail account and test content. You need at least one 1280×800 screenshot: the card in create mode, refine mode and the result view.
