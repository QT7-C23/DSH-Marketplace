# DSH Marketplace

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

DeepSeek Harness 内でプラグイン、Skill、MCP、Slash、Prompt、テーマを探すマーケットです。現在は開発用パッケージで、内部名は `dsh-market-integration` です。npm には未公開です。

## インストール

Windows、Node.js 24+、PATH 上の pnpm、DSH **0.1.5-rc.2** が必要です。実行時依存の取得には npm への接続も必要です。対象の DSH を停止して公式 CLI を実行します。

```powershell
dsh plugin --profile web add "C:\Downloads\dsh-market-integration-0.1.0.tgz" --ignore-scripts --registry=https://registry.npmjs.org
dsh web
```

実際のファイルのパスに置き換えてください。対象は `web` profile です。サイドバーの **扩展市场** を開き、**设置** で表示言語を選択します。同じ環境でソース版を重複して読み込まないでください。

## 利用できる機能

6 種類の閲覧、作者の文書、お気に入りと下書き、投稿ファイルの出力、DSH の下書きへの Prompt 追記が利用できます。固定版 npm 拡張は確認後に公式 CLI で導入・削除し、完了後に再起動します。標準コンポーネントには任意の dsh-std アダプターを別途導入します。Skill 読み込み、MCP 接続、汎用 Slash 実行、テーマ適用は開発中です。

「GitHub 接続」で読み取り用トークンを設定できます。Windows で暗号化して `DSH_HOME/community/private/` に保存し、GitHub API GET のみに使用します。翻訳には DSH に設定して明示的に選んだモデルを使い、有料 Token を消費する場合があります。

## 削除とデータ

DSH を停止し、`dsh plugin --profile web remove dsh-market-integration` を実行して再起動します。サーバー側データは `DSH_HOME/community/` に、ブラウザーのお気に入りと下書きはサイトデータに残ります。削除しても GitHub トークンは失効しません。

## 権利とサポート

独自コードは MIT ライセンスです。第三者の内容、依存関係、ブランドには各自の権利と条件が適用されます。DeepSeek の公式製品ではなく、保証はありません。ライセンス、免責事項、第三者表示、フロントエンドに組み込んだ依存関係のライセンスを同梱しています。

不具合、帰属表示の修正、作者による掲載取り下げは [Issues](https://github.com/QT7-C23/DSH-Marketplace/issues) へご連絡ください。ソースと開発文書は [DSH-Marketplace](https://github.com/QT7-C23/DSH-Marketplace) にあります。
