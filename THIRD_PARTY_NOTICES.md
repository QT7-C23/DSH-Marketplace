# Third-party notices / 第三方版权清单 / 第三者の権利表示

The root [MIT License](LICENSE) covers original project code and documentation. Third-party resources, dependencies, and branding retain their own rights and terms. This inventory covers incorporated catalog content and principal dependencies; it is not a complete license inventory for a future binary release.

根目录 MIT 适用于项目原创代码与文档。第三方资源、依赖和品牌保留各自权利及条款。下表记录已收录内容和主要依赖，不是未来二进制发行物的完整许可证清单。

ルートの MIT は本プロジェクトのオリジナルのコードと文書に適用されます。第三者リソース、依存関係、ブランドには各自の権利と条件が適用されます。以下は収録コンテンツと主要な依存関係の一覧であり、将来のバイナリ配布物に対する完全なライセンス一覧ではありません。

## Incorporated content / 收录内容 / 収録コンテンツ

| Component / 内容 / コンテンツ | Source and attribution / 来源与署名 / 出典と帰属 | Terms and local notices / 许可与本地声明 / 条件と同梱表示 |
|---|---|---|
| 12 Anthropic Skills: academy-guide, algorithmic-art, brand-guidelines, discernment-nudge, frontend-design, internal-comms, mcp-builder, skill-creator, slack-gif-creator, theme-factory, web-artifacts-builder, webapp-testing | [anthropics/skills](https://github.com/anthropics/skills/tree/34040c9c568585f6929bedeaad110ad08f079624/skills), commit `34040c9c568585f6929bedeaad110ad08f079624`; Copyright 2026 Anthropic, PBC. | Selected directories: [Apache-2.0 text and original attribution](sources/licenses/anthropic-apache-2.0.txt). Original SKILL.md bodies and file manifests are in `sources/catalog.json`; downloaded ZIPs preserve the selected directory's original files and license. |
| Eight contributed Prompts | [f/prompts.chat](https://github.com/f/prompts.chat/blob/eaab6b14a085f3b9e4461be90367fcd9a16d3204/prompts.csv), commit `eaab6b14a085f3b9e4461be90367fcd9a16d3204` | [CC0-1.0 text](catalog/LICENSE-CC0.txt); original bodies, authors, fixed source URLs, and hashes in `catalog/prompts/`. Author mapping below. |
| MCP Registry records: Context7, GitHub MCP, Microsoft Learn | Publishers `io.github.upstash/context7`, `io.github.github/github-mcp-server`, `com.microsoft/microsoft-learn-mcp`; [official Registry](https://registry.modelcontextprotocol.io/docs) | Publisher descriptions and service definitions are retained as metadata. Listing or exporting a definition does not relicense the service, its code, or its content. Consult the linked publisher and service terms before use. |
| Development screenshot | [docs/images/marketplace.png](docs/images/marketplace.png), captured from our isolated DSH development host | Shows the project UI, upstream DeepSeek Harness UI and branding, and attributed resource metadata. No affiliation or trademark permission is implied. |

Original Skill and Prompt bodies are retained without translation. Chinese titles, descriptions, and other catalog presentation fields are project-added navigation text. They are not the original authors' words or a certification of resource quality.

Skill 与 Prompt 原文保持不变；中文标题、简介等展示字段是本项目增加的导览，不冒充原作者表述或质量认证。

Skill と Prompt の原文は翻訳せず保持しています。中国語のタイトルや説明などは本プロジェクトが追加した案内であり、原著作者の表現や品質認証ではありません。

### Prompt authors / Prompt 作者 / Prompt の著作者

| Original title | GitHub author | Local record |
|---|---|---|
| Code Reviewer | rajudandigam | [code-reviewer.json](catalog/prompts/code-reviewer.json) |
| Commit Message Generator | mehmetalicayhan | [commit-message-generator.json](catalog/prompts/commit-message-generator.json) |
| Socratic Method | devisasari | [socratic-method.json](catalog/prompts/socratic-method.json) |
| English Translator and Improver | f | [english-improver.json](catalog/prompts/english-improver.json) |
| UX/UI Developer | devisasari | [ux-ui-review.json](catalog/prompts/ux-ui-review.json) |
| Tech Writer | lucagonzalez | [technical-writing.json](catalog/prompts/technical-writing.json) |
| Software Quality Assurance Tester | iuzn | [qa-testing.json](catalog/prompts/qa-testing.json) |
| Product Manager | orinachum | [product-requirements.json](catalog/prompts/product-requirements.json) |

## Principal dependencies / 主要依赖 / 主な依存関係

The compatibility layer additionally pins `@dsh-std/adapter-dsh` and `@dsh-std/manifest` at `0.1.1-rc.3`, `@dsh-std/core` at `0.1.1-rc.2` (MIT, [dsh-std](https://github.com/Yan-Zero/dsh-std)), and `semver@7.7.2` (ISC, [node-semver](https://github.com/npm/node-semver)). Their original license files are preserved in [dsh-std-MIT.txt](licenses/dsh-std-MIT.txt) and [semver-ISC.txt](licenses/semver-ISC.txt). Transitive adapter dependencies remain subject to their own package notices.

兼容层固定以上标准包和 semver，保留原始许可；适配器的间接依赖仍适用各自声明。互換レイヤーの上記依存には原文のライセンスを保持します。間接依存には各パッケージの条件が適用されます。

| Dependency | Version in this checkout | License and retained notices |
|---|---|---|
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), including the DSH brand package and selected official plugins | `0.1.5-rc.2` | MIT; Copyright (c) 2026 DeepSeek. [Original notice](licenses/DeepSeek-MIT.txt). Downloaded plugin packages retain their own contents and notices. |
| [yaml](https://eemeli.org/yaml/) | `2.9.1` | ISC; [original notice](licenses/yaml-ISC.txt). |
| [react-markdown](https://github.com/remarkjs/react-markdown) | `10.1.0` | MIT; [original notice](licenses/react-markdown-MIT.txt). |
| [remark-gfm](https://github.com/remarkjs/remark-gfm) | `4.0.1` | MIT; [original notice](licenses/remark-gfm-MIT.txt). |
| [React](https://github.com/facebook/react) | `18.3.1` | MIT; Copyright (c) Facebook, Inc. and its affiliates. [Original notice](licenses/React-MIT.txt). |
| [fflate](https://github.com/101arrowz/fflate) | `0.8.3` | MIT; Copyright (c) 2026 Arjun Barrett. [Original notice](licenses/fflate-MIT.txt). |
| [esbuild](https://github.com/evanw/esbuild) | `0.25.12` | MIT; Copyright (c) 2020 Evan Wallace. [Original notice](licenses/esbuild-MIT.txt). |
| [TypeScript](https://github.com/microsoft/TypeScript) | `6.0.3` | [Apache-2.0 license supplied with the package](licenses/TypeScript-Apache-2.0.txt). |
| [Playwright](https://github.com/microsoft/playwright) | `1.62.1` | [Apache-2.0 license](licenses/Playwright-Apache-2.0.txt) and [upstream NOTICE](licenses/Playwright-NOTICE.txt), including its Puppeteer attribution. |

Dependencies are resolved by [package-lock.json](package-lock.json) and [integration/package-lock.json](integration/package-lock.json). `node_modules/` and generated host client bundles are not committed. Transitive packages and any bundled code can have other licenses; inspect and include the applicable license/NOTICE files when preparing a distribution. Do not treat this table as permission to remove upstream notices.

依赖版本以两个 lockfile 为准，`node_modules/` 与生成的宿主客户端不提交。间接依赖及实际打包代码可能适用其他许可证，准备发行物时须按实际内容保留相应 LICENSE/NOTICE；本表不授权删除上游声明。

依存関係は二つの lockfile で固定され、`node_modules/` と生成済みホストクライアントはコミットしません。間接依存や実際に同梱するコードには別のライセンスが適用される場合があります。配布物の作成時は対象の LICENSE/NOTICE を保持してください。

Author READMEs loaded on demand retain their source links, commit information and original rights. Rendering them does not make them project-authored documentation. / 按需读取的作者 README 保留来源、提交和原权利，不成为项目原创文档。/ オンデマンドで取得した README は出典・コミット・元の権利を保持し、本プロジェクトの著作文書にはなりません。

## Rights and concerns / 权利与异议 / 権利に関する連絡

Names, logos, and trademarks remain with their respective owners. The project does not claim ownership of third-party work or endorsement by its publishers. For attribution corrections, rights concerns, or an author, maintainer, or rights holder's request to remove a listing, follow [the disclaimer's reporting guidance](DISCLAIMER.md).

名称、标识、商标归各自权利人所有。本项目不主张拥有第三方作品，也不表示获得发布者背书。署名修正、权利异议，或作者、维护者、权利人提出的资源移除申请，请参照 [免责声明中的联系说明](DISCLAIMER.md)。

名称、ロゴ、商標は各権利者に帰属します。本プロジェクトは第三者の著作物の所有権や配布者からの推奨を主張しません。帰属表示の修正、権利上の問題、著作者・メンテナー・権利者からの掲載取り下げのご依頼は [免責事項の連絡方法](DISCLAIMER.md) を参照してください。
