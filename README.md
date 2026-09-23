# DSH Marketplace

[English](README.md) · [简体中文](docs/i18n/README.zh-CN.md) · [日本語](docs/i18n/README.ja-JP.md)

Discover, use and manage **plugins, Skills, MCP servers, Slash commands, Prompts and themes inside DeepSeek Harness**. An independent community project with an English, Chinese and Japanese interface. No marketplace account required.

[Download](https://github.com/QT7-C23/DSH-Marketplace/releases) · [Documentation](docs/README.md) · [Contribute](CONTRIBUTING.md)

![DSH Marketplace](docs/images/marketplace.png)

*Development screenshot; resource documents retain their original language.*

## What it does

| Resource | Use it in DSH |
|---|---|
| Plugins | Inspect compatibility; install, update, enable, disable and remove through the supported host interfaces. |
| Skills | Install verified original files; load, update, disable and restore managed versions. |
| MCP | Configure HTTPS Streamable HTTP or exact-version npm stdio servers; enable, disable and remove connections. |
| Slash commands | Run commands provided by plugins in the current session. |
| Prompts | Preview and append to your draft, preserving text, references and attachments; never auto-send. |
| Themes | Discover and manage npm theme packages, with resource-specific compatibility information. |

Sources include the pinned DSH catalog, Anthropic Skills, OpenAI Skills, npm, MCP Registry and this project's reviewed GitHub catalog. Automatic discovery checks every six hours; incomplete refreshes preserve the previous catalog. Discovery does not guarantee that every resource can run. [Source details](sources/README.md)

Read original author documentation in the available language of your choice. Optional translation uses a model you select in DSH and consumes its tokens, including possible charges on failure or cancellation.

## Quick start

**Current prerelease: [v0.2.0-alpha.1](https://github.com/QT7-C23/DSH-Marketplace/releases/tag/v0.2.0-alpha.1).** Tested with Windows, Node.js 24 and DSH 0.1.5-rc.2. Package installation requires pnpm on PATH and npm registry access.

Download the TGZ and `SHA256SUMS.txt` from the release, verify the checksum, and stop DSH before installing:

```powershell
dsh plugin --profile web add "C:\Downloads\dsh-market-integration-0.2.0-alpha.1.tgz" --ignore-scripts --registry=https://registry.npmjs.org
dsh web
```

Open **扩展市场** in the sidebar and choose your language in Settings. Browsing needs no model key. See the [installation guide](docs/PACKAGE_INSTALLATION.md) for updates and removal, or [development setup](integration/README.md) to run from source. The marketplace is not published to npm.

## Before you use it

- **Compatibility:** native DSH resources and supported dsh-std components are handled separately. Standard component changes require a full restart; the pinned adapter has a known CommandRuntime combination issue. [Compatibility and themes](docs/COMPATIBILITY_AND_THEMES.md)
- **Management:** MCP version/configuration changes require removal and reconnection. Before uninstalling a marketplace that has managed standard components, follow the [removal preparation](docs/PACKAGE_INSTALLATION.md#标准组件卸载准备).
- **GitHub connection:** an optional read token helps API quota. Windows credential initialization can take about a minute on first use. [Connection guide](docs/GITHUB_CONNECTION.md)
- **Statistics and data:** Stars belong to the source repository, npm downloads to the package, and local download counts to prepared files. Favorites and ratings are personal browser data; clearing site data removes them.

This is an early prerelease. Other host versions and all third-party combinations are not certified; automatic recovery and local model downloads are outside the current scope.

## Contribute

Use the [contribution guide](CONTRIBUTING.md) to report bugs or propose resources through GitHub review. Authors and rights holders can request opt-out through the [removal form](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml), without alleging infringement. Existing private copies and installations are retained.

Developers: [setup and verification](integration/README.md) · [architecture](docs/ARCHITECTURE.md) · [repository guidelines](AGENTS.md) · [CI](https://github.com/QT7-C23/DSH-Marketplace/actions). The shared verification command is `npm run verify`.

## License

Original code and documentation are **[MIT](LICENSE)**, © 2026 QT7-C23 and contributors. Third-party content retains its own licenses and attribution; see [third-party notices](THIRD_PARTY_NOTICES.md).

Independently maintained, with no implied DeepSeek affiliation or endorsement. Names and trademarks belong to their owners. Provided **as is, without warranty**; see the [English / Chinese / Japanese disclaimer](DISCLAIMER.md).
