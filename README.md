# DSH Marketplace

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

Discover, use and manage **plugins, Skills, MCP servers, Slash commands, Prompts and Themes inside DeepSeek Harness**. DSH Marketplace is an independent community project with a Chinese, English and Japanese interface. No marketplace account is required.

![DSH Marketplace](docs/images/marketplace.png)

*Development screenshot; resource documents retain their original language.*

## Project status

**`v0.2.0-alpha.1` — early prerelease.** Windows / Node.js 24 / DSH 0.1.5-rc.2 is the tested baseline. Local verification covers the official package, real host UI and resource workflows; standard management also passed five separate host boots, including prepared marketplace removal. See [Releases](https://github.com/QT7-C23/DSH-Marketplace/releases) for archives and [Actions](https://github.com/QT7-C23/DSH-Marketplace/actions) for the actual CI result. No npm publication.

The supported test baseline is **Windows, Node.js 24 and DSH 0.1.5-rc.2**. Individual resource outcomes and untested host versions remain explicit.

## What you can do

| Resource | Workflow and boundaries |
|---|---|
| Plugin | Inspect an exact npm version, check declarations and compatibility, then install/update/remove through the official DSH CLI. Native entries support enable/disable through profile configuration. Protected packages and reverse dependencies constrain changes. |
| Skill | Inspect and install the original files from a fixed Git commit; load and call them through DSH's native Skill services. Enable, disable, update, remove with retained files, and restore are implemented. Modified or unowned files block replacement. |
| MCP | Read the complete pinned server definition, choose a supported connection and enter its declared parameters. Configure, enable, disable and remove HTTPS Streamable HTTP or exact-version npm stdio connections. Registered tools indicate registration, not continuing service health. |
| Slash | Execute a command provided by the current session's parent plugin. Actual `/plan` and `/plan off` calls preserved the composer draft and references. Commands retain their own effects and requirements. |
| Prompt | Preview and append original text to the current DSH draft, preserving text, references and attachments. Appending does not send the conversation. |
| Theme | Discover npm theme plugins and use the package-management path to apply or remove them. Three actual packages were tested with different outcomes; there is no universal theme-file importer. |

Standard components use the optional **dsh-std adapter** and one marketplace-managed discovery loader. First adoption can reload all standard components and is disclosed before execution. The public SDK cannot prove old-batch cleanup: that process stays **unknown/restart-required**, and further standard toggles are blocked even if the replacement adapter looks active. Fully stop and start DSH. On a subsequent stable boot, toggles save intent for the next boot only; refresh browser clients after restart. There is no module-cache hot swap or automatic recovery. See [extension management](docs/EXTENSION_MANAGEMENT.md).

Theme observations: **Galactic Opera 0.2.1** applies but has a sampled **1.04:1** contrast warning; **Machine 0.1.3** is startup-blocked; **Bloom 0.12.0** supports the default Mist palette and keyboard-opened Cinnabar selection, with a mouse-open bug and repeated local 404 polling. These are bounded results, not general compatibility endorsements. [Compatibility details](docs/COMPATIBILITY_AND_THEMES.md)

## Discovery and updates

Six sources feed one deduplicated catalog:

| Source | Observation on 2026-09-14 |
|---|---|
| Official DSH modules and commands | 4 modules and 3 commands, pinned to the host baseline |
| Anthropic Skills | 19 directories scanned; 12 admitted |
| OpenAI Skills | 39 directories scanned; 30 admitted |
| npm community extensions | 4,887 candidates scanned; 4,844 admitted, including 5 themes |
| Official MCP Registry | 31,784 unique services scanned; 30,116 admitted |
| Reviewed project GitHub index | Six resource types supported; only reviewed entries merged into `main` are eligible |

A complete runtime scan observed **35,017 merged entries**. These are dated observations under the admission rules, not a catalog-size or usability promise. Counts overlap across sources, and discovery does not certify installation or use. The four official modules may already belong to the host or a preset; they are not four independent community bundles.

The checked source starter snapshot contains **4,907 source records**, before cross-source deduplication. The release-seed policy caps MCP entries at **100**; this is a ceiling, not a claim that the current seed contains 100. Use the final archive report for its actual contents. Runtime MCP pagination reads the full supported directory.

Automatic discovery checks run every **6 hours**, with **30-minute retries** after failure. Settings provides per-source pause/resume, manual synchronization and scan/exclusion reports; the official DSH source stays pinned. A failed or incomplete page rejects that source's whole scan and preserves the last complete cache. Shutdown cancels in-flight reads. Reviewed community changes become discoverable after merge and a successful sync; clients read the reviewed index from the repository default branch.

## Quick start

For source development, use Node.js 24+, npm, pnpm on PATH for package operations, network access, and Microsoft Edge on Windows:

```powershell
npm ci
npm ci --prefix integration --ignore-scripts
node integration/build.mjs
node integration/host.mjs web --dump-config
node integration/set-plugin.mjs on
node integration/host.mjs web --port 4180 --no-open
```

Open the private authentication URL in `artifacts/dsh-integration/runtime/url.txt`. Choose **继续** (Continue), then **稍后配置** (Configure later), and open **扩展市场** in the sidebar. Change the interface language in **设置**. Browsing needs no model key. Stop the host with `Ctrl+C`.

For Prompt or Slash use, add `artifacts/dsh-integration/runtime/workspace` and create a conversation. The launcher separates development configuration and data; it is not an OS sandbox. [Host setup](integration/README.md)

To build a standalone TGZ after installing dependencies:

```powershell
npm run package
```

The intended candidate filename is `dsh-market-integration-0.2.0-alpha.1.tgz` under `artifacts/releases/`; use the actual path and checksum in `package-result.json`. Installation uses the official CLI. Follow the [package guide](docs/PACKAGE_INSTALLATION.md); check [GitHub Releases](https://github.com/QT7-C23/DSH-Marketplace/releases) for future published artifacts.

## Your data and the numbers you see

| Indicator | Meaning |
|---|---|
| GitHub Stars | The entire source repository, with freshness information |
| npm downloads | The entire package over npm's returned `last-month` date range, with dates and fresh/stale/unavailable state; not marketplace installations or one version's users |
| Local downloads | Files successfully prepared by this local SQLite-backed service; repeated request IDs are deduplicated, and file saving/installation is not inferred |
| Favorites and ratings | Personal browser/site data, not public totals or community averages |

Favorites, attribution drafts, ratings and interface language stay in browser storage; clearing site data removes them and another port has another storage scope. Server caches and operation evidence live under `DSH_HOME/community/`. The UI shows the newest 20 sanitized profile-operation records; recovery still requires inspection of local logs, backups and configuration. Old private/account tables remain retained and unexposed.

Author documents preserve provenance. README selection prefers the current interface language, then English. **Translation starts only when you choose a configured DSH model and explicitly request it; it consumes model tokens and may incur charges even on cancellation or failure.** Originals remain available. Requests are limited to 24,000 characters, with no automatic splitting or retries.

An optional [GitHub read token](docs/GITHUB_CONNECTION.md) helps API quota; Windows encrypts it locally. GitHub submission uses GitHub's own identity. Neither browsing nor local favorites requires a marketplace login.

## Contribute or request removal

Use the [contribution guide](CONTRIBUTING.md) and [six-type catalog guide](catalog/README.md). Generic UI exports are **proposals only**. Maintainers complete reviewed type-specific bindings in `catalog/resource-entries.json`; Prompts stay in `catalog/prompts/`. Run `node catalog/build.mjs` and `npm run verify`, then review and merge. Never hand-edit generated indexes. An Issue may omit executable fields for review; it cannot enter the public catalog without the required binding.

Authors, maintainers and rights holders can request opt-out through the [removal form](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml), also linked from resource details. Reviewed rules in `sources/removals.json` apply across source aliases and stable identities. The last successful policy survives failures and restarts; personal copies and existing installations are retained. Settings lists known decisions. An infringement allegation is not required.

## Development

`npm run verify` is the shared gate for static/catalog checks, behavioral tests, types, builds and host acceptance. `npm run verify:package` exercises official TGZ installation and removal. The [Windows CI workflow](.github/workflows/verify.yml) and [pre-commit hook](.githooks/pre-commit) invoke the same gate; activate the hook with `git config core.hooksPath .githooks`. Hook activation is local to each checkout; check the latest workflow run for the current CI result.

[Architecture](docs/ARCHITECTURE.md) · [Repository guidelines](AGENTS.md) · [Sources](sources/README.md) · [Resource management](docs/EXTENSION_MANAGEMENT.md)

The product runs inside DSH. Other host versions, broader third-party combinations and automatic recovery remain outside verified coverage. Local model downloads and Cookbook are deferred.

## License, attribution and disclaimer

Original project code and documentation use the **[MIT License](LICENSE)**, copyright © 2026 QT7-C23 and contributors. Preserve its copyright and permission notices. Third-party resources and dependencies retain their own licenses; the root MIT license does not relicense them. See [Third-party notices](THIRD_PARTY_NOTICES.md).

Names, logos and trademarks belong to their owners. This independently maintained project implies no affiliation, sponsorship, endorsement or trademark license from DeepSeek or any resource author. Software is provided **“AS IS”, without warranty**; listings and tests do not guarantee safety, accuracy, compatibility or availability. Applicable licenses govern warranty and liability. See the [English / Chinese / Japanese disclaimer](DISCLAIMER.md).

## Standard compatibility and removal

The pinned dsh-std adapter 0.1.1-rc.3 has a known upstream limitation: after a component requiring CommandRuntime mounts, a later component can fail activation during connection negotiation. Passing producer-component tests does not certify such combinations; test the actual set before adopting it.

Before removing a marketplace that has managed standard components, stop DSH and run the packaged maintenance preview below. Use your actual absolute DSH_HOME. It restores upstream discovery; previously disabled standard components may load again. If you want them to stay absent, remove those packages through the official CLI first. Review the preview, then repeat the command with `--confirm <fingerprint>`; add `--enable-disabled` only if you accept re-enabling the listed packages. A `not-managed` result needs no confirmation. Only after a successful preparation, run the official removal command. This preserves unrelated settings and records a backup. See the installation guide for details.

```powershell
node "<DSH_HOME>\profiles\web\node_modules\dsh-market-integration\integration\maintenance.mjs" prepare-uninstall --home "<DSH_HOME>" --profile web
```
