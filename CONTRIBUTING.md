# Contributing / 贡献指南 / コントリビューション

[English](#english) · [简体中文](#简体中文) · [日本語](#日本語)

## English

Use the [Issue forms](https://github.com/QT7-C23/DSH-Marketplace/issues/new/choose) for bugs, features, resource suggestions, or removal requests. General questions belong in [Discussions](https://github.com/QT7-C23/DSH-Marketplace/discussions). You may write in English, Chinese, or Japanese. An Issue does not automatically publish a resource.

For a PR, fork the repository, make a focused change, and complete the PR template. Use `type: short description` for commit messages and PR titles: `feat`, `fix`, `docs`, `test`, `refactor`, or `chore`, for example `docs: clarify resource removal requests`. Link related issues, explain observable changes, report `npm run verify` results and limitations, and include screenshots for visible changes. See [Repository Guidelines](AGENTS.md) and [setup](README.md#quick-start).

Prompt files follow [catalog/README.md](catalog/README.md) and belong in `catalog/prompts/<id>.json`. Run `node catalog/build.mjs`, then `npm run verify`. Other resource suggestions must identify their original author, source, version, license evidence, requirements, and actual validation; installation and compatibility are not implied by listing.

### Resource review

Our scope is plugins, Skills, MCP, Slash, Prompts and Themes. External contribution guides inform how we explain submissions; their admission rules do not govern this marketplace. We set no minimum repository age, Stars, commit count, mandatory Topic, or fixed three-entry PR limit. Keep submissions focused; similar resources can coexist when their differences are explained. Inactivity alone does not establish that a stable resource is unusable.

All proposals should identify the task, original author, content/source, version, sharing permission, usage instructions and known limitations. Unknown information can be stated in an Issue; missing attribution or permission must be resolved before content is distributed. Descriptions should match the resource, and forks or adaptations must explain their origin and changes.

| Type | Information needed for review |
|---|---|
| Plugin | Published package or source, target DSH/OS versions, dependencies and configuration. A claimed official bundle needs its manifest and patch; `dsh.client` alone is not activation evidence. Describe internal modules or client-only components as such. |
| Skill | Complete SKILL.md and referenced files, task scope, runtime needs and an invocation example. |
| MCP | Publisher, server definition, transport, startup/connection instructions, credentials needed and external service costs. Never include actual secrets. |
| Slash | Parent plugin, command syntax, parameters and expected behavior; it shares the parent's installation. |
| Prompt | Complete text, task, variables and an input example. If tested, include the model and representative result. Code, a standalone repository and `dsh.bundle` are unnecessary. |
| Theme | State whether it is a plugin or a preset, supported DSH/interface versions, any parent plugin, light/dark examples, application and restoration steps, and font/image licenses. A preset does not require its own plugin manifest. |

Separate author-declared compatibility from actual test results. Include the resource version, DSH range and tested version, runtime/interface, dependencies, and any protocol/adapter versions. Native bundles and dsh-std components use different declarations; adopting dsh-std is optional, and its components need the corresponding adapter rather than their own `dsh.bundle`. Our market has not integrated that adapter or automated compatibility enforcement. See [compatibility and themes](docs/COMPATIBILITY_AND_THEMES.md) for the verified boundaries.

Mark what you actually checked: documentation only, download, installation, loading, or use. Untested claims stay untested; screenshots do not prove every stage. Visual resources benefit from screenshots or a short recording; text resources may use examples instead. Images are review attachments for now: automatic screenshot discovery is not implemented. Submit in English, Chinese or Japanese; contributors need not translate resource content into all three languages.

Maintainers check provenance, descriptions, relevant behavior and existing entries, then explain acceptance, missing information or deferral in the Issue/PR. Fixes can stay in the same submission. Classification can be corrected during review. Format checks support this decision; they do not certify quality, safety or universal compatibility. Reviewed sources are integrated only when the corresponding adapter is supported; an Issue or exported JSON is not automatic publication.

Current file formats, license allowlists and download limits remain those in the [Prompt guide](catalog/README.md) and [source guide](sources/README.md). Unsupported cases can be proposed for review without changing a license to pass validation. `npm run verify` is the local gate; GitHub Actions and automatic submission approval are not configured. Updates, broken-source reports and author removal requests use the same review channels.

Preserve third-party attribution and licenses; original project contributions use MIT. Keep affected README translations aligned. Never submit credentials, authentication URLs, or private data. Authors, maintainers, and rights holders may use the removal form even without an infringement claim; see [the contact notice](DISCLAIMER.md).

## 简体中文

通过 [Issue 表单](https://github.com/QT7-C23/DSH-Marketplace/issues/new/choose) 反馈问题、建议功能、推荐资源或申请移除；使用交流请到 [Discussions](https://github.com/QT7-C23/DSH-Marketplace/discussions)。可使用英文、中文或日语。提交 Issue 不代表资源已经上架。

提交 PR 时，先 Fork 仓库，保持改动聚焦并填写 PR 模板。Commit 信息和 PR 标题使用 `type: 简短说明`，类型为 `feat`、`fix`、`docs`、`test`、`refactor` 或 `chore`，例如 `docs: 补充资源移除说明`。关联相关 Issue，解释实际行为变化，提供 `npm run verify` 结果及限制；界面变更附截图。开发规范见 [Repository Guidelines](AGENTS.md)，环境准备见 [快速开始](README.zh-CN.md#快速开始)。

Prompt 按 [catalog/README.md](catalog/README.md) 的格式提交到 `catalog/prompts/<id>.json`，运行 `node catalog/build.mjs` 后执行 `npm run verify`。其他资源推荐须提供原作者、来源、版本、许可依据、使用要求和实际验证情况；收录不等于已安装或已验证兼容。

### 资源审核

本项目面向插件、Skill、MCP、Slash、Prompt、主题。外部贡献指南供我们参考说明方式，其收录规则不直接约束本市场。我们不设仓库年龄、Star、提交数量、指定 Topic 或每个 PR 固定三条的门槛。投稿应聚焦；同类资源说明差异后可以并存。稳定资源也不因久未提交代码就被判定不可用。

推荐资源时，请说明解决的任务、原作者、内容或来源、版本、分享许可、使用方法与已知限制。未知信息可在 Issue 中注明；内容进入分发前须解决署名与授权缺口。简介应与实际内容一致，分叉或改编说明来源及改动。

| 类型 | 审核需要了解的内容 |
|---|---|
| 插件 | 发布包或源码、适用 DSH/系统版本、依赖及配置。声称可按官方 bundle 安装时，应提供 manifest 与 patch；仅有 `dsh.client` 不能证明已经生效。内部模块、仅前端组件按实际角色说明。 |
| Skill | 完整 SKILL.md 及引用文件、适用任务、运行条件和调用示例。 |
| MCP | 发布者、服务定义、传输方式、启动或连接方法、凭据要求及外部服务费用；不提交真实密钥。 |
| Slash | 所属插件、命令语法、参数与预期行为；与父插件共用安装。 |
| Prompt | 完整正文、用途、变量与输入示例；如已测试，附所用模型与代表性结果。无需代码、独立仓库或 `dsh.bundle`。 |
| 主题 | 说明是主题插件还是配色文件，适用 DSH/界面版本、父插件、深浅色示例、应用与恢复方法、字体和图片许可。配色文件无需独立的插件 manifest。 |

作者声明与实际测试分别记录：资源版本、DSH 适用范围与实测版本、运行环境/界面、依赖，以及采用的协议和适配器版本。原生 bundle 与 dsh-std 组件使用不同声明；dsh-std 自愿采用，其组件依赖相应适配器，不必自己提供 `dsh.bundle`。本市场尚未接入该适配器或自动兼容拦截，已核查边界见 [资源兼容与主题支持](docs/COMPATIBILITY_AND_THEMES.md)。

请写明实际验证到哪一步：仅阅读文档、下载、安装、加载或使用。未测部分保留“未验证”，截图不代表所有步骤通过。界面类资源推荐附截图或短录屏，文字类可用示例；图片目前用于人工审核，尚未实现截图自动发现。投稿可使用中、英、日任一语言，不要求贡献者把资源正文翻译成三语。

维护者核对来源、描述、适用行为和已有条目后，在 Issue/PR 中说明接受、待补材料或暂缓的原因；可在原提交内修正，分类也可在审核中调整。格式检查辅助判断，不构成质量、安全或普遍兼容认证。审核后的来源仍需适配器支持才能接入；Issue 和导出 JSON 均不会自动上架。

当前文件格式、许可白名单与下载限制以 [Prompt 指南](catalog/README.md) 和 [来源说明](sources/README.md) 为准。不支持的情况可提出审核，不能改填许可来通过校验。`npm run verify` 是本地门禁，GitHub Actions 和投稿自动批准尚未配置。更新、来源失效报告和作者移除申请沿用上述渠道。

第三方资源保留原署名和许可，项目原创贡献采用 MIT。相关 README 翻译同步更新。不要提交凭据、认证地址或私人数据。作者、维护者或权利人无需先提出侵权指控，即可使用移除表单，联系说明见 [免责声明](DISCLAIMER.md)。

## 日本語

不具合、機能提案、リソース推薦、掲載取り下げは [Issue フォーム](https://github.com/QT7-C23/DSH-Marketplace/issues/new/choose)、使い方の相談は [Discussions](https://github.com/QT7-C23/DSH-Marketplace/discussions) を利用してください。英語・中国語・日本語で記入できます。Issue の提出だけでリソースが公開されることはありません。

PR はリポジトリを Fork し、変更範囲を絞ってテンプレートを記入してください。コミットメッセージと PR タイトルは `type: 短い説明` とし、`feat`、`fix`、`docs`、`test`、`refactor`、`chore` を使用します。例：`docs: 掲載取り下げの案内を追加`。関連 Issue、実際の動作変更、`npm run verify` の結果と制限を記載し、UI 変更には画像を添えてください。[Repository Guidelines](AGENTS.md) と [セットアップ](README.ja-JP.md#クイックスタート) も参照してください。

Prompt は [catalog/README.md](catalog/README.md) に従って `catalog/prompts/<id>.json` に追加し、`node catalog/build.mjs` の後に `npm run verify` を実行します。他のリソース提案には原著作者、出典、バージョン、ライセンスの根拠、利用要件、実際の検証結果を含めてください。掲載はインストールや互換性の検証を意味しません。

### リソースの審査

対象はプラグイン、Skill、MCP、Slash、Prompt、テーマです。他の貢献ガイドは説明方法の参考であり、その掲載条件を本市場の規則にはしません。リポジトリの経過日数、Star、コミット数、指定 Topic、PR ごとに一律三件までという条件は設けません。投稿範囲は絞り、類似リソースは違いを説明してください。安定したリソースは更新が少ないだけで利用不可とは判断しません。

用途、原著作者、内容・出典、版、共有の許可、利用方法、既知の制限を記載してください。不明な点は Issue に明記できますが、配布前に帰属と許可を確認します。説明は実態に合わせ、フォークや改変には出典と変更内容を記載します。

| 種類 | 審査に必要な情報 |
|---|---|
| プラグイン | 配布物またはソース、DSH・OS の版、依存関係と設定。公式 bundle として導入可能とする場合は manifest と patch を提示します。`dsh.client` だけでは有効化の証拠になりません。内部モジュールやフロントエンドのみの部品は役割を明示します。 |
| Skill | 完全な SKILL.md と参照ファイル、用途、実行条件、呼び出し例。 |
| MCP | 公開者、サーバー定義、転送方式、起動・接続方法、必要な認証と外部サービス料金。実際の秘密情報は含めません。 |
| Slash | 提供元プラグイン、構文、引数、期待する動作。導入は親プラグインと共通です。 |
| Prompt | 全文、用途、変数、入力例。検証済みならモデルと代表的な結果も記載します。コード、独立したリポジトリ、`dsh.bundle` は不要です。 |
| テーマ | プラグインか配色ファイルか、対応 DSH・画面の版、親プラグイン、明暗の表示例、適用・復元手順、フォント・画像のライセンスを記載します。配色ファイルに独立したプラグイン manifest は不要です。 |

作者の互換性宣言と実測は区別し、リソースの版、DSH 対応範囲と実測版、環境・画面、依存関係、採用したプロトコルとアダプターの版を記載してください。ネイティブ bundle と dsh-std コンポーネントは宣言が異なり、dsh-std の採用は任意です。そのコンポーネントには対応アダプターが必要ですが、独自の `dsh.bundle` は不要です。本市場は同アダプターと自動互換性判定を未導入です。[互換性とテーマ](docs/COMPATIBILITY_AND_THEMES.md)に確認済みの範囲をまとめています。

文書確認、ダウンロード、インストール、読み込み、利用のどこまで検証したかを明記し、未検証を成功としないでください。画像だけですべての段階を証明することはできません。UI は画像や短い録画、テキストは利用例を推奨します。画像は現在、手動審査の資料であり、自動検出は未実装です。中・英・日のいずれかで投稿でき、本文の三言語翻訳は必須ではありません。

メンテナーは出典、説明、関連する動作、既存項目を確認し、受理・追加資料・保留の理由を Issue/PR に記載します。同じ投稿で修正でき、分類も審査中に調整できます。形式検証は判断を補助するもので、品質・安全性・全環境での互換性の認証ではありません。審査済みの配布元も対応アダプターが必要で、Issue や JSON の書き出しだけでは公開されません。

現在の形式、対応ライセンス、取得制限は [Prompt ガイド](catalog/README.md) と [配布元の説明](sources/README.md) に従います。未対応のケースは提案できますが、検証を通すためにライセンスを書き換えないでください。`npm run verify` がローカルの検証入口で、GitHub Actions と投稿の自動承認は未設定です。更新、不通の報告、作者による取り下げも同じ窓口を使います。

第三者の帰属表示とライセンスを保持し、プロジェクトのオリジナルの貢献には MIT を適用します。関連する README 翻訳も更新してください。認証情報や非公開データは提出しないでください。著作者・メンテナー・権利者は、侵害を主張しなくても掲載取り下げを依頼できます。[免責事項の連絡案内](DISCLAIMER.md) を参照してください。
