# StudyQuest

---

## 概要

**StudyQuest** は、小中学校向けのゲーミフィケーション型課題管理・学習支援 Webアプリです。
Google Workspace（Drive／Spreadsheet／Apps Script）を活用し、以下の仕組みでリアルタイムなデータ管理と学習体験を提供します。

* **教師側**: 課題作成・配信、進捗可視化、AI フィードバック管理
* **生徒側**: XP／レベル／トロフィーによる動機づけ、クエスト形式の学習フロー
* **AI支援**: Gemini API と連携し、教師のクエスト作成支援。適宜ヒントや深掘り質問を生成

---

## フォルダ構成

```txt
StudyQuest_<TeacherCode>/
├── StudyQuest_DB_<TeacherCode># Central Google Spreadsheet
│   ├── Tab: TOC
│   ├── Tab: Tasks
│   ├── Tab: Students
│   ├── Tab: Submissions
│   ├── Tab: AI_Log
│   ├── Tab: Settings
│   └── Tab: student_<StudentID>
└── Apps Script project files
```

* **StudyQuest\_DB**

  * 単一スプレッドシートに全データを集約。
* **Apps Script プロジェクト**

  * ウェブアプリケーションとしてデプロイされるサーバーサイドのスクリプト。
  * ユーザーの個別 Drive フォルダには配置されず、Web アプリのコンテナ（Google Apps Script のプロジェクト）として管理。
  
---

## スプレッドシート構造

### 1. 目次（説明用タブ）

| セクション     | 説明                           |
| --------- | ---------------------------- |
| 主要シート一覧   | 各タブの役割・概要                    |
| 生徒の個別回答ログ | 生徒\_<StudentID> シートの命名規則と列定義 |

---

### 2. 主要タブ一覧

#### 2.1 Tasks (master)

| Col | Name | Type | Description |
| - | -------------- | ---------- | ----------- |
| A | TaskID | string | unique task ID |
| B | ClassID | string | target class ID |
| C | Payload (JSON) | JSON | `{ subject, question, type, choices?, followup? }` |
| D | AllowSelfEval | TRUE/FALSE | whether self evaluation allowed |
| E | CreatedAt | datetime | publish time |
| F | Status | string | `open` or `closed` |
#### 2.2 Students（生徒マスタ）

| 列 | 項目名         | 型    | 説明                    |
| - | ----------- | ---- | --------------------- |
| A | 生徒ID        | 文字列  | `"6-1-04"` 形式の一意 ID   |
| B | 学年          | 数値   | 1 〜 6                 |
| C | 組           | 文字列  | `"1組"` など             |
| D | 番号          | 数値   | 出席番号                  |
| E | 初回ログイン日時    | 日付時刻 | 最初のログイン               |
| F | 最終ログイン日時    | 日付時刻 | 最後のログイン               |
| G | 累計ログイン回数    | 数値   | ログイン総回数               |
| H | 累積XP        | 数値   | 獲得した XP 合計            |
| I | 現在レベル       | 数値   | 現在のレベル                |
| J | 最終獲得トロフィーID | 文字列  | 最後に得たトロフィー（複数はカンマ区切り） |

#### 2.3 Submissions（学習ログ）

| 列 | 項目名    | 型    | 説明                    |
| - | ------ | ---- | --------------------- |
| A | 生徒ID   | 文字列  | Students!A への外部キー     |
| B | 課題ID   | 文字列  | Tasks!A への外部キー        |
| C | 問題文    | テキスト | 生徒に提示した質問文            |
| D | 開始日時   | 日付時刻 | 学習開始時刻                |
| E | 提出日時   | 日付時刻 | 回答送信時刻                |
| F | 成果物URL | 文字列  | 回答成果物へのリンク            |
| G | 問題概要   | 文字列  | 質問文の要約（カンマ区切り）        |
| H | 回答概要   | 文字列  | 生徒の回答要約（カンマ区切り）       |
| I | 付与XP   | 数値   | この提出で付与した XP          |
| J | 累積XP   | 数値   | 提出後の累積 XP             |
| K | レベル    | 数値   | 提出後のレベル               |
| L | トロフィー  | 文字列  | 獲得トロフィー ID（複数はカンマ区切り） |
| M | ステータス    | 数値 | クエストが未完了か、完了済みか。               |

#### 2.4 AIフィードバックログ

| 列 | 項目名          | 型    | 説明                        |
| - | ------------ | ---- | ------------------------- |
| A | LogID        | 自動採番 | 一意のログ ID                  |
| B | SubmissionID | 文字列  | Submissions!A への外部キー      |
| C | フィード内容       | テキスト | Gemini API から取得したヒントやコメント |
| D | 生成日時         | 日付時刻 | API 呼び出し日時                |

#### 2.5 Settings（各種設定）

| 列 | 項目名    | 型   | 説明                    |
| - | ------ | --- | --------------------- |
| A | type   | 文字列 | 設定の種類（例: `classList`） |
| B | value1 | 文字列 | 設定値1                  |
| C | value2 | 文字列 | 設定値2（必要時）             |

---

### 3. 生徒\_<StudentID>（個別回答ログ）

* **シート名**: `生徒_<StudentID>`
* **列定義**:

| 列 | 項目名   | 型    | 説明             |
| - | ----- | ---- | -------------- |
| A | 日時    | 日付時刻 | 回答日時           |
| B | 課題ID  | 文字列  | Tasks!A への外部キー |
| C | 課題内容  | テキスト | 質問文            |
| D | 回答本文  | テキスト | 生徒が入力した回答      |
| E | 付与XP  | 数値   | この回答で付与された XP  |
| F | 累積XP  | 数値   | 回答後の累積 XP      |
| G | レベル   | 数値   | 回答後のレベル        |
| H | トロフィー | 文字列  | 獲得トロフィー ID     |
| I | 回答回数  | 数値   | 同一課題への回答回数     |

---

## 開発ガイドライン

1. **データ操作**

   * 全ての読み書きは `SpreadsheetApp` 経由で一貫して行うこと。
   * クエリ関数（`QUERY`）やフィルターは可能な限りシート側で処理し、Apps Script は CRUD ロジックに集中。

2. **スクリプト構造**

   * 各機能（課題、提出、AI 呼び出し、生徒管理）はモジュール／ファイル単位で分割（例: `Task.gs`, `Student.gs`）。
   * 共通ユーティリティは `Utils.gs` にまとめる。

3. **HTML テンプレート**

   * 共通パーツ（ヘッダー／フッター／アイコン読み込み）は `include()` で管理。
   * UI フレームワークは TailwindCSS、アニメーションは GSAP、アイコンは Lucide を使用。

4. **Gemini API キー管理**

   * スクリプトプロパティに 保存。
   * 設定関数: `setGlobalGeminiApiKey`, `getGlobalGeminiApiKey` を利用。

5. **CI／CD**

   * GitHub Actions で `main` ブランチへの push をトリガーに `clasp push` → `clasp deploy` を自動実行。
   * 必要シークレット: `CLASPRC_JSON`, `DEPLOYMENT_ID`

---

## セットアップ手順

1. リポジトリのクローン

   ```bash
   git clone <リポジトリURL>
   cd studyquest
   ```

2. clasp のインストールと認証

   ```bash
   npm install -g @google/clasp
   clasp login
   # プロジェクトの .clasp.json を設定
   ```

3. 依存ライブラリのインストール

   ```bash
   npm install
   ```

4. Drive API、Sheets APIの有効化（必要に応じて Apps Script エディタから追加）

---

## テスト実行

1. 依存ライブラリのインストール

```bash
npm install
# Codex 環境では scripts/setup-codex.sh
```

2. テストの実行

```bash
npm test
```

---

この README をもとに、設計方針とデータ定義を正しく実装してください。何か不明点があれば随時ドキュメントを更新し、共有をお願いします。
