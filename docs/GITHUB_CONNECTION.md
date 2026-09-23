# GitHub connection

Updated 2026-09-14. The marketplace has **no separate account or login**. DSH host authentication still applies. GitHub credentials are optional for public source reads; contributing an Issue or PR uses GitHub itself, and saving a read token does not publish anything.

## Configure locally

Open **Marketplace → Settings → GitHub connection**, enter a token with only the public read access needed for these sources, and choose **Save and verify**. The UI is available in Chinese, English and Japanese. Repository write, administration and publishing permissions are not required.

Saving first validates through GitHub's `/rate_limit` endpoint. A failed replacement preserves the previous credential. **Check connection** refreshes the displayed core quota and reset time; search has its own limits. **Remove token** deletes this local copy and resumes anonymous reads. Revoke it separately in GitHub if required. The settings API returns status and quota, never the token.

After a quota-related failure, manually synchronize the affected source or wait for its retry. Discovery sources normally check every six hours and retry after thirty minutes; pausing automatic checks does not erase their cache. A source's incomplete scan is not accepted as a replacement.

## Storage and request scope

An installed package stores Windows CurrentUser DPAPI ciphertext at `DSH_HOME/community/private/github-token.dpapi` (under the host's default user directory if `DSH_HOME` is not set). The development launcher and normal verification explicitly use `artifacts/private/github-token.dpapi`; standalone package acceptance uses a fresh isolated path. No credential is stored in the installed package.

`DSH_MARKET_GITHUB_TOKEN_FILE` can select another ciphertext file. Set only a path, never a token, in this variable. The launcher forwards that path while excluding model credentials. Encryption receives token bytes through stdin, not command arguments. The token is not returned to browser state, public API responses or application logs. Ciphertext is tied to the Windows account/machine; non-Windows encrypted persistence is not implemented. Same-account extensions are not isolated by DPAPI.

`sources/github-auth.mjs` adds authorization only to **GET requests at `https://api.github.com`**, with redirects rejected. Skill tree/blob reads, reviewed community index reads, author-document API reads and repository Stars can use it. Raw content hosts, npm package/download statistics, and MCP Registry receive no GitHub token. MCP connection credentials are a separate, explicitly configured resource flow; this token is not migrated into them.

## Community synchronization and author opt-out

The community source resolves this repository's `main` commit, reads and validates the generated six-type `catalog/registry.json`, and admits only its reviewed entries. A token does not bypass review or complete missing package, Skill, MCP or Slash metadata. Generic exports remain proposals. See the [catalog guide](../catalog/README.md).

Verified removal policies arrive through the same index and apply globally to stable identities and aliases. The last successful policy survives network failure and restart; removing a local token does not clear it. Settings shows known removal decisions, and resource details link the [author opt-out form](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml). Existing personal copies and installations are retained.

As of 2026-09-14, the candidate is unpublished and the first public remote index synchronization is still pending. The implemented reader is not proof of a successful public merge-to-client delivery.

## Verification and CI

`npm run verify` covers exact-domain routing, DPAPI persistence/restart reads, rejected replacements, safe response fields and same-origin writes. Real-host settings tests use synthetic credentials with intercepted validation responses; they do not replace the user's stored token. Live source tests may use the locally configured read credential and require actual network quota.

The [Windows CI workflow](../.github/workflows/verify.yml) uses the job's ephemeral `github.token` with `contents: read`, encrypts it into the ignored test path with DPAPI, and runs the same `npm run verify` gate. It is not a personal publishing credential and is not included in packages. CI is configured but has not run online at this documentation checkpoint.

An actual successful token check establishes live authentication at that time; a synthetic UI test, encrypted file or workflow definition alone does not. Translation uses the separately selected DSH model and may consume paid tokens; GitHub configuration does not grant model access.
