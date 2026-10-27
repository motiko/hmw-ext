# Gmail DOM fixtures

Unit and e2e tests run against HTML snapshots in `tests/fixtures/gmail/`. They are hand-built to match the structure of Gmail's DOM (the class names and attributes listed in `src/sites/gmail/selectors.ts`). Real Gmail markup is much bigger but uses the same hooks.

When Gmail changes its markup and the button stops showing up:

1. Open the affected view in Gmail (a thread with an inline reply open, or a new compose window).
2. In DevTools, run `copy(document.documentElement.outerHTML)` and paste the result into a scratch file.
3. Find the new structure for each entry in `selectors.ts` and update the selectors.
4. Update the fixture that covers that view so it matches the new structure. Copy only the elements the selectors need. **Remove personal data** (names, addresses, message text) before you commit.
5. Run `pnpm test && pnpm build && pnpm test:e2e`.
