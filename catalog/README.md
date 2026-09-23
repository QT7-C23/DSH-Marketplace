# Reviewed resource catalog / 审核资源目录 / 審査済みカタログ

[English](#english) · [简体中文](#简体中文) · [日本語](#日本語) · [Binding examples / 绑定示例 / 記入例](#binding-examples)

## English

This directory supplies the project's reviewed six-type GitHub index. It is distinct from live npm, Skill and MCP discovery. The UI's generic export deliberately produces a **proposal**, not a ready-to-install registry entry. It does not retain `packageRef`, `bundle`, `serverDefinition`, `parentId` or `command`. An Issue can be reviewed without those fields; public admission requires them where applicable.

Maintainer workflow:

1. Review original author, permission, source/version, requirements and the last actually tested step using [CONTRIBUTING.md](../CONTRIBUTING.md). Link the Issue/PR and explain adaptations.
2. Put each Prompt in `catalog/prompts/<id>.json` using [PROMPT_TEMPLATE.json](PROMPT_TEMPLATE.json). Add other reviewed types to the array in `catalog/resource-entries.json`.
3. Complete the bindings below from actual upstream metadata. Never invent hashes, fixed versions, license claims or parent identities.
4. Run `node catalog/build.mjs`, then `npm run verify`. Review and commit inputs plus generated `catalog/index.json` and `catalog/registry.json` together. Neither index is hand-editable.
5. Merge to `main`. The community adapter reads `catalog/registry.json` at the resolved 40-character commit, validates its Git blob and all entries, and syncs it automatically every six hours or on manual request. Any invalid index/page fails the scan as a whole. First public remote synchronization remains pending publication as of 2026-09-14.

All submissions use schema 1; lower-case hyphenated IDs, the original author's GitHub name, language `zh|en|ja|other`, and the actual license from `CC0-1.0|MIT|CC-BY-4.0|Apache-2.0`. These are current parser limits, not a right to relicense material. Unknown or unsupported cases stay proposals. Non-Prompt public IDs become `source-community-<id>`; Prompt IDs become `github-<id>`.

Updates retain the stable resource identity, use a newly reviewed version/commit and rebuild both indexes. Client revisions reflect content changes; existing favorites and installed copies are not silently replaced.

For verified opt-outs, edit `catalog/removals.json`, then rebuild and merge. Each rule needs a resource ID, reason and a real project Issue URL. Bind stable identities while the entry is available, or supply explicit identities as shown below. Rules cover all source aliases, preserve the last successful policy after failure/restart and hide dependent Slash entries when their parent is withdrawn. Do not erase user installations or personal copies.

## 简体中文

本目录生成本项目审核后的六类 GitHub 索引，与 npm、Skill、MCP 的实时发现来源分开。界面通用导出有意只生成**提案**，不保留 `packageRef`、`bundle`、`serverDefinition`、`parentId`、`command`。Issue 可以先缺少这些字段供审核；公开收录前必须补齐适用绑定。

维护者流程：

1. 按 [贡献指南](../CONTRIBUTING.md) 核查原作者、授权、来源／版本、使用要求和实际验证阶段，关联 Issue/PR，说明改编。
2. 每个 Prompt 按 [PROMPT_TEMPLATE.json](PROMPT_TEMPLATE.json) 写入 `catalog/prompts/<id>.json`；其他审核类型加入 `catalog/resource-entries.json` 数组。
3. 根据真实上游信息补齐下方绑定，不编造 hash、版本、许可或父项身份。
4. 运行 `node catalog/build.mjs`，再运行 `npm run verify`，将输入及生成的 `catalog/index.json`、`catalog/registry.json` 一起评审提交；不手改索引。
5. 合并到 `main` 后，社区适配器固定 40 位提交读取 `catalog/registry.json`，校验 Git blob 与所有条目，每六小时或手动同步。索引／页面无效时整次扫描失败。截至 2026-09-14，首次公开远端同步待发布后确认。

通用字段使用 schema 1、小写短横线 ID、原作者 GitHub 名、`zh|en|ja|other` 语言及真实许可 `CC0-1.0|MIT|CC-BY-4.0|Apache-2.0`。这是当前解析限制，不授权修改作品许可；未知或不支持的情况先保留为提案。非 Prompt 的公开 ID 为 `source-community-<id>`，Prompt 为 `github-<id>`。

更新保持资源稳定身份，重新审核版本／提交并重建两个索引；客户端修订反映内容变化，不静默替换已有收藏或安装。退出时修改 `catalog/removals.json` 后重建、合并；每条需资源 ID、原因和真实项目 Issue。资源仍在时绑定稳定身份，或按下例明确填写。规则跨来源别名执行，失败／重启保留最后成功策略，父插件退出也隐藏所属 Slash。用户安装与私人副本不删除。

## 日本語

本ディレクトリは審査済み 6 種類の GitHub 索引を生成し、npm・Skill・MCP のライブ検出とは区別します。画面の汎用出力は意図的に**提案専用**で、`packageRef`・`bundle`・`serverDefinition`・`parentId`・`command` を保持しません。Issue の審査段階では不足を許容しますが、公開前に必要な情報を補います。

メンテナーの手順：

1. [貢献ガイド](../CONTRIBUTING.md)に従い、原著作者、許可、出典／版、要件、実際の検証段階を確認し、Issue/PR と改変を記録します。
2. Prompt は [PROMPT_TEMPLATE.json](PROMPT_TEMPLATE.json) に従って `catalog/prompts/<id>.json`、他の種類は `catalog/resource-entries.json` 配列に追加します。
3. 下の情報を実際の上流データから補います。ハッシュ、版、ライセンス、親 ID を作り上げないでください。
4. `node catalog/build.mjs`、`npm run verify` を実行し、入力と生成された `catalog/index.json`・`catalog/registry.json` を一緒に審査・提出します。索引は直接編集しません。
5. `main` へマージすると、アダプターは 40 桁コミットを固定して `catalog/registry.json` の Git blob と全項目を検証し、6 時間ごとまたは手動で同期します。不正な索引／ページはスキャン全体を失敗させます。2026-09-14 時点では最初の公開同期は公開後の確認待ちです。

schema 1、小文字とハイフンの ID、原著作者の GitHub 名、言語 `zh|en|ja|other`、実際のライセンス `CC0-1.0|MIT|CC-BY-4.0|Apache-2.0` を使います。これはパーサーの制限で、作品を再許諾する権利ではありません。未対応・不明なものは提案に留めます。公開 ID は Prompt が `github-<id>`、他は `source-community-<id>` です。

更新は安定した識別子を維持して版／コミットを再審査し、両索引を再生成します。個人のコピーや導入物は自動置換しません。取り下げは `catalog/removals.json` に ID、理由、実在するプロジェクト Issue を記入し、再生成・マージします。項目が存在する間に安定識別子を結び付けるか、下のように明示します。別名／配布元をまたいで適用し、失敗・再起動後も最後の成功した方針を保持します。親が取り下げられた Slash も非表示になりますが、ユーザーの導入物と個人コピーは残ります。

## Binding examples

**Illustrative fragments, not publishable records. Replace placeholders with reviewed evidence and combine with the common fields. / 以下为字段示例，不能直接入库；用真实证据替换占位符并补齐通用字段。/ 以下は記入例です。そのまま掲載せず、証拠で置換して共通項目を補ってください。**

Common / 通用 / 共通：

```json
{
  "schema": 1,
  "id": "reviewed-example",
  "type": "插件",
  "title": "Example",
  "summary": "Describe the actual task.",
  "body": "Original documentation or reviewed usage description.",
  "url": "https://github.com/author/repo",
  "version": "1.2.3",
  "author": "author",
  "license": "MIT",
  "language": "en",
  "requirements": "Exact host, dependencies and tested limits."
}
```

| Type / 类型 / 種類 | Required binding / 必要绑定 / 必須情報 |
|---|---|
| Plugin `插件` | `"packageRef": { "name": "dsh-example", "version": "1.2.3" }`; display version must match / 展示版本一致 / 表示版と一致 |
| Theme `主题` | `"packageRef": { "name": "@author/dsh-theme", "version": "1.2.3" }`; npm plugin only today / 当前为 npm 主题插件 / 現在は npm プラグイン形式 |
| Slash | `"parentId": "source-dsh-plan-mode", "command": "/plan"`; real admitted official parent example / 已收录官方父项示例 / 掲載済み公式親の例 |
| Prompt | Original `body`, attribution and license; see template and provenance below / 原文、署名与许可 / 原文・帰属・許可 |

Skill bundle / Skill 文件绑定 / Skill のファイル情報：

```json
{
  "bundle": {
    "kind": "github-skill",
    "repository": "author/repo",
    "root": "skills/example",
    "commit": "<40 lowercase hexadecimal characters>",
    "licensePaths": ["LICENSE"],
    "files": [
      { "path": "skills/example/SKILL.md", "sha": "<40-character Git blob SHA>", "mode": "100644", "size": 123 },
      { "path": "LICENSE", "sha": "<40-character Git blob SHA>", "mode": "100644", "size": 456 }
    ]
  }
}
```

List every original file, including referenced scripts/assets and applicable license files; the two rows above are only a shape example. Use actual byte sizes and Git blob SHA-1 values, not a raw-file SHA-1 or invented checksum. A reviewed community Skill may use another GitHub repository and a safe subdirectory root. Allowed regular modes are `100644` and `100755`; no links, traversal or conflicting paths. Limits: 150 files, 1 MiB per file, 4 MiB total. Inherited root licenses remain intact.

须列出全部原始文件、引用脚本／资源及许可；示例两行不代表完整文件清单。使用真实字节数与 Git blob SHA-1，而非普通文件 SHA-1。社区审核可接纳其他 GitHub 仓库及安全子目录。模式仅 `100644/100755`；拒绝链接、路径逃逸和冲突。上限 150 文件、单文件 1 MiB、合计 4 MiB，保留继承的根许可。

原ファイル、参照スクリプト／素材、ライセンスをすべて列挙し、実バイト数と Git blob SHA-1 を使います。2 行は形式の例にすぎません。別の GitHub リポジトリと安全なサブディレクトリも審査できます。モードは `100644/100755`、リンク・パス逸脱・衝突は禁止です。最大 150 ファイル、個別 1 MiB、合計 4 MiB。継承ライセンスも保持します。

MCP definition / MCP 定义 / MCP 定義：

```json
{
  "serverDefinition": {
    "name": "io.github.author/example",
    "version": "1.2.3",
    "description": "Actual server purpose.",
    "remotes": [{ "type": "streamable-http", "url": "https://mcp.example.com/mcp" }]
  }
}
```

Copy the complete real definition, including variables, headers, package arguments and environment requirements where declared. Its version must match the entry; `latest` is not a pin. Current connection controls accept public HTTPS Streamable HTTP or npm stdio with exact npm versions. An admitted stdio definition is not proof that every runtime/registry is connectable.

完整保留真实定义中的变量、请求头、包参数与环境要求；版本须与条目一致，`latest` 不是固定版本。当前连接控件支持公共 HTTPS Streamable HTTP、固定 npm 版本 stdio；目录可收录不代表所有运行时／注册源都能连接。

実定義の変数、ヘッダー、引数、環境要件を省かず保存し、項目の版と一致させます。`latest` は固定版ではありません。接続 UI は公開 HTTPS Streamable HTTP と固定 npm stdio に対応します。掲載は全ランタイム／レジストリへの接続を保証しません。

Prompt provenance / Prompt 来源 / Prompt 出典：

```json
{
  "provenance": {
    "repository": "author/repo",
    "commit": "<40-character commit>",
    "path": "prompts.csv",
    "entry": "Original entry name",
    "licenseUrl": "https://github.com/author/repo/blob/<same-commit>/LICENSE",
    "sha256": "<64-character SHA-256 of the exact UTF-8 body>"
  }
}
```

Set `url` to that same commit and source path. Original third-party `body` stays unchanged; translated navigation text is separate. Adaptations require explicit provenance and new hashes. The current eight selected works come from the pinned [f/prompts.chat source](https://github.com/f/prompts.chat/blob/eaab6b14a085f3b9e4461be90367fcd9a16d3204/prompts.csv); each file retains its author and CC0-1.0 attribution, not a claim of model-output quality.

`url` 对应同一提交和文件。第三方 `body` 保持原文，翻译导览另列；改编明确说明并更新 hash。现有八份精选各自保留原作者和 CC0-1.0 信息，不表示已比较模型效果。

`url` は同じコミットとファイルを指し、第三者の `body` は原文のまま保持します。案内の翻訳は分離し、改変は出典と新しいハッシュを記録します。現在の 8 件は作者と CC0-1.0 を保持し、モデル品質比較の結果ではありません。

| Selected Prompt / 精选 / 収録作品 | Original author / 原作者 / 原著作者 |
|---|---|
| Code Reviewer | rajudandigam |
| Commit Message Generator | mehmetalicayhan |
| Socratic Method | devisasari |
| English Translator and Improver | f |
| UX/UI Developer | devisasari |
| Tech Writer | lucagonzalez |
| Software Quality Assurance Tester | iuzn |
| Product Manager | orinachum |

Removal record / 移除记录 / 取り下げ記録：

```json
{
  "id": "source-community-reviewed-example",
  "reason": "Verified author opt-out",
  "issue": "https://github.com/QT7-C23/DSH-Marketplace/issues/123",
  "identities": ["package:dsh-example"]
}
```

The Issue number is a placeholder. Bind package name, `mcp:<server-name>`, `skill:author/repo/skills/name`, `slash:package:<package-name>:/command`, or `resource:<public-id>` as appropriate. Package and MCP identities cover version changes; a Skill root does not withdraw its sibling roots. Each rule permits up to eight identities. IDs/aliases are retained for compatibility, but a vanished ID alone cannot identify a future alias: record the stable identity before removing its evidence.

Issue 编号为占位符。按实际范围填写包名、MCP 服务名、Skill 仓库加根目录、父包加命令或公共 ID；包／MCP 身份跨版本，Skill 单根退出不影响同仓库其他根。每条最多八个身份。保留 ID／别名兼容；仅有已消失 ID 无法识别未来别名，移除证据前须绑定稳定身份。

Issue 番号は仮です。パッケージ名、MCP サーバー名、Skill のリポジトリ＋ルート、親パッケージ＋コマンド、公開 ID を範囲に応じて使います。パッケージ／MCP は版をまたぎ、Skill は同一リポジトリの別ルートへ波及しません。1 規則に最大 8 識別子です。消えた ID だけでは将来の別名を特定できないため、証拠を除く前に安定識別子を記録します。

Project code is MIT; resources keep their own licenses. / 项目代码 MIT，资源保留各自许可。/ コードは MIT、リソースは固有の許可を維持します。[Notices / 声明 / 表示](../THIRD_PARTY_NOTICES.md) · [Disclaimer / 免责 / 免責](../DISCLAIMER.md)
