# Contributing / 贡献指南 / コントリビューション

[English](#english) · [简体中文](#简体中文) · [日本語](#日本語)

## English

Use the [Issue forms](https://github.com/QT7-C23/DSH-Marketplace/issues/new/choose) for bugs, features, resource proposals and author opt-outs. English, Chinese and Japanese are welcome. There is no marketplace account; GitHub handles contributions. An Issue or exported file is not publication.

For code or documentation, make a focused PR and complete its template. Use `type: short description` for commits and PR titles: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`. This is our convention, not a claim about an inherited repository history. Explain observable changes, related issues, verification and limitations; include UI evidence where relevant. See [setup](integration/README.md#环境与开发启动) and [repository guidelines](AGENTS.md).

### Propose, review, merge, synchronize

1. Describe the task, original author, source/version, license evidence, usage and known limitations. Explain forks and adaptations. Unknown details can be stated in an Issue; executable metadata is optional at this proposal stage.
2. Generic UI JSON exports contain proposal fields only. Maintainers verify attribution and permission, then complete the type-specific bindings below. Do not import/export a reviewed entry through that editor expecting executable fields to survive.
3. Put Prompts in `catalog/prompts/<id>.json`; put reviewed Plugin, Skill, MCP, Slash and Theme entries in `catalog/resource-entries.json`. Follow the [catalog guide and examples](catalog/README.md).
4. Run `node catalog/build.mjs`, then `npm run verify`. Include the source files and generated `catalog/index.json` and `catalog/registry.json` in the reviewed PR. Do not edit indexes by hand.
5. After merge into `main`, the community adapter reads the index at a fixed commit and verifies its bytes. Clients pick it up on successful manual sync or the six-hour automatic check. Failed scans keep the old snapshot. Unmerged proposals are never admitted.

| Type | Binding required before public admission |
|---|---|
| Plugin | Exact `packageRef: { name, version }`; the version matches the displayed version. Installation additionally checks the actual package manifest, host/dependencies and entrypoints. |
| Skill | Reviewed GitHub `repository` and `root`, fixed 40-character commit, original file paths/Git blob hashes/modes/sizes, SKILL.md and applicable license files. Reviewed repositories are not limited to Anthropic or OpenAI. |
| MCP | Complete `serverDefinition` with a fixed matching version, supported transport, endpoints/packages and input declarations. Connection support is narrower than directory admission; include requirements, permissions and service costs, never secrets. |
| Slash | A known `parentId` plus an explicit `command`. The parent must be an admitted plugin or a pinned official module; installation belongs to it. |
| Prompt | Complete original body, attribution and license. Third-party provenance pins the source and body hash; label adaptations explicitly. |
| Theme | Current installable admission requires an exact matching npm `packageRef`. Presets or standalone theme files can be proposed, but have no generic public installation path yet. |

Separate author declarations from actual download, install, load, call and removal checks. Record exact resource/DSH/adapter versions and OS/interface. Native bundles and optional dsh-std components use different declarations; the current market integrates the pinned adapter and compatibility checks. Metadata or protocol negotiation does not establish runtime success. Include theme appearance/restoration evidence and known warnings. Text resources can use examples; automatic screenshot discovery is not implemented.

There are no minimum Stars, repository age, commit count, mandatory Topics or fixed three-entry PR limit. Similar resources can coexist when their differences are clear. Unsupported licenses/formats may be proposed, but never relabel a license to pass validation. Maintainers explain acceptance, missing information or deferral in the same Issue/PR.

### Updates and removal

Updates repeat review with a new exact version/commit and regenerated indexes. Client discovery does not replace personal copies or automatically upgrade installations.

Authors, maintainers or rights holders may request removal without alleging infringement. Use the [removal form](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml). After verification, maintainers add the reason, Issue and stable identities to `sources/removals.json`, rebuild and merge. Rules apply across aliases/sources and survive failed syncs and restarts; existing installations and personal copies remain. The [catalog guide](catalog/README.md) defines identity scope.

### Verification and rights

`npm run verify` is shared by the local gate, [Windows CI](.github/workflows/verify.yml) and [pre-commit hook](.githooks/pre-commit). Enable the hook with `git config core.hooksPath .githooks`. CI is configured for Windows 2025, Node 24.16.0 and pnpm 12.3.4; it uses an ephemeral read-only GitHub token encrypted with DPAPI. Use the workflow result for the exact commit being reviewed. Do not label partial checks as a full pass.

Original contributions use [MIT](LICENSE); preserve third-party licenses, attribution and [notices](THIRD_PARTY_NOTICES.md). Keep affected README translations aligned. Never submit credentials, local authentication URLs, databases or private evidence. See [disclaimer and contact](DISCLAIMER.md).

## 简体中文

通过 [Issue 表单](https://github.com/QT7-C23/DSH-Marketplace/issues/new/choose) 提交问题、功能建议、资源提案或作者退出申请，可使用中、英、日任一语言。市场没有独立账户，贡献使用 GitHub 身份。Issue 和文件导出不等于公开上架。

代码和文档以聚焦的 PR 提交并填写模板。Commit 和 PR 标题使用 `type: 简短说明`：`feat`、`fix`、`docs`、`test`、`refactor`、`chore`。这是本仓库约定，不是继承父仓库历史的陈述。说明实际变化、关联问题、验证和限制，界面改动附证据。见 [开发启动](integration/README.md#环境与开发启动) 与 [仓库规范](AGENTS.md)。

### 提案、审核、合并、同步

1. 提供用途、原作者、来源／版本、许可依据、使用方法和已知限制；说明分叉与改编。Issue 阶段可以注明未知，可执行字段不必齐全。
2. 界面通用 JSON 导出仅保留提案字段。维护者核对作者与授权后补齐下表绑定；不要把审核条目通过通用编辑器导入再导出，以为执行字段会保留。
3. Prompt 放入 `catalog/prompts/<id>.json`；审核后的插件、Skill、MCP、Slash、主题放入 `catalog/resource-entries.json`。格式见 [目录指南与示例](catalog/README.md)。
4. 执行 `node catalog/build.mjs`，再执行 `npm run verify`；PR 同时包含源文件与生成的 `catalog/index.json`、`catalog/registry.json`。不要手改索引。
5. 合并到 `main` 后，社区适配器固定提交读取并校验索引字节；客户端手动同步或六小时自动检查成功后收录。扫描失败保留旧快照，未合并提案不入库。

| 类型 | 公开收录前必须具备的绑定 |
|---|---|
| 插件 | 精确 `packageRef: { name, version }`，与展示版本一致。安装阶段另查实际包声明、宿主／依赖与入口。 |
| Skill | 审核后的 GitHub `repository`、`root`、40 位固定 commit、原始文件路径／Git blob hash／模式／大小、SKILL.md 与适用许可文件。可审核 Anthropic、OpenAI 以外的仓库。 |
| MCP | 完整 `serverDefinition`，包含一致的固定版本、受支持传输、端点／包与参数声明。实际连接支持比目录收录更窄；说明权限、条件和费用，不提交密钥。 |
| Slash | 可解析的 `parentId` 和明确的 `command`。父项须为已收录插件或固定官方模块，共用父插件安装。 |
| Prompt | 完整原文、原作者和许可；第三方内容固定来源与正文校验值，改编单独标注。 |
| 主题 | 当前可安装收录要求版本一致的固定 npm `packageRef`。配色文件可先提案，但暂无通用公开安装路径。 |

作者声明与下载、安装、加载、调用、卸载实测分开记录，注明精确资源／DSH／适配器版本、系统与界面。原生 bundle 与可选 dsh-std 使用不同声明；当前市场已经接入固定适配器与兼容检查，但元数据或协议协商不能证明实际功能成功。主题提供外观、恢复证据与警告，文字资源可提供使用示例；截图自动发现尚未实现。

不设最低 Star、仓库年龄、提交次数、强制 Topic 或固定每 PR 三条的门槛。同类资源可说明差异后并存。不支持的许可或格式可以提出讨论，不得改填许可通过验证。维护者在原 Issue/PR 中说明接受、待补材料或暂缓原因。

### 更新与移除

更新需重新审核精确版本／提交并重建索引。客户端发现更新不自动替换个人副本或升级安装。

作者、维护者或权利人无需提出侵权指控，即可使用 [移除表单](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml)。核实后维护者在 `sources/removals.json` 记录原因、Issue 与稳定身份，重建并合并。策略跨别名／来源生效，在同步失败与重启后仍保留；既有安装和私人副本不删除。身份范围见 [目录指南](catalog/README.md)。

### 验证与权利

本地、[Windows CI](.github/workflows/verify.yml) 与 [pre-commit hook](.githooks/pre-commit) 共用 `npm run verify`。通过 `git config core.hooksPath .githooks` 启用 hook。CI 配置为 Windows 2025、Node 24.16.0、pnpm 12.3.4，以 DPAPI 加密临时只读 GitHub 令牌。以待审核提交对应的工作流结果为准，不得把局部检查写成全量通过。

原创贡献采用 [MIT](LICENSE)，保留第三方许可、署名与 [声明](THIRD_PARTY_NOTICES.md)，同步受影响的 README 翻译。不要提交凭据、本机认证地址、数据库或私人证据，见 [免责声明与联系说明](DISCLAIMER.md)。

## 日本語

不具合、機能、リソース提案、作者による取り下げは [Issue フォーム](https://github.com/QT7-C23/DSH-Marketplace/issues/new/choose)を使い、中・英・日のいずれかで記載できます。マーケット用アカウントはなく、貢献は GitHub のアカウントで行います。Issue や出力ファイルだけでは公開されません。

コード・文書は範囲を絞った PR とテンプレートで提出してください。コミットと PR は `type: 短い説明` とし、`feat`、`fix`、`docs`、`test`、`refactor`、`chore` を使います。これは本リポジトリの慣例で、親リポジトリの履歴を示すものではありません。動作変更、関連 Issue、検証と制限を説明し、UI には証拠を添えてください。[開発手順](integration/README.md#环境与开发启动)と[規則](AGENTS.md)を参照してください。

### 提案、審査、マージ、同期

1. 用途、原著作者、出典／版、ライセンス根拠、使い方、既知の制限を記載し、フォーク・改変を説明します。不明点は明記でき、Issue 段階で実行用項目をすべて揃える必要はありません。
2. 画面の汎用 JSON 出力は提案項目だけです。メンテナーが帰属・許可を確認し、下表の情報を補います。審査済み項目を汎用エディターで再出力しても実行用情報は保持されません。
3. Prompt は `catalog/prompts/<id>.json`、審査済み Plugin・Skill・MCP・Slash・Theme は `catalog/resource-entries.json` に保存します。[カタログガイドと例](catalog/README.md)に従ってください。
4. `node catalog/build.mjs`、`npm run verify` の順に実行し、入力と生成された `catalog/index.json`・`catalog/registry.json` を PR に含めます。索引を直接編集しないでください。
5. `main` へのマージ後、アダプターはコミットを固定して索引のバイトを検証します。クライアントは手動同期または 6 時間ごとの確認成功で取得します。失敗時は旧キャッシュを保持し、未マージの提案は収録しません。

| 種類 | 公開収録前に必要な情報 |
|---|---|
| プラグイン | 固定 `packageRef: { name, version }` と表示版の一致。導入時には実際の宣言、ホスト／依存、入口を別途確認します。 |
| Skill | 審査済み GitHub `repository`・`root`、40 桁コミット、原ファイルのパス／Git blob ハッシュ／モード／サイズ、SKILL.md とライセンス。Anthropic・OpenAI 以外のリポジトリも審査できます。 |
| MCP | 固定版が一致する完全な `serverDefinition`、対応転送方式、エンドポイント／パッケージ、入力宣言。接続対応は掲載条件より狭いため、要件・権限・料金を説明し、秘密情報は記載しません。 |
| Slash | 解決可能な `parentId` と明確な `command`。親は掲載プラグインまたは固定公式モジュールで、導入は親に属します。 |
| Prompt | 完全な原文、帰属、ライセンス。第三者作品は出典と本文ハッシュを固定し、改変は明示します。 |
| テーマ | 現在の導入可能な掲載には固定 npm `packageRef` と表示版の一致が必要です。配色ファイルも提案できますが、汎用導入経路はありません。 |

作者の宣言とダウンロード・導入・読み込み・呼び出し・削除の実測を分け、正確なリソース／DSH／アダプター版、OS、画面を記録します。ネイティブ bundle と任意の dsh-std は異なる宣言を使います。現在は固定アダプターと互換性検査を統合していますが、メタデータや協商だけでは機能の成功を証明できません。テーマは外観・復元と警告、テキストは利用例を提示できます。画像の自動検出は未実装です。

最低 Star、リポジトリ年齢、コミット数、必須 Topic、一律 PR 3 件までという条件はありません。類似項目は違いを説明してください。未対応のライセンス・形式は提案できますが、検査のためにライセンスを偽ってはいけません。受理・追加資料・保留の理由は元の Issue/PR に記載します。

### 更新と取り下げ

更新は固定版／コミットを再審査して索引を再生成します。クライアントでの検出は個人のコピーや導入物を自動更新しません。

著作者・メンテナー・権利者は侵害を主張せずに [取り下げフォーム](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml)を使えます。確認後、理由・Issue・安定した識別子を `sources/removals.json` に記録して再生成・マージします。別名／配布元をまたいで適用し、同期失敗・再起動後も保持します。導入済みの内容と個人のコピーは残ります。識別範囲は[カタログガイド](catalog/README.md)を参照してください。

### 検証と権利

ローカル、[Windows CI](.github/workflows/verify.yml)、[pre-commit hook](.githooks/pre-commit) は `npm run verify` を共有します。hook は `git config core.hooksPath .githooks` で有効化します。CI は Windows 2025、Node 24.16.0、pnpm 12.3.4 を使い、一時的な読み取り専用 GitHub トークンを DPAPI で暗号化します。審査対象のコミットに対応するワークフロー結果を確認してください。一部の検査を全体の合格と表現しないでください。

独自の貢献には [MIT](LICENSE) を適用し、第三者のライセンス・帰属・[表示](THIRD_PARTY_NOTICES.md)を保持します。関連 README 翻訳を揃え、認証情報、ローカル認証 URL、DB、非公開の証拠を提出しないでください。[免責と連絡先](DISCLAIMER.md)
