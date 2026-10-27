# Publishing to the Chrome Web Store

`.github/workflows/release.yml` publishes automatically once the setup below is done. When release-please creates a release, the workflow runs `wxt submit` against Chrome Web Store API v2 using a Google Cloud service account. If the Chrome secrets are missing, it skips the store and only attaches the zip to the GitHub release.

## 1. Developer account and first upload (manual, once)

1. Register at <https://chrome.google.com/webstore/devconsole>. There is a one-time $5 fee, and the account needs 2-step verification.
2. Build the zip with `pnpm zip`. It is written to `.output/hmw-ext-<version>-chrome.zip`.
3. In the dashboard, choose **New item** and upload the zip. The API can only update an extension that already exists, so the first upload has to be manual.
4. Fill in the listing. The copy is in [store-listing.md](store-listing.md).
   - **Privacy tab:** single purpose, a justification for each permission (`storage` and the optional host permissions), the data-use disclosures, and the privacy policy URL: `https://github.com/motiko/hmw-ext/blob/main/docs/privacy.md`.
   - **Store listing:** at least one 1280×800 screenshot and the 128 px icon (`public/icon/128.png`).
5. Submit it for review once. Note the **extension ID**, the 32-character ID in the item URL.
6. Note the **publisher ID**. It is in the dashboard URL: `.../devconsole/<publisher-id>/...`.

## 2. Service account (Google Cloud)

1. Create or select a project at <https://console.cloud.google.com>.
2. Under **APIs & Services → Library**, find "Chrome Web Store API" and choose **Enable**.
3. Under **IAM & Admin → Service accounts**, create a service account. It needs no roles.
4. On the service account, open **Keys → Add key → JSON** and download the key file.
5. In the Chrome Web Store dashboard, open **Account**, add the service account's email, and save. A publisher can have only one service account.

## 3. GitHub secrets

The private key goes in through stdin so its line breaks are kept:

```zsh
gh secret set CHROME_EXTENSION_ID --body 'your32charextensionid'
gh secret set CHROME_PUBLISHER_ID --body 'your-publisher-id'
jq -r .client_email ~/Downloads/key.json | gh secret set CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL
jq -r .private_key  ~/Downloads/key.json | gh secret set CHROME_SERVICE_ACCOUNT_PRIVATE_KEY
rm ~/Downloads/key.json
```

These names are the ones `publish-browser-extension` (the tool behind `wxt submit`) reads.

## 4. Let release-please open PRs

Under **Settings → Actions → General → Workflow permissions**, enable **Allow GitHub Actions to create and approve pull requests**.

## 5. Releasing

1. Use conventional commit messages on `main` (`feat:`, `fix:`).
2. release-please opens a release PR.
3. Merging that PR tags the version, attaches the zip to the GitHub release, and submits it to the store.
4. Chrome reviews every version, usually within a few days.

## Edge Add-ons (optional)

1. Register in Partner Center and upload the same zip by hand once.
2. Under **Publish API**, create the API credentials.
3. Set the secrets `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID` and `EDGE_API_KEY`.

## References

- <https://developer.chrome.com/docs/webstore/service-accounts>
- <https://github.com/aklinker1/publish-browser-extension>
