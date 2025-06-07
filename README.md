# StudyQuest

> 小学校向けゲーミフィケーション型課題管理・学習支援ウェブアプリ

## 1. プロジェクト概要

**StudyQuest** は、Google Workspace（Drive, Spreadsheet, Apps Script）を活用し、
小学校の生徒向けにゲーミフィケーション要素を取り入れた課題管理・学習支援を実現するWebアプリです。

- **教師側**: テンプレートフォルダとスプレッドシートを自動生成し、課題の作成・配信・統計分析を行う管理パネルを提供
- **生徒側**: XPバー、レベル、トロフィーなどでモチベーションを可視化し、未回答クエストの閲覧・回答送信を行うクエストボードを提供
- **回答ボード**: 全体回答ログをリアルタイムに閲覧できる共有ボード機能
- **AIフィードバック**: Gemini API連携でヒントや気づきを提示（課題ごと2回まで）

## 2. 機能要件

### 2.1 教師モード（`manage.html`）

1. **ログイン／初期設定**
   - パスコード入力（固定: `kyoushi`）
   - `initTeacher(passcode)` 呼び出し
   - 初回: `StudyQuest_<TeacherCode>` フォルダ、各クラス用スプレッドシート自動生成
   - 2回目以降: スクリプトの設定が残っていない場合でも My ドライブ直下から
     `StudyQuest_<TeacherCode>` フォルダを検索して既存コードを復元

2. **管理パネル**
   - 課題作成フォーム: クラス選択、科目、問題文、回答タイプ、Gemini設定
   - 課題一覧カード: 編集・削除機能、統計情報取得
   - 主なGAS呼び出し: `createTask`, `listTasks`, `deleteTask`, `getStatistics`


### 2.2 生徒モード（`input.html`）

1. **ログイン／初期設定**
   - 教師コード、学年、組、番号を入力してバリデーション
   - `initStudent(...)` 呼び出しで専用クエストボード初期化

2. **クエストボード画面**
   - XPバー + レベル表示
   - 未回答／完了済みクエスト一覧
   - 回答入力エリア、AIフィードバックボタン、履歴表示
   - 主なGAS呼び出し: `listTasks`, `getStudentHistory`, `submitAnswer`, `callGeminiAPI_GAS`


### 2.3 回答ボード（`board.html`）

- 教師コードを渡して全体回答ログを取得 (`listBoard(teacherCode)`)し、カードグリッドで表示

## 3. データ構造とキャッシュ設計

- **1 ファイル完結構成**: `StudyQuest_<TeacherCode>_Log` スプレッドシート
  - `_cache_data_<classId>` タブ: クラス別キャッシュ
  - `summary` タブ: 集計データ
  - `生徒_<ID>` タブ: 学習履歴

- **バッチ更新**: 深夜 1 時の時間駆動トリガーで `exportCacheToTabs()` を実行
- **手動更新**: 管理画面にキャッシュ更新ボタンを配置

## 4. 技術スタック

- Google Apps Script (GAS)
- HTML + TailwindCSS + GSAP (フロントエンド)
- Gemini API (AIフィードバック)
- GitHub Actions + clasp (CI / CD)

## 5. セットアップ

1. **リポジトリをクローン**
```bash
   git clone <リポジトリURL>
   cd studyquest
````

2. **Clasp 認証**

   ```bash
   npm install -g @google/clasp
   clasp login --creds <path/to/credentials.json>
   ```

3. **.clasp.json 設定**

   ```json
   {
     "scriptId": "<GAS Script ID>",
     "rootDir": "src"
   }
   ```

4. **package.json の deploy スクリプト**

   ```json
   "scripts": {
     "deploy": "clasp push --force && clasp deploy --deploymentId $DEPLOYMENT_ID"
   }
   ```

5. **GitHub Actions シークレット設定**

   * `CLASPRC_JSON`: clasp の認証情報
   * `DEPLOYMENT_ID`: デプロイ先の Deployment ID

6. **依存インストール**

   ```bash
   npm install
   ```

## 6. CI / CD (GitHub Actions)

`.github/workflows/deploy.yml`:

```yaml
name: deploy-gas-webapp
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      CLASPRC_JSON: ${{ secrets.CLASPRC_JSON }}
      DEPLOYMENT_ID: ${{ secrets.DEPLOYMENT_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm test        # プルリクエストでのテスト実行
      - run: npm install -g @google/clasp
      - name: Configure clasp
        run: |
          echo "$CLASPRC_JSON" > ~/.clasprc.json
      - run: npm run deploy
```

## 7. テスト

* `tests/` フォルダに Jest または Mocha テストを配置
* `npm test` でユニットテストを実行

## 8. 開発ガイドライン

* **Apps Script WebApp**: `executeAs: USER_ACCESSING`, `access: ANYONE` か `DOMAIN`
* **OAuth Scope**: drive.file, scripts.external\_request など最小権限
* **フォルダ操作**: Advanced Drive Service (`Files.list`) を推奨
* **キャッシュ更新**: UIをブロックしない非同期実行
* **フロントエンド構造**: `include()` で共通パーツをDRY化

