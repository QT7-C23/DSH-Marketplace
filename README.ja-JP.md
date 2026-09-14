# DSH Marketplace

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

DeepSeek Harness 内でプラグイン、Skill、MCP、Slash、Prompt、テーマを探せるコミュニティ開発のマーケットです。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Status: In development](https://img.shields.io/badge/status-in%20development-orange.svg)](#開発状況)

リソースを探し、作者の文書を読み、選んだ版を保存できます。DSH 内でインストール・利用・管理まで完結することを目指しています。

![DSH Marketplace](docs/images/marketplace.png)

*実際の開発画面です。UI は中国語・英語・日本語に対応し、リソースの内容は原文を保持します。*

## 開発状況

**現在はローカル開発版です。独立して開発しており、DeepSeek の公式製品ではありません。**

| 項目 | 現在利用可能 | 今後の実装 |
|---|---|---|
| 閲覧 | 6 種類のフィルター、用途分類、検索、概要と作者の README/SKILL.md | 配布元の拡充 |
| 拡張管理 | npm 固定版の確認、バージョン・プロトコル検証、公式 CLI での導入・更新・削除、両方式の状態表示 | 個別の有効化・無効化、自動復旧、対応範囲の検証 |
| 配布元 | Anthropic Skill の全ディレクトリ検出、6 時間ごとの確認、停止・再開、結果報告 | 他の配布元の自動検出と独自の配布元 |
| ダウンロード | 完全な Skill ZIP、検証済み TGZ、MCP 定義、Prompt 本文 | Skill 読み込み、MCP 接続、汎用 Slash 実行 |
| Prompt | 本文・参照・添付を保持して DSH の下書きへ追記 | 他のホスト版での検証 |
| 投稿 | 6 種類の作者・ライセンス入力と GitHub 投稿ファイル。マーケットのアカウント不要 | 審査済み投稿の自動同期 |
| ライブラリ | ローカルのお気に入り、下書き、自分の評価、DL 数とリポジトリ Star | 公開コミュニティの統計 |

カタログは **実在するリソース 30 件：プラグイン 4、Skill 12、MCP 3、Slash 3、Prompt 8** と、明示したサンプル 2 件です。Anthropic では 19 個の Skill を検出し、現在のライセンス・ファイル制限に適合する 12 個を収録しています。他の配布元は指定した項目を更新します。

4 件のプラグインは DSH 公式の機能モジュールで、一部はホストやプリセットに既に含まれます。独立したコミュニティ bundle が 4 件あるという意味ではありません。マーケット自体は独立した開発用 TGZ を提供でき、公式 CLI での導入、実際のホスト動作と削除を検証しました。npm・GitHub Release には未公開です。[導入ガイド](docs/PACKAGE_INSTALLATION.md)を参照してください。

テーマの分類と投稿に対応しましたが、審査済みの掲載項目、自動検出、適用はまだありません。DSH ネイティブ拡張と任意の dsh-std コンポーネントは要件が異なります。初期の管理機能は両方の実行状態を読み取り、固定版アダプターを検証します。[互換性とテーマ](docs/COMPATIBILITY_AND_THEMES.md)と[導入・復旧ガイド](docs/EXTENSION_MANAGEMENT.md)を参照してください。

## クイックスタート

独立パッケージは開発依存の導入後に `npm run package` で生成し、`artifacts/releases/` に保存します。[導入ガイド](docs/PACKAGE_INSTALLATION.md)に従い公式 CLI で導入できます。`npm run verify:package` は導入、UI、削除とデータ保持を検証します。以下はソースからの開発手順です。

**Node.js 24+**、npm、導入時に PATH で使える pnpm、ネットワーク、Windows の Microsoft Edge が必要です。検証済みホストは **DSH 0.1.5-rc.2** で、他のホスト版・OS は未検証です。

```powershell
npm ci
npm ci --prefix integration --ignore-scripts
node integration/build.mjs
node integration/host.mjs web --dump-config
node integration/set-plugin.mjs on
node integration/host.mjs web --port 4180 --no-open
```

`artifacts/dsh-integration/runtime/url.txt` のローカル認証 URL を開きます。このファイルは公開しないでください。最初の案内で **继续**、**稍后配置** を選び、サイドバーの **扩展市场** を開きます。プラグインの **设置** で表示言語を選択できます。閲覧にモデルキーは不要です。停止は `Ctrl+C`。

Prompt を使うには `artifacts/dsh-integration/runtime/workspace` を追加して会話を作成し、リソースを選択・プレビュー・追記します。送信は利用者が決定します。詳細は [ホストガイド](integration/README.md) を参照。起動用環境は設定とデータを分離しますが、OS のサンドボックスではありません。

## データとリソースの扱い

- マーケットの登録・ログイン機能はありません。DSH 自身のアクセス認証は引き続き必要です。
- お気に入り、署名付き下書き、自分の評価、表示言語はブラウザーとサイトごとに保存します。サイトデータの削除で消去され、ポート変更で保存範囲が変わります。旧アカウントのデータは元の DB に保持し、公開・移行しません。
- DL 数はローカルサービスがファイルを生成した回数で、再試行は重複計上しません。**GitHub Star は配布元リポジトリ全体の値**です。お気に入りと評価は個人用で、コミュニティ全体の統計ではありません。
- 作者の文書には原文・出典・コミットを保持します。文書が存在しない場合と通信失敗を区別し、現行リポジトリの文書が選択した版と異なる可能性も明示します。
- README は表示言語を優先し、なければ英語を表示します。「文書を翻訳」で DSH に構成済みの提供元・モデル・翻訳先を選び、明示的に開始します。モデルの Token 枠を消費し、失敗やキャンセルでも課金される場合があります。原文と訳文を切り替え、提供元が報告した使用量を確認できます。1回24,000文字までで、自動分割・再試行は行いません。
- 対応する GitHub、npm、MCP Registry に接続します。取得したリソースを自動でインストール・有効化・実行しません。
- `artifacts/`、DB、認証情報、ローカル認証 URL をコミットや公開報告に含めないでください。

## 開発と今後の予定

`npm run verify` は静的規則、カタログ、動作、型、ビルド、実際の DSH ブラウザーフローを検証します。翻訳は隔離したテスト用アダプターで確認し、有料の認証情報は使いません。配布元の実測にはネット接続と GitHub の API 枠が必要です。「設定 → GitHub 接続」で任意のトークンを保存できます。Windows で暗号化し、GitHub API の読み取りのみに使用します。[接続と保存の説明](docs/GITHUB_CONNECTION.md)と[UI・ホスト状態の検証記録](docs/research/2026-09-14-market-information-and-official-installation.md)を参照してください。GitHub Actions は未設定で、ローカル成功は公開 CI の成功を意味しません。

次はネットワークの問題解消、公開準備、コミュニティコンポーネントと他のホスト版の検証、種類別の実利用、復旧、配布元の拡充です。モデル、ローカルモデル取得、Cookbook は保留します。

| Directory | Responsibility |
|---|---|
| `integration/` | DSH ホスト、React UI、起動とブラウザー検証 |
| `community/` | 公開カタログ API、SQLite の DL 数と契約 |
| `sources/` / `catalog/` | 検出、取得、作者文書、用途分類、Prompt 投稿 |
| `languages/` | 前後段で共有する中国語・英語・日本語メッセージ |
| `prototype/` / `server/` | 保存した過去の単体対話プロトタイプ |
| `tests/` / `scripts/` / `docs/` | 検証とプロジェクト文書 |

[Architecture](docs/ARCHITECTURE.md) · [Sources](sources/README.md) · [Product plan](docs/PRODUCT_PLAN.md)

## 貢献するには

[貢献ガイド](CONTRIBUTING.md)、[Repository Guidelines](AGENTS.md)、Issue/PR テンプレートに従ってください。3 つの README と言語ファイルの整合性を保ち、動作・検証・制限を記載し、UI 変更には画像を添えてください。

6 種類とも署名を入力して JSON 提案を保存します。Prompt は [形式ガイド](catalog/README.md) に従い PR で `catalog/prompts/` へ追加してください。他の種類は [リソース投稿 Issue](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=03-resource-submission.yml) にファイル、作者、出典、ライセンス、要件、実測を添付します。書き出しはアップロード・公開を行わず、審査後の自動同期も未実装です。

## ライセンス・帰属表示・免責事項

本プロジェクトのオリジナルのコードと文書は **[MIT ライセンス](LICENSE)** です。Copyright © 2026 QT7-C23 and contributors。対象の内容を再配布する場合は、著作権表示と許諾表示を保持してください。

第三者のコンテンツと依存関係には、それぞれのライセンスと通知が適用され、ルートの MIT ライセンスで再許諾されるわけではありません。DeepSeek Harness、Anthropic Skills、Prompt の著作者、主要な依存関係は **[第三者の権利表示](THIRD_PARTY_NOTICES.md)** に記載しています。名称、ロゴ、商標は各権利者に帰属します。公式の提携、後援、推奨、商標の使用許諾を意味しません。

**本ソフトウェアは「現状のまま」提供され、いかなる保証もありません。** 掲載、完全性の確認、テストの成功は、安全性、正確性、互換性、継続的な利用可能性、特定目的への適合性を保証しません。第三者コンテンツ、権限、AI 出力は利用前に確認してください。保証の否認と責任制限は適用されるライセンスと法令に従い、この文書は MIT の許諾に制限を追加しません。**[英語・中国語・日本語の免責事項](DISCLAIMER.md)** をお読みください。

**掲載取り下げのご依頼。** リソースの著作者、メンテナー、または権利者で、本マーケットへの掲載を希望されない場合は、リソースの名称、URL、ご自身とリソースとの関係を [掲載取り下げフォーム](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml) に記入してください。確認後、対象リソースの掲載を取りやめます。
