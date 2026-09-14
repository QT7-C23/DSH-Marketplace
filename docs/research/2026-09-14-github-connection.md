# GitHub connection implementation and verification

## Delivered

- Chinese, English and Japanese connection settings inside the actual DSH market.
- Validate before saving; replace, check quota and remove the local credential.
- Windows CurrentUser DPAPI ciphertext, shared by this checkout's development and verification profiles. No plaintext token in browser storage, read responses or encryption command arguments.
- One authenticated GitHub GET boundary used by source adapters, documentation and Star queries; no credential on raw content, npm or MCP requests; redirects rejected.
- The browser suite retains individual assertion deadlines; its process budget is 180 seconds so a slow failing network run can finish reporting every test.

The configuration procedure and storage boundaries are in [GitHub connection](../GITHUB_CONNECTION.md). No repository publication or real token creation was performed by the implementation.

## Evidence

`artifacts/github-auth/verify-final.log` records the full `npm run verify` run. Static checks, behavioral groups, all 8 authentication tests, type checks, build and the real native/standard compatibility experiment passed. The DSH browser suite completed: **19 passed, 4 failed**. The new settings test passed against the actual host with intercepted synthetic validation; it does not prove authentication with a user's real token.

The separate settings run is in `artifacts/github-auth/browser.log`; its screenshot is `artifacts/github-auth/settings.png`. Compatibility evidence is in `artifacts/dsh-integration/compatibility-e0magA/`.

At the final local check no credential file had been saved. A live anonymous quota check reported **0 / 60 remaining**, resetting at `2026-09-14T05:16:16Z`; this is a dated observation, not a permanent limit state.

| Failing acceptance | Observed result | Follow-up |
|---|---|---|
| Resource archives | HTTP 502, upstream fetch failed | Retry with configured authentication; inspect raw-content connectivity separately if it persists |
| Automatic Skill checks | GitHub HTTP 403 | Retry after authenticated quota is available |
| Author documents | Playwright could not read the failed response body | Recheck upstream result and response-body handling separately |
| Translation cancellation | Original README did not appear within its deadline | Recheck original-document loading before attributing this to cancellation |

Full verification is **not green**. These failures also appeared before this connection implementation. The quota result explains the source 403; the other failures have not been proven to share that cause. A real token must be entered locally and validated before authenticated acceptance can be claimed.
