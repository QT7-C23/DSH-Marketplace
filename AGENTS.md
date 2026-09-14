# Repository Guidelines

## Project Structure & Module Organization

`DSH` contains a marketplace and prototype within the parent checkout at `D:\Project`. `prototype/` holds browser modules, styles, samples, and tokens; `server/` serves it. `community/` owns public contracts, SQLite download counts, HTTP boundaries, and tests. `languages/` holds shared Chinese, English, and Japanese messages. `catalog/` contains GitHub Prompts; `sources/` owns external adapters, version caches, archive downloads, and tests. `integration/` contains pinned DSH dependencies, React UI, launcher, and host tests. `tests/` and `scripts/` cover verification.

Stable documentation lives in `docs/`; dated investigations belong in `docs/research/`. Runtime captures, credentials, and host databases stay in ignored `artifacts/`; reviewed public illustrations belong in `docs/images/`.

## Build, Test, and Development Commands

Use Node.js 24+ and run commands from `D:\Project\DSH`:

- `npm ci`: install locked development dependencies.
- `npm ci --prefix integration --ignore-scripts`: install pinned host dependencies.
- `npm start`: serve the prototype at `http://127.0.0.1:4173`.
- `npm run verify`: check static rules and catalog, run behavioral tests, type checks, plugin build, and host acceptance tests.
- `npm run package`: build the standalone development TGZ under `artifacts/releases/`.
- `npm run verify:package`: test official installation, real host UI, removal, and retained data.
- `npm test`: run state and HTTP tests.
- `npm run test:browser`: exercise workflows in Playwright and save screenshots.
- `npm run tokens`: regenerate CSS after editing `prototype/tokens.json`.

Windows tests use Microsoft Edge; other systems require `npx playwright install chromium` and remain unverified for host integration. Source acceptance needs live GitHub and npm access. Host startup is documented in `integration/README.md`. Parent CI and commit hooks are not connected; they must invoke the same verification command.

## Coding Style & Naming Conventions

Use UTF-8, two-space indentation, ES modules, and camelCase names. Use `.mjs` for JavaScript, `.ts` for typed controllers, and `.tsx` for React UI. Keep UI, HTTP, persistence, and host adapters separate. Host UI consumes DSH theme tokens; never edit generated CSS or `integration/plugin/client.js` directly.

No formatter is configured. Verification checks whitespace, syntax, tokens, contrast, imports, and host versions. Avoid speculative abstractions and unrelated refactoring.

## Testing Guidelines

Use Node's test runner, `node:assert/strict`, and Playwright; name tests `*.test.mjs`. Add failing regression tests before fixes. Verify attribution, reviewed versions, preserved drafts, interrupted requests, archive integrity, and actual workflows. Host tests exclude model credentials; live GitHub reads may use the configured local encrypted token. Never log it. No coverage percentage is established.

## Commit & Pull Request Guidelines

Parent history uses `feat:` and `fix:` prefixes. Use `type: short description` for commits and PR titles; documented types also include `docs`, `test`, `refactor`, and `chore`. Follow `CONTRIBUTING.md` and the templates in `.github/`. Keep commits focused and stage explicit DSH files only.

PRs should describe behavior, validation, and limitations; link issues and include UI screenshots. Preserve unrelated changes. Distinguish local file export from GitHub publication, and metadata sharing from executable resource installation.
