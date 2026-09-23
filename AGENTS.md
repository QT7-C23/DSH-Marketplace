# Repository Guidelines

## Structure and boundaries

This is the independent DSH Marketplace repository at `D:\Project\DSH`. `integration/` owns the pinned DSH host, React UI, native resource adapters, package builder and host acceptance. `community/` owns HTTP contracts, local SQLite counts and external metrics. `sources/` owns discovery, caches, identities, removals and verified downloads. `catalog/prompts/` and `catalog/resource-entries.json` are reviewed catalog inputs. `languages/` contains shared Chinese, English and Japanese messages. `prototype/` and `server/` retain the historical standalone prototype.

Keep public usage, architecture and contributor documentation in `docs/`. Planning drafts and dated investigations stay local in ignored paths, including `docs/research/` and `.superpowers/`. Keep credentials, databases and runtime evidence in ignored `artifacts/`; public illustrations belong in `docs/images/`.

## Development and verification

Use Node.js 24+ and run from the repository root:

- `npm ci` and `npm ci --prefix integration --ignore-scripts`: install locked dependencies.
- `npm run verify`: the single gate for static/catalog checks, behavioral tests, types, build and host acceptance.
- `npm run package`: build the standalone TGZ under `artifacts/releases/`.
- `npm run verify:package`: check official installation, real UI, removal and retained data.
- `npm start`, `npm test`, `npm run test:browser`: historical prototype server and tests.
- `npm run tokens`: regenerate prototype CSS after token changes.

Host setup is in `integration/README.md`. Windows acceptance uses Microsoft Edge and pnpm; live sources require network access. CI in `.github/workflows/verify.yml` uses Windows 2025, Node 24.16.0 and pnpm 12.3.4. The workflow and `.githooks/pre-commit` run the identical gate. Activate the local hook with `git config core.hooksPath .githooks`; configuration alone does not prove CI success or hook activation.

## Style and tests

Use UTF-8, two spaces, ES modules and camelCase: `.mjs` JavaScript, `.ts` contracts/controllers, `.tsx` React. Keep UI, HTTP, persistence and host ports separate. No formatter is configured. Never edit generated CSS, `integration/plugin/client.js` or catalog indexes directly.

Use Node's test runner, `node:assert/strict`, `*.test.mjs` and Playwright. Add failing regressions before fixes; check real behavior, source integrity, ownership, interrupted operations and preserved drafts. Never log credentials. Distinguish discovered, installed, loaded and successfully used states.

## Contributions

Follow `CONTRIBUTING.md` and `.github/` templates. Use the convention `type: short description` (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`). Preserve unrelated work; stage explicit files only when authorized. Report verification and limits, include UI evidence, preserve attribution, and align affected README translations. Review typed resource bindings before rebuilding indexes.
