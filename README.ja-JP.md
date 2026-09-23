# DSH Marketplace

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

**DeepSeek Harness 内でプラグイン、Skill、MCP、Slash、Prompt、テーマを検索・利用・管理できます。** 独立したコミュニティプロジェクトで、英語・中国語・日本語の画面に対応します。マーケット用アカウントは不要です。

[ダウンロード](https://github.com/QT7-C23/DSH-Marketplace/releases) · [ドキュメント](scripts/release/README.ja-JP.md) · [貢献する](CONTRIBUTING.md)

![DSH Marketplace](assets/marketplace.png)

*開発画面です。リソースの文書は原文を保持します。*

## 利用できる機能

| リソース | DSH での操作 |
|---|---|
| プラグイン | 互換性を確認し、対応するホスト機能で導入・更新・有効化・無効化・削除します。 |
| Skill | 検証済みの原ファイルを導入し、管理対象の版を読み込み・更新・無効化・復元します。 |
| MCP | HTTPS Streamable HTTP または固定 npm 版の stdio サーバーを設定し、有効化・無効化・削除します。 |
| Slash | 現在の会話でプラグインが提供するコマンドを実行します。 |
| Prompt | 原文をプレビューして下書きに追記します。本文・参照・添付を保持し、自動送信しません。 |
| テーマ | npm テーマを検索・管理し、個別の互換性情報を確認します。 |

固定 DSH カタログ、Anthropic Skills、OpenAI Skills、npm、MCP Registry、本プロジェクトの審査済み GitHub カタログに接続します。自動検索は 6 時間ごとに実行し、不完全な更新では以前の一覧を保持します。検索できることは動作の保証ではありません。[配布元の詳細](src/sources/README.md)

作者の原文を利用可能な言語で読めます。翻訳は DSH で選択したモデルを使い、Token を消費します。失敗・取り消しでも課金される場合があります。

## クイックスタート

**現在のプレリリース：[v0.2.0-alpha.1](https://github.com/QT7-C23/DSH-Marketplace/releases/tag/v0.2.0-alpha.1)。** 検証環境は Windows、Node.js 24、DSH 0.1.5-rc.2 です。導入には PATH 上の pnpm と npm へのネットワーク接続が必要です。

リリースから TGZ と `SHA256SUMS.txt` を取得し、ハッシュを確認して DSH を停止してから導入します。

```powershell
dsh plugin --profile web add "C:\Downloads\dsh-market-integration-0.2.0-alpha.1.tgz" --ignore-scripts --registry=https://registry.npmjs.org
dsh web
```

サイドバーの **扩展市场** を開き、設定で言語を選んでください。閲覧にモデルキーは不要です。更新・削除は[インストールガイド](scripts/release/README.ja-JP.md)、ソースからの起動は[開発ガイド](scripts/README.md)を参照してください。npm には公開していません。

## 利用前の確認

- **互換性**：ネイティブ DSH リソースと対応する dsh-std コンポーネントを別々に扱います。標準コンポーネントの変更には完全な再起動が必要で、固定アダプターには CommandRuntime の組み合わせに関する問題があります。[互換性とテーマ](scripts/release/README.ja-JP.md#リソースの操作)
- **管理**：MCP の版・設定変更には削除後の再接続が必要です。標準コンポーネントを管理したマーケットを削除する前に、[削除準備](scripts/release/README.ja-JP.md#標準互換性と削除準備)を行ってください。
- **GitHub 接続**：任意の読み取りトークンで API 枠を利用できます。Windows での初回認証情報の初期化に約 1 分かかる場合があります。[接続ガイド](scripts/README.md#github-连接)
- **指標とデータ**：Star は出典リポジトリ、npm ダウンロード数はパッケージ全体、ローカル DL 数は用意できたファイルの回数です。お気に入りと評価は個人のブラウザーデータで、サイトデータの削除により消去されます。

初期プレリリースのため、他のホスト版やすべての外部リソースの組み合わせは未検証です。自動復旧とローカルモデルの取得は現在の対象外です。

## 貢献する

不具合やリソース提案は[貢献ガイド](CONTRIBUTING.md)に従い、GitHub で審査します。作者・権利者は侵害の主張なしで[掲載取り下げ](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml)を依頼できます。既存の個人コピーや導入済み内容は保持します。

開発用リンク：[起動と検証](scripts/README.md) · [アーキテクチャ](scripts/README.md#模块与本地数据) · [リポジトリ規則](AGENTS.md) · [CI](https://github.com/QT7-C23/DSH-Marketplace/actions)。共通の検証コマンドは `npm run verify` です。

## ライセンスと免責事項

独自のコードと文書は **[MIT](LICENSE)**、© 2026 QT7-C23 and contributors です。第三者のライセンスと帰属は維持します。[第三者表示](THIRD_PARTY_NOTICES.md)

独立して開発しており、DeepSeek との公式な提携や推奨を意味しません。名称・商標は各権利者に帰属します。**現状のまま、無保証**で提供します。[英語・中国語・日本語の免責事項](DISCLAIMER.md)
