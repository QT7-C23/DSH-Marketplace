# DSH Marketplace

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

A community-built marketplace for plugins, Skills, MCP servers, Slash commands, Prompts, and Themes inside DeepSeek Harness.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Status: In development](https://img.shields.io/badge/status-in%20development-orange.svg)](#project-status)

Discover resources, read their original documentation, and keep the versions you choose. The goal remains a complete installation and management workflow inside DSH.

![DSH Marketplace](docs/images/marketplace.png)

*Actual development screenshot. The plugin interface supports Chinese, English and Japanese; resource content retains its original language.*

## Project status

**This is a local development version, independently maintained and not an official DeepSeek product.**

| Area | Available now | Still to build |
|---|---|---|
| Browse | Six type filters, use-case filters, search, overview and original README/SKILL.md | Broader catalogs |
| Extension management | Exact npm previews, version/protocol checks, official CLI install/update/remove, native and standard states | Per-component enable/disable, automatic recovery, broader validation |
| Sources | Anthropic Skill directory discovery every 6 hours; pause/resume, scan reports and failure recovery | Discovery across more sources and custom sources |
| Downloads | Verified Skill ZIPs, plugin TGZs, MCP definitions, Prompt text | Skill loading, MCP connections and general Slash execution |
| Prompt use | Preview and append to a real DSH draft, preserving text, references and attachments | Broader host/version validation |
| Contribution | Author/license forms for all six types, GitHub submission files; no market accounts | Automatic ingestion of reviewed community contributions |
| Personal library | Local favorites, drafts and personal ratings; local download counts and repository Stars | Public community-wide metrics |

The catalog contains **30 real resources: 4 plugins, 12 Skills, 3 MCP servers, 3 Slash commands and 8 Prompts**, plus two labeled examples. The Anthropic scan found 19 Skill directories and admitted 12 under the current license and file limits. Other adapters still update selected entries.

The four plugin entries are official DSH modules, some already composed by the host or its presets; they are not four standalone community bundles. The market now has a standalone development TGZ verified through official CLI installation, real host operation and removal. It is not published to npm or GitHub Releases. See the [package installation guide](docs/PACKAGE_INSTALLATION.md).

Themes now have a category and submission flow, but no reviewed entries or automatic discovery/application yet. Native DSH extensions and optional dsh-std components have distinct requirements; the first management layer now reads both runtimes and checks the pinned dsh-std adapter. See [compatibility and themes](docs/COMPATIBILITY_AND_THEMES.md) and the [installation and recovery guide](docs/EXTENSION_MANAGEMENT.md).

## Quick start

For a standalone package, run `npm run package` after installing the development dependencies. The TGZ is written to `artifacts/releases/`; install it with the official CLI as described in the [package guide](docs/PACKAGE_INSTALLATION.md). `npm run verify:package` checks installation, UI, removal and retained data. The source-development workflow remains below.

Requires **Node.js 24+**, npm, pnpm on PATH for installation, network access and Microsoft Edge on Windows. Tested with **DSH 0.1.5-rc.2**; other host versions and platforms remain unverified.

```powershell
npm ci
npm ci --prefix integration --ignore-scripts
node integration/build.mjs
node integration/host.mjs web --dump-config
node integration/set-plugin.mjs on
node integration/host.mjs web --port 4180 --no-open
```

Open the private local authentication URL in `artifacts/dsh-integration/runtime/url.txt`. Choose **继续** (Continue) and **稍后配置** (Configure later), then open **扩展市场** in the sidebar. The plugin’s **设置** page offers English and Japanese. No model key is needed to browse. Stop the host with `Ctrl+C`.

To use a Prompt, add `artifacts/dsh-integration/runtime/workspace`, create a conversation, select a resource, preview and append it. Sending remains your choice. Detailed setup: [host guide](integration/README.md). The launcher isolates configuration and data; it is not an operating-system sandbox.

## Data and resource behavior

- There is no separate market registration or login. DSH’s host authentication still applies.
- Favorites, attribution drafts, personal ratings and interface language stay in this browser/site. Clearing site data removes them; a different port has a different storage scope. Old account tables are preserved without being exposed or migrated into public content.
- Download counts describe files prepared by this local service, with retries deduplicated. **Stars belong to the whole GitHub source repository.** Favorites and ratings are personal, not public community totals.
- Author documents retain original content, source links and commit information. Missing documentation and network errors are distinct; repository-head documentation is labeled when it may differ from the resource version.
- READMEs prefer the interface language, then English. Open **Translate document**, select a configured DSH provider, model and target language, then explicitly start translation. This uses your model's token quota; failures and cancellations may also be billed. Originals stay available, translations are labeled, and provider-reported usage is shown. Each request accepts up to 24,000 characters, with no automatic splitting or retries.
- Queries contact supported GitHub, npm and MCP Registry endpoints. Downloads do not install, enable or execute resources.
- Keep `artifacts/`, databases, credentials and local authentication URLs out of public commits and reports.

## Development and roadmap

Run `npm run verify` for static/catalog checks, behavioral tests, types, build and real DSH browser workflows. Translation acceptance uses an isolated test adapter through the host model service, without paid credentials. Live source tests need network access and available GitHub quota. Configure an optional token in **Settings → GitHub connection**: Windows encrypts it locally, and only GitHub API reads use it. See [connection and storage details](docs/GITHUB_CONNECTION.md) and the [UI and host-state verification record](docs/research/2026-09-14-market-information-and-official-installation.md). GitHub Actions is not configured; local verification is not an online CI result.

Next work covers network reliability, public release preparation, broader community-component and host-version validation, resource-specific use, recovery and additional discovery adapters. Models, local model downloads and Cookbook remain deferred.

| Directory | Responsibility |
|---|---|
| `integration/` | DSH host, React UI, launcher and browser tests |
| `community/` | Public catalog API, SQLite download counts and contracts |
| `sources/` / `catalog/` | Discovery, packages, author documents, categories and Prompt contributions |
| `languages/` | Shared Chinese, English and Japanese interface/error messages |
| `prototype/` / `server/` | Historical standalone interaction prototype |
| `tests/` / `scripts/` / `docs/` | Verification and project documentation |

[Architecture](docs/ARCHITECTURE.md) · [Sources](sources/README.md) · [Product plan](docs/PRODUCT_PLAN.md)

## Contributing

Follow [CONTRIBUTING.md](CONTRIBUTING.md), [Repository Guidelines](AGENTS.md) and the Issue/PR templates. Keep all three READMEs and language files aligned; include behavior changes, verification and screenshots for UI changes.

All six types use an attribution form and export a JSON proposal. Submit Prompts through a PR to `catalog/prompts/` using the [format guide](catalog/README.md); attach other resource proposals to the [resource submission Issue](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=03-resource-submission.yml). Include author, source, license, requirements and actual testing. Exporting does not upload or publish; reviewed contributions are not yet synchronized automatically.

## License, attribution, and disclaimer

Original project code and documentation are licensed under the **[MIT License](LICENSE)**. Copyright © 2026 QT7-C23 and contributors. Preserve the copyright and permission notices when redistributing covered material.

Third-party content and dependencies retain their own licenses and notices; the root MIT license does not relicense them. See **[Third-party notices](THIRD_PARTY_NOTICES.md)** for DeepSeek Harness, Anthropic Skills, Prompt authors, and principal dependencies. Names, logos, and trademarks belong to their respective owners. No affiliation, sponsorship, endorsement, or trademark license is implied.

**The software is provided “AS IS”, without warranty.** Listings, integrity checks, and tests do not guarantee safety, accuracy, compatibility, availability, or suitability. Review third-party content, permissions, and AI output before use. Warranty exclusions and liability limitations are governed by applicable licenses and law; this documentation adds no restriction to MIT permissions. Read the **[English / Chinese / Japanese disclaimer](DISCLAIMER.md)**.

**Resource removal requests.** If you are the author, maintainer, or rights holder of a resource and would prefer it not to appear in this marketplace, please complete the [removal request form](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml) with its name, URL, and a brief explanation of your relationship to it. We will remove the listing after verification.
