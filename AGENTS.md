# AGENTS.md

このファイルは OpenAI Codex エージェントの利用ガイドです。StudyQuest プロジェクトでの環境構築からデプロイ、テスト、CI 設定までをまとめています。

## 📁 プロジェクト構造

```
/
├── src/                     # GAS スクリプト (Code.gs など)
├── tests/                   # ローカルテスト用スクリプト
├── scripts/                 # デプロイ／ビルド用
├── .clasp.json              # clasp 設定
├── appsscript.json          # GAS プロジェクト設定
└── AGENTS.md                # 本ドキュメント
```

## ▶ 環境構築

```bash
# clasp インストール
npm install -g @google/clasp

# 認証（初回のみ）
clasp login

# プロジェクトクローン／プッシュ
clasp clone <SCRIPT_ID>
clasp push
```

## ▶ デプロイ手順

```bash
# 本番デプロイ
clasp deploy --deploymentId <DEPLOYMENT_ID>

# 新規バージョン作成 & エイリアス設定
clasp version "v1.0.0"
clasp deploy --versionNumber 1 --deploymentId <DEPLOYMENT_ID>
```

## ▶ テスト実行

```bash
# ローカル単体テスト
npm test

# または Codex 環境では
scripts/setup-codex.sh

# 変更をGASに反映して確認
clasp push && clasp open
```

## ▶ コーディング規約

- 必要に応じて、ファイルは `Code.gs`、`Utils.gs` など役割ごとに分割
- 関数名は `camelCase`
- コメントは JSDoc 形式 (`/** ... */`)
- 学習データはすべて中央の `StudyQuest_DB` に集約して管理する。

## ▶ CI/CD

- GitHub Actions: `.github/workflows/gas-deploy.yml`
  - `clasp push` と `clasp deploy` を自動実行
- PR テンプレート: `.github/PULL_REQUEST_TEMPLATE.md`

## ▶ その他

- Codex 無効化: `--no-project-doc` または `CODEX_DISABLE_PROJECT_DOC=1`
- clasp のエイリアス機能で開発版／本番版を使い分け可能
