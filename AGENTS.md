# Repository Guidelines

## Structure and boundaries

`src/plugin/` contains the DSH entrypoint, React market and resource adapters. `src/community/` owns HTTP contracts and metrics; `src/sources/` owns discovery, identities and downloads; `src/languages/` contains Chinese, English and Japanese messages. `src/prototype/` and `src/server/` retain the historical prototype and shared helpers.

`catalog/` holds reviewed resources, Prompt originals, removal policies and the startup source snapshot. `tests/` groups behavioral suites, fixtures and helpers. `scripts/host/` owns the pinned host, builder and acceptance runners; `scripts/release/` contains packaged installation READMEs. Public images belong in `assets/`; third-party licenses in `licenses/`.

Keep root READMEs focused on usage. Development setup belongs in `scripts/README.md`. `docs/`, `.superpowers/` and `artifacts/` are local-only: do not publish planning records, credentials, databases or runtime evidence. Preserve upstream attribution and original license bytes.

## Development and verification

Use Node.js 24+ from the repository root:

- `npm ci --ignore-scripts`: install the single locked dependency set.
- `npm run verify`: the common gate for repository layout, public links, static/catalog checks, behavioral tests, types, build and host acceptance.
- `npm run package`: build a standalone TGZ under `artifacts/releases/`.
- `npm run verify:package`: verify official installation, real UI, removal and retained data.
- `npm start`, `npm test`, `npm run test:browser`: run the historical prototype or focused tests.
- `npm run tokens`: regenerate prototype CSS after token changes.

Actual host acceptance uses Windows, Microsoft Edge and pnpm. Live sources need network access. `.github/workflows/verify.yml` and `.github/hooks/pre-commit` run the identical gate; activate the local hook with `git config core.hooksPath .github/hooks`. Check actual results before claiming success.

## Style and testing

Use UTF-8, two spaces, ES modules and camelCase: `.mjs`, `.ts` contracts/controllers and `.tsx` React. Keep UI, HTTP, persistence and host ports separate. No formatter is configured. Do not hand-edit generated CSS, `src/plugin/client.js` or catalog indexes.

Use Node's test runner, `node:assert/strict`, `*.test.mjs` under `tests/`, and Playwright. Start fixes with failing regressions. Test real behavior, ownership, interrupted operations, preserved drafts and file integrity. Never log credentials. Distinguish discovered, installed, loaded and successfully used states.

## Contributions

Follow `CONTRIBUTING.md` and `.github/` templates. Use `type: short description` (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`). Preserve unrelated work and stage explicit files only. Report verification and limits, include UI evidence where relevant, align affected README translations, and review typed resource bindings before regenerating indexes.
