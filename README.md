# StudyQuest

## 1. プロジェクト概要

**1.1 プロジェクト名**
StudyQuest（仮称） – 小学校向けゲーミフィケーション型課題管理・学習支援ウェブアプリ

**1.2 背景・目的**

* **背景**

  * 小学校における生徒の課題（クエスト）管理と学習意欲向上のため、ゲーミフィケーション要素を取り入れたWebアプリ導入を検討。
  * 既存のGoogle Workspace（Drive、Spreadsheet、Apps Script）を活用し、低コストかつ柔軟に運用できるシステムを構築。
  * 生徒が自ら進んで課題に取り組み、教師側は進捗と学習履歴を一元管理したい。

* **目的**

  1. **教師側**は「教師コード（6桁英数字）」を取得／入力し、自動生成された専用フォルダ・スプレッドシート上で課題の作成・配信・統計分析が可能。
  2. **生徒側**は教師から共有された「教師コード」と「学年・組・番号」を入力し、自分専用の“クエストボード”画面から未回答クエストを確認し、回答を送信できる。回答ごとにXPが加算され、XPバーやレベル、獲得トロフィーを可視化。
  3. **回答ボード**機能を通じて、他の生徒の取り組みや教師のフィードバック状況をリアルタイムに把握可能。
  4. \*\*Google Apps Script（GAS）\*\*をバックエンド処理として用い、データはGoogle Spreadsheetに保存。Webアプリとして動作する。
  5. \*\*AIフィードバック機能（Gemini API連携）\*\*を実装し、児童の回答に対してゲーム的な演出でヒントや気づきを提供。

---

## 開発環境セットアップ

`npm test` を実行する前に、必ず依存パッケージをインストールしてください。

```bash
npm install        # 通常環境
# または Codex 環境では
scripts/setup-codex.sh
```

---

## 2. ステークホルダー（ユーザー）

1. **教師（管理者）**

   * 初回ログイン時：「kyoushi」を入力 → Google Drive上に `StudyQuest_<TeacherCode>` フォルダを自動作成。
   * 2回目以降ログイン：教師コードのみで既存フォルダ／シートにアクセス。
   * 各学年・各クラスごとに独立したスプレッドシート（データベース）を持つ。
   * 課題の作成・編集・削除、統計情報の参照、生徒一覧管理、グローバル回答ボードの閲覧などを行う。

2. **生徒（利用者）**

   * ログイン時に教師コード・学年（1～6）・組（英字1文字）・番号（1～99）を入力。

   * 未回答クエストをカード表示で確認し、回答を送信。

   * 回答ごとに「付与XP」「累積XP」「レベル」「獲得トロフィー」を自動計算し、可視化。

   * AIフィードバックは各課題につき2回まで、課題への回答チャンスは最大3回。

3. **ソーシャルゲームクリエイター（デザインコンサル）**

   * ゲーム的なUI/UX設計のアドバイスを提供。

---

## 3. 概要機能要件

### 3.1 教師モード（管理パネル：`manage.html`）

#### 3.1.1 ログイン／初期設定

* **入力項目**

  * パスコード（固定：`kyoushi`）
* **処理フロー**

  1. パスコード検証後、`initTeacher(passcode)`を実行。
  2. 初回ログイン：フォルダを自動生成し、教師コードを返却。
  3. 2回目以降ログイン：既存コードを取得し、ダッシュボードへ遷移。

#### 3.1.2 管理パネル（`manage.html`）

* **画面構成**

  * ヘッダー：ロゴ、教師コード表示、Gemini API設定など
  * メイン：課題作成フォーム（教科選択、問題文、回答タイプ、Gemini設定）／課題一覧カード

* **主要GAS呼び出し**

  * `createTask(...)`, `listTasks(...)`, `deleteTask(...)`, `getStatistics(...)`

---

### 3.2 生徒モード（クエストボード：`input.html`）

#### 3.2.1 ログイン／初期設定

* **入力項目**
  教師コード、学年、組、番号
* **処理フロー**

  1. クライアントでバリデーション
  2. 教師コードのあるDriveフォルダで検索／作成 → `initStudent(...)` 呼び出し
  3. `Student_<ID>`シートの初期化または再利用

#### 3.2.2 クエストボード画面

* **画面構成**

  * XPバー＋レベル表示
  * 未回答／完了済みクエスト一覧＋詳細・入力エリア
  * AIフィードバックボタン、履歴表示ボタン、回答制限表示

* **主要GAS呼び出し**

  * `listTasks(...)`, `getStudentHistory(...)`, `submitAnswer(...)`, `callGeminiAPI_GAS(...)`

---

### 3.3 回答ボード（`board.html`）

* `listBoard(teacherCode)` → 全体回答ログ取得 → カードグリッド表示（自動更新）

---

## 4. データ取得とキャッシュ (最終設計)

```
Drive/
└── StudyQuest_<TeacherCode>_Log  (Spreadsheet)
    ├── 既存のデータシート群
    ├── _cache_data_<classId>  (hidden)
    ├── summary               (hidden)
    └── 生徒_<ID>              (履歴保持)
```

キャッシュはすべてスプレッドシート内の隠しタブに集約し、CSV/JSON ファイルを生成せずに済む構成とする。

### A. キャッシュをスプレッドシート内タブで一元化

- `teacher_data` / `student_data` フォルダは不要。
- 各クラスのデータシートを `_cache_data_<classId>` に複製。
- `summary.csv` 相当の内容は `summary` タブで管理。
- 1 ファイル完結のため Drive 操作が減り、権限設定や誤削除リスクを低減。

### B. 生徒履歴の管理

- `history.json` を廃止し、`生徒_<ID>` シートに履歴を保持。
- 外部ファイルを扱わないことで可用性とセキュリティを向上。

### C. バッチ・トリガーの簡素化

- 夜間 (例: 深夜 1 時) の時間駆動型トリガーで `exportCacheToTabs()` を実行し、全クラスのキャッシュタブと `summary` を更新。
- クラス数が多い場合はループを分割して実行時間 (6 分) に収める。
- 管理画面から手動で同関数を呼び出す "キャッシュ更新" ボタンも用意可能。

### D. クライアント取得方法

```javascript
// classId ごとに複数 fetch する必要はない
const cacheValues = google.script.run
  .withSuccessHandler(renderCache)
  .getCacheData(teacherCode, classId);
```

クライアントは Apps Script から返却されるキャッシュデータを描画するだけで済み、ネットワーク負荷を抑えられる。

```javascript
function exportCacheToTabs() {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  Object.keys(classIdMap).forEach(id => {
    const sheetName = `_cache_data_${id}`;
    const cacheSheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    cacheSheet.clear();
    const src = getSheetByClassId(id);
    const values = src.getDataRange().getValues();
    cacheSheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    cacheSheet.hideSheet();
  });
  // summary タブも同様に更新
}
```

---

## 5. GitHub Actions による GAS デプロイ

* `.github/workflows/deploy.yml` で `main` への push をトリガーに `clasp push`／`clasp deploy` を実行。
* 必要シークレット：`CLASPRC_JSON`, `DEPLOYMENT_ID`

---

以上。README をご確認ください。

---

## 6. 技術的指示

以下の技術的要件を満たすよう実装してください。

1. **Apps Script ウェブアプリ設定**

   * `appsscript.json` の `webapp` 設定を適切に構成し、`executeAs`: `USER_ACCESSING`、`access`: `ANYONE` もしくは `DOMAIN` に設定。
   * OAuth スコープは最小限（`drive.file`, `scripts.external_request` など）を指定。

2. **Clasp 設定**

   * `.clasp.json` に `scriptId` と `rootDir` を明示。
   * `package.json` に `deploy` スクリプトを追加：

     ```json
     "scripts": {
       "deploy": "clasp push --force && clasp deploy --deploymentId $DEPLOYMENT_ID"
     }
     ```

3. **フォルダ操作**

   * `DriveApp` ではなく、可能な限り `Advanced Drive Service` (Drive API) を利用し、エラー時の詳細ログをキャッチ。
   * フォルダ検索は `Drive` サービスの `Files.list` メソッドで `q: "name='StudyQuest_<TeacherCode>' and mimeType='application/vnd.google-apps.folder'"` を用いる。

4. **データキャッシュ**

   * CSV/JSON 出力関数は非同期的に実行し、ユーザー操作をブロックしない（Promise パターン or コンソールログで完了通知）。

5. **フロントエンド**

   * `manage.html`, `input.html`, `board.html` は各々のスクリプトタグで `include('...')` を利用し、コードのDRY化を図る。
   * UI コンポーネントは TailwindCSS + GSAP で実装し、共通コンポーネント化を検討。

6. **テスト**

   * Node.js 環境下で `npm test` が実行できるよう、`tests/` フォルダを整備し、`jest` または `mocha` でユニットテストを記述。
   * テスト実行前に `npm install` で依存パッケージをインストールしてください。Codex 環境では `scripts/setup-codex.sh` を実行すると自動でインストールされます。

7. **CI 設定**

   * GitHub Actions (`deploy.yml`) に `clasp version` を追加して自動バージョン管理。
   * プルリクエストごとに `npm test` が実行されるジョブを定義。
