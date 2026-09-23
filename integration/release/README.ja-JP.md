# DSH Marketplace

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

DeepSeek Harness 内でプラグイン、Skill、MCP、Slash、Prompt、テーマを探し、利用・管理できます。画面は中国語・英語・日本語に対応し、マーケット用アカウントは不要です。

**`v0.2.0-alpha.1`：初期プレリリース。** 検証環境は Windows / Node.js 24 / DSH 0.1.5-rc.2 です。ローカル検証は公式パッケージ、実ホスト画面、リソース操作を対象とし、標準管理は削除準備後のマーケット削除を含む 5 回の独立起動で検証しました。配布物は [Releases](https://github.com/QT7-C23/DSH-Marketplace/releases)、オンライン検証の実際の結果は [Actions](https://github.com/QT7-C23/DSH-Marketplace/actions) を確認してください。npm には公開していません。

## インストール

Windows、Node.js 24+、PATH 上の pnpm、実行時依存を取得する npm 接続、DSH **0.1.5-rc.2** が必要です。対象ホストを停止し、公式 CLI を使います。

```powershell
dsh plugin --profile web add "C:\Downloads\dsh-market-integration-0.2.0-alpha.1.tgz" --ignore-scripts --registry=https://registry.npmjs.org
dsh web
```

実際のパス／版に置き換えてください。上記は候補ファイル名です。対象は `web` profile です。サイドバーの **扩展市场** を開き、**设置** で言語を選びます。同じ profile でソース版を重複して読み込まないでください。閲覧にモデルキーは不要ですが、DSH のホスト認証は引き続き必要です。

## リソースの操作

- プラグイン／テーマは固定 npm 版を確認し、公式 CLI で導入・更新・削除します。ネイティブ入口は profile で有効化・無効化できます。保護依存や不確かな所有関係は変更を拒否します。
- Skill は固定・検証した原ファイルを DSH ネイティブ Skill サービスへ導入し、有効化・無効化・更新・ファイルを保持する削除・復元に対応します。
- MCP は完全な固定定義から公開 HTTPS Streamable HTTP または固定 npm stdio を接続し、有効化・無効化・削除します。登録ツールは正常動作の保証ではありません。再設定・版の変更は旧接続を削除してから明示的に再接続し、認証情報は自動移行しません。
- Slash は現在の会話の親コマンドを呼び出します。実際の `/plan` と `/plan off` で下書き・参照保持を確認しました。Prompt はプレビュー後に追記し、送信せず添付も保持します。
- テーマには個別の制限があります。Opera 0.2.1 は 1.04:1 のコントラスト警告、Machine 0.1.3 は起動不可、Bloom 0.12.0 は Mist とキーボードで開いて選ぶ Cinnabar が利用できる一方、マウスで開けない問題とローカル 404 ポーリングがあります。

任意の dsh-std は単一の管理 Loader を使います。**初回移行で全標準コンポーネントが再読み込みされる場合があります。同じプロセスは unknown／restart-required のままで、代替アダプターが active でも次の切り替えを拒否します。DSH を完全に停止して起動してください。** その後の安定した起動での切り替えは次回起動の設定だけを保存します。再起動後はブラウザーも更新します。モジュールキャッシュのホット交換や自動復旧はありません。

## 配布元・データ・審査

6 配布元は DSH 公式、Anthropic／OpenAI Skills、npm、MCP Registry、審査済み GitHub 索引です。2026-09-14 の完全な実行時スキャンでは **35,017 件の統合項目**を観測しました。恒久的な件数や利用可能性の保証ではありません。確認した初期カタログは配布元間の重複排除前で 4,907 件です。MCP 配布方針は最大 100 件で、実際に 100 件同梱する保証ではありません。最終パッケージは確認待ちです。実行時 MCP は全ページを取得します。自動確認は 6 時間、失敗後 30 分で再試行し、停止・再開・手動同期に対応します。不完全なスキャンは旧キャッシュを保持し、終了時は実行中の取得を取り消します。

汎用 JSON 出力は提案だけです。メンテナーが種類別情報を補い、生成／検証後に `main` へマージすると同期対象になります。作者の取り下げは安定識別子と別名をまたいで適用し、失敗・再起動後も最後の成功した方針を保持します。詳細画面から申請でき、設定で判断を表示します。個人コピーは残ります。

GitHub Star はリポジトリ全体、npm `last-month` はパッケージ全体の値で、期間と鮮度を表示します。ローカル DL はファイル準備に成功した重複なしの要求数、お気に入り／評価は個人のブラウザーデータです。操作履歴は秘密情報を除いた直近 20 件の profile 情報です。復旧はローカルのログ・バックアップを手動確認し、自動でロック解除しません。

任意の GitHub 読み取りトークンは Windows で `DSH_HOME/community/private/` に暗号化保存し、公式 API GET だけに使用します。README は現在の言語、次に英語を選びます。翻訳は DSH モデルを明示的に選んで開始し、失敗・取り消しでも Token が課金される場合があります。自動翻訳は行いません。

## 削除と権利

DSH を停止し、該当する場合は下記の標準管理の削除準備を完了してから、`dsh plugin --profile web remove dsh-market-integration` を実行して再起動します。`DSH_HOME/community/` とブラウザーデータを保持し、GitHub トークンは失効しません。導入済みリソースはそれぞれの管理手順に従います。

独自コード／文書は [MIT](https://github.com/QT7-C23/DSH-Marketplace/blob/main/LICENSE) です。第三者の内容・依存は各ライセンスを保持し、名前・ロゴ・商標は所有者に帰属します。本プロジェクトは独立しており、DeepSeek の公式な提携・後援・推奨・商標許諾を意味しません。ソフトウェアは**現状のまま、無保証**です。`LICENSE`・`DISCLAIMER.md`・`THIRD_PARTY_NOTICES.md` と同梱依存の表示を含みます。[免責事項](https://github.com/QT7-C23/DSH-Marketplace/blob/main/DISCLAIMER.md)・[第三者表示](https://github.com/QT7-C23/DSH-Marketplace/blob/main/THIRD_PARTY_NOTICES.md)

[利用と管理](https://github.com/QT7-C23/DSH-Marketplace/blob/main/docs/EXTENSION_MANAGEMENT.md) · [貢献](https://github.com/QT7-C23/DSH-Marketplace/blob/main/CONTRIBUTING.md) · [作者による取り下げ](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml)

## 標準互換性と削除準備

固定版 dsh-std adapter 0.1.1-rc.3 には上流の制限があります。CommandRuntime を要求するコンポーネントの起動後、後続コンポーネントが接続交渉で失敗する場合があります。コマンド提供側の検証合格は、この組み合わせの互換性を保証しません。実際の構成を確認してください。

標準コンポーネントを管理したマーケットを削除する前に、DSH を停止し、同梱の保守プレビューを実行してください。DSH_HOME は実際の絶対パスに置換します。上流の自動検出を復元するため、無効化した標準コンポーネントが再び起動する場合があります。不要なパッケージは先に公式 CLI で削除してください。プレビューを確認後、同じコマンドに `--confirm <fingerprint>` を追加します。表示された無効パッケージの再有効化に同意する場合のみ `--enable-disabled` も追加してください。`not-managed` は確認不要です。準備成功後に公式削除を実行します。他の設定を保持し、バックアップを記録します。

```powershell
node "<DSH_HOME>\profiles\web\node_modules\dsh-market-integration\integration\maintenance.mjs" prepare-uninstall --home "<DSH_HOME>" --profile web
```
