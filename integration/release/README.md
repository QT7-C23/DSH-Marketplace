# DSH Marketplace

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

Discover, use and manage plugins, Skills, MCP servers, Slash commands, Prompts and Themes inside DeepSeek Harness. The interface supports Chinese, English and Japanese. There is no marketplace account.

**`v0.2.0-alpha.1` — early prerelease.** Windows / Node.js 24 / DSH 0.1.5-rc.2 is the tested baseline. Local verification covers the official package, real host UI and resource workflows; standard management also passed five separate host boots, including prepared marketplace removal. See [Releases](https://github.com/QT7-C23/DSH-Marketplace/releases) for archives and [Actions](https://github.com/QT7-C23/DSH-Marketplace/actions) for the actual CI result. No npm publication.

## Install and open

Requires Windows, Node.js 24+, pnpm on PATH, npm registry access for runtime dependencies, and DSH **0.1.5-rc.2**. Stop the target host and use the official CLI:

```powershell
dsh plugin --profile web add "C:\Downloads\dsh-market-integration-0.2.0-alpha.1.tgz" --ignore-scripts --registry=https://registry.npmjs.org
dsh web
```

Use the actual archive path/version; the filename above is the candidate target. This package targets the `web` profile. Open **扩展市场** in the sidebar and choose a language in **设置**. Do not also mount the source plugin in this profile. Browsing needs no model key; DSH's host authentication still applies.

## Resource workflows

- Exact npm Plugin/Theme versions are previewed and checked before official CLI install/update/remove; native entries support profile enable/disable. Protected dependencies and uncertain ownership block changes.
- Skill original files are pinned and verified, installed into DSH's native Skill service, and can be enabled, disabled, updated, removed with files retained, or restored.
- MCP uses complete pinned definitions. Connect public HTTPS Streamable HTTP or exact npm stdio, then enable/disable/remove the owned connection. Registered tools are not a health guarantee. Reconfiguration/version changes require removing the old connection and explicitly creating the new one; credentials are not automatically migrated.
- Slash calls the current session's parent command; `/plan` and `/plan off` preserved draft/references in actual checks. Prompt previews append to the draft without sending or losing attachments.
- Themes have individual limits: Opera 0.2.1 has a 1.04:1 contrast warning; Machine 0.1.3 is startup-blocked; Bloom 0.12.0 supports Mist and keyboard-opened Cinnabar selection, with mouse-open and local 404 polling issues.

Optional dsh-std components use one managed discovery loader. **First adoption can reload all standard components; that process remains unknown/restart-required and blocks further standard toggles even if a replacement adapter looks active. Fully stop and start DSH.** On a subsequent stable boot, toggles save the next boot's intent only. Refresh browser clients after restart. There is no module-cache hot swap or automatic recovery.

## Discovery, data and review

Six sources include official DSH, Anthropic/OpenAI Skills, npm, MCP Registry and this project's reviewed GitHub index. The complete runtime scan observed **35,017 merged entries on 2026-09-14**, not a permanent count or usability guarantee. The checked source seed has 4,907 records before cross-source deduplication. Its MCP release policy caps entries at 100, rather than promising 100 are bundled; the actual startup seed contains 3 MCP entries; the archive test checks its contents. Runtime MCP pagination reads the full directory. Automatic discovery checks every six hours, retries after thirty minutes, and supports pause/resume and manual sync. Incomplete scans preserve the prior cache; shutdown cancels in-flight reads.

Generic JSON exports are proposals only. Maintainers complete typed bindings, build/verify the index and merge into `main` before clients can sync them. Verified author opt-outs apply across stable identities and aliases; the last successful policy survives failures/restarts. Resource details link the request form and Settings shows decisions; personal copies remain.

GitHub Stars describe whole repositories; npm `last-month` counts describe whole packages with returned dates and freshness. Local downloads count deduplicated files prepared by this service; browser favorites/ratings are personal. Operation history shows the newest 20 sanitized profile records; local logs/backups still require manual recovery, with no automatic unlock.

Optional GitHub read tokens are Windows-encrypted under `DSH_HOME/community/private/` and only accompany official GitHub API GETs. README selection prefers the current language, then English. Translation requires an explicitly selected DSH model and may charge tokens, including failed/cancelled work. No automatic translation occurs.

## Remove and rights

Stop DSH and complete the standard-management removal preparation below if applicable. Then run `dsh plugin --profile web remove dsh-market-integration` and restart. Marketplace data under `DSH_HOME/community/` and browser data are retained; GitHub credentials are not revoked. Resource installations have their own management lifecycle.

Original project code/docs use [MIT](https://github.com/QT7-C23/DSH-Marketplace/blob/main/LICENSE). Third-party content/dependencies keep their own licenses; names, logos and trademarks belong to their owners. This independent project implies no DeepSeek affiliation, sponsorship, endorsement or trademark license. Software is provided **AS IS, without warranty**. The package includes `LICENSE`, `DISCLAIMER.md`, `THIRD_PARTY_NOTICES.md` and bundled dependency notices; see the [disclaimer](https://github.com/QT7-C23/DSH-Marketplace/blob/main/DISCLAIMER.md) and [third-party notices](https://github.com/QT7-C23/DSH-Marketplace/blob/main/THIRD_PARTY_NOTICES.md).

[Usage and management](https://github.com/QT7-C23/DSH-Marketplace/blob/main/docs/EXTENSION_MANAGEMENT.md) · [Contribute](https://github.com/QT7-C23/DSH-Marketplace/blob/main/CONTRIBUTING.md) · [Author opt-out](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml)

## Standard compatibility and removal

The pinned dsh-std adapter 0.1.1-rc.3 has a known upstream limitation: after a component requiring CommandRuntime mounts, a later component can fail activation during connection negotiation. Passing producer-component tests does not certify such combinations; test the actual set before adopting it.

Before removing a marketplace that has managed standard components, stop DSH and run the packaged maintenance preview below. Use your actual absolute DSH_HOME. It restores upstream discovery; previously disabled standard components may load again. If you want them to stay absent, remove those packages through the official CLI first. Review the preview, then repeat the command with `--confirm <fingerprint>`; add `--enable-disabled` only if you accept re-enabling the listed packages. A `not-managed` result needs no confirmation. Only after a successful preparation, run the official removal command. This preserves unrelated settings and records a backup. See the installation guide for details.

```powershell
node "<DSH_HOME>\profiles\web\node_modules\dsh-market-integration\integration\maintenance.mjs" prepare-uninstall --home "<DSH_HOME>" --profile web
```
