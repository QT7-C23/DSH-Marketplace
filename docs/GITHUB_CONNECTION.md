# GitHub connection

## Configure locally

Open **Marketplace → Settings → GitHub connection**, enter a new personal access token, and select **Save and verify**. The UI supports Chinese, English and Japanese. Prefer a fine-grained token with public repository read access and an expiry; this marketplace does not need repository write, administration or publishing permissions.

Saving first checks GitHub's `/rate_limit` endpoint. A failed replacement leaves the previous credential in place. **Check connection** refreshes the displayed core quota and reset time; search endpoints have separate limits. **Remove token** deletes the local copy and resumes anonymous access; revoke the token separately in GitHub settings if required. No token is returned by the settings API.

## Storage and requests

An installed marketplace stores Windows CurrentUser DPAPI ciphertext under the DSH user directory at `community/private/github-token.dpapi` (normally `~/.dsh/`, or the configured `DSH_HOME`). The development launcher and normal verification command explicitly select `artifacts/private/github-token.dpapi`, preserving the checkout's existing shared development setting. Standalone installation acceptance uses a fresh isolated credential path. No token is written into the installed package. Ciphertext is not portable to another Windows account or machine. Non-Windows encrypted persistence is not implemented.

`DSH_MARKET_GITHUB_TOKEN_FILE` can explicitly select another ciphertext file; set only the path, never the token, in this variable. The development launcher forwards that path while continuing to exclude model credentials. The token is passed to the encryption helper through stdin, never command arguments. Browser storage, public API responses and application logs must not contain it. Windows account encryption protects the stored file; it does not isolate extensions running as that same account.

Source adapters, author documentation and repository Star queries use `sources/github-auth.mjs`. Authorization is added only to GET requests at `https://api.github.com`; redirects are rejected. Raw content, npm and MCP Registry requests receive no GitHub credential. Configuring a token does not add discovery sources or install resources. After configuration, use **Update catalog** to retry an earlier source failure.

## Verification

Run `npm run verify`. Authentication tests cover exact-domain routing, encrypted persistence and restart reads, rejected replacements, public response fields and same-origin writes. Real-host UI tests use synthetic credentials with intercepted validation responses; they do not replace the user's saved token. Live source tests may use the locally configured GitHub token but never paid model credentials. Live authentication is confirmed only when an actual token check succeeds.
