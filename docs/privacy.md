# Privacy Policy: Help me write

_Last updated: 2026-10-26_

Help me write is a browser extension that drafts and refines emails in Gmail using an AI service **that you configure yourself**. It has no server of its own and collects no analytics or telemetry.

## What the extension reads

The extension reads these only when you open the Help me write card in a Gmail compose window:

- the text of your current draft, or the text you selected;
- the subject, the recipients' email addresses and the messages of the conversation you are replying to. You can turn off sending previous messages in the settings.

To learn your writing style (you can turn this off), it also reads **your own** messages in conversations you open in Gmail.

## Where data goes

When you ask for a draft, the extension sends the information above, plus your instruction and your style notes and samples, **only to the AI endpoint you entered in the settings** (for example OpenAI, Anthropic, Azure OpenAI, OpenRouter, or a server you run yourself). Your use of that service is covered by its own privacy policy. Nothing is sent to the extension's developer or to anyone else.

## What is stored, and where

Everything is stored in your browser's extension storage (`chrome.storage.local`) on your device. It is not synced to other devices:

- your settings, including your API key;
- your style notes and pasted examples;
- up to 50 learned writing samples taken from your own sent messages.

## Permissions

- **storage:** saves the settings and samples listed above.
- **Access to mail.google.com:** shows the Help me write button and reads the compose window and thread.
- **Access to your AI endpoint:** requested when you save your settings, and only for the host you entered.

## Deleting your data

Open the extension's settings to delete individual learned samples or clear all of them. Uninstalling the extension removes all stored data.

## Contact

Questions: open an issue at https://github.com/motiko/hmw-ext/issues.
