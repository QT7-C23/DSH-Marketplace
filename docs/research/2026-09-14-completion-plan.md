# Marketplace completion plan

The user's required order is discovery, actual use, management and compatibility, community and statistics, then GitHub publication. This record tracks implementation; `docs/PRODUCT_PLAN.md` remains the product specification.

## Global constraints

- Preserve the independent in-DSH marketplace for Plugin, Skill, MCP, Slash, Prompt and Theme. Local model downloads and Cookbook remain deferred.
- Native DSH and dsh-std are both supported. Discovery must not execute downloaded code or silently install resources.
- Use real upstream data, explicit provenance and pinned acquisition versions. Never equate discovery, download, installation, activation and successful use.
- Preserve unrelated work, local credentials and existing data. Do not publish artifacts, tokens or host databases.
- Write failing behavioral tests before implementation and use `npm run verify` as the final gate. Report incomplete acceptance honestly.

## Task 1: Multi-source discovery

Replace fixed MCP lists with official Registry pagination; add npm community package discovery; expand Skill repository scanning; read this project's reviewed six-type GitHub index. Support automatic checks, deduplication, attributable scan reports, removals and old-cache migration. Failed or incomplete scans retain prior snapshots. Discover plugin-provided Slash and Theme only from explicit manifests or reviewed entries, never guessed README text.

Verification: deterministic newly added resources, pagination, duplicate identifiers, unsupported entries, malformed manifests, changing upstream snapshots, network failure, old-cache upgrade; live reads and real browser directory rendering.

## Task 2: Actual use

Connect selected resources to native host capabilities: Skill loading, MCP configuration and tool invocation, Slash invocation, Prompt draft insertion, and Theme application. Test with isolated host profiles and real representative resources, preserving user drafts and configuration.

## Task 3: Management and compatibility

Complete install/update/remove and enable/disable where host contracts support them, dependency checks and failure recovery. Validate native and dsh-std lifecycle state against actual host behavior and document supported versions.

## Task 4: Community and statistics

Complete GitHub submission/review/synchronization/removal flows. Clearly separate local actions, npm downloads, repository Stars and any genuinely shared community aggregates. Keep marketplace accounts removed; never fabricate public totals.

## Task 5: Verification and publication

Run the unified gate, review the release payload and notices, push to `QT7-C23/DSH-Marketplace`, and report the actual version tag and repository topics. Preserve any remote history discovered before pushing; never force-push.

## Progress

- Task 1: in progress.
- Tasks 2–5: pending, in the user's requested order.
- The remote repository was verified empty on 2026-09-14; a local `codex/marketplace-completion` branch isolates this project from its parent checkout.
