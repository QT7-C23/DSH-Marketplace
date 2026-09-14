# DSH Marketplace

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

A community marketplace inside DeepSeek Harness for plugins, Skills, MCP, Slash commands, Prompts and Themes. This is a development package, with internal package name `dsh-market-integration`; it has not been published to npm.

## Install and open

Requires Windows, Node.js 24+, pnpm on PATH, npm registry access for runtime dependencies, and DSH **0.1.5-rc.2**. Stop the target DSH host, then run the official CLI:

```powershell
dsh plugin --profile web add "C:\Downloads\dsh-market-integration-0.1.0.tgz" --ignore-scripts --registry=https://registry.npmjs.org
dsh web
```

Replace the archive path with your downloaded file. The package targets the `web` profile. Open **扩展市场** in the sidebar; choose your language in **设置**. Do not also mount the development source plugin in this profile.

## What works

Browse six resource categories, read author documentation, save favorites and drafts, export community submissions, and append Prompts to a DSH draft. Reviewed npm extension operations use the official CLI and require restart. Standard components additionally need the optional dsh-std adapter. Skill loading, MCP connection setup, general Slash execution and theme application are still being built.

GitHub connection settings accept an optional read token. Windows encrypts it under `DSH_HOME/community/private/`; only GitHub API GET requests use it. Model translation uses a model you configure in DSH and explicitly select; it may consume paid tokens.

## Remove and data

Stop DSH, run `dsh plugin --profile web remove dsh-market-integration`, then restart. Marketplace server data remains under `DSH_HOME/community/`; browser favorites and drafts remain in site storage. Removal does not revoke a GitHub token.

## Rights and support

Original project code is MIT licensed. Third-party resources, dependencies and branding retain their own licenses and rights. This project is independent of DeepSeek and comes without warranty. The package includes `LICENSE`, `DISCLAIMER.md`, `THIRD_PARTY_NOTICES.md`, and licenses for bundled frontend dependencies.

For bugs, attribution corrections, or requests to remove your resource, use the [project issue tracker](https://github.com/QT7-C23/DSH-Marketplace/issues). Source and development documentation: [DSH-Marketplace](https://github.com/QT7-C23/DSH-Marketplace).
