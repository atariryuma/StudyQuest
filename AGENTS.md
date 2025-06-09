# StudyQuest 統合システム仕様書 v4.3

---

## 1. システムアーキテクチャ仕様書

### 1.1. システム構成
* **実行環境:** Google Apps Script (GAS)
* **アプリケーションロジック:** Server-side JavaScript (GAS `*.gs` files)
* **データストレージ:** Google Spreadsheet
* **UI:** GAS `HtmlService` (HTML, CSS, Client-side JavaScript)
* **ファイルストレージ:** Google Drive
* **AIサービス:** Google Gemini API

### 1.2. レイヤー構造
本システムは以下の4層構造で構成される。

| レイヤー | コンポーネント | 責務 |
| :--- | :--- | :--- |
| **Frontend (Client)** | `HtmlService` (HTML, JS, CSS) | UIレンダリング、ユーザー入力の受付、`google.script.run`によるBackend APIコール |
| **Backend (Server)** | Google Apps Script (`.gs`) | ビジネスロジックの実行、データ処理、他レイヤーとの通信制御 |
| **Data Layer** | Google Spreadsheet | データの永続化。リレーショナルデータベースとして機能する。 |
| **AI Service Layer** | Gemini API | AIによるコンテンツ生成、テキスト要約などの機能提供 |

### 1.3. データベースアーキテクチャ
本システムのデータ永続化層は、**2階層データベースモデル**を採用する。

* **第1階層: グローバルマスターDB (`StudyQuest_Global_Master_DB`)**
    * **インスタンス数:** システム全体で**1つ**のみ。
    * **役割:** 全ユーザーの永続的な情報を一元管理する **Single Source of Truth (SSoT)**。
    * **管理対象:** `Global_Users` (プロフィール), `Global_TotalXP`, `Global_Level`, `Global_Trophies_Log`, `Global_Items_Inventory`

* **第2階層: 教師別DB (`StudyQuest_DB_<TeacherCode>`)**
    * **インスタンス数:** 各教師アカウントに対し**1つ**生成。
    * **役割:** 各教師が運営するクラス固有の情報を管理する。
    * **管理対象:** `Enrollments` (在籍名簿), `Tasks` (課題), `Submissions` (提出ログ), `Leaderboard` (ランキング)

### 1.4. 関係性
```
[Global_Master_DB] (1)
  |
  +-- Global_Users (Email as PK)
      |
      +-----------------------------+
                                    |
[Teacher_DB_A] (N) <--(1)---(N)---> [Teacher_DB_B] (N)
  |                                   |
  +-- Enrollments (Email as FK)       +-- Enrollments (Email as FK)
  |                                   |
  +-- Tasks / Submissions             +-- Tasks / Submissions
```
* **外部キー:** `TeacherDB.Enrollments.UserEmail` は `Global_Users.Email` を参照する。
* **データフロー:** ユーザーの成長記録は`Global_Master_DB`に集約され、クラスへの所属情報は各`Teacher_DB`に分散される。

### 1.5. 通信プロトコル
* **Client ⇔ Server:** `google.script.run` を使用した非同期呼び出し。
* **Server ⇔ Data Layer:** `SpreadsheetApp` Service を使用。I/Oは`getValues()`/`setValues()`によるバッチ処理を原則とする。
* **Server ⇔ AI Service Layer:** `UrlFetchApp` Service による `HTTP POST` リクエスト。

---

## 2. データモデル仕様書

### 2.1. グローバルマスターDB テーブル定義

#### `Global_Users` (全ユーザーマスタ)
| Col | Name | Type | Constraints | Description |
|---|---|---|---|---|
| A | **Email** | string | Primary Key, Unique | Googleアカウントのメールアドレス |
| B | HandleName | string | Not Null | ユーザーのニックネーム |
| C | Role | string | `student` or `teacher` | ユーザーの役割 |
| D | Global_TotalXP | number | Default: 0 | 全クラスで獲得したXPの合計値 |
| E | Global_Level | number | Default: 0 | `Global_TotalXP`から算出される永続レベル |
| F | Global_Coins | number | Default: 0 | 全クラスで獲得したコインの合計値 |
| G | EquippedTitle | string | Nullable | 現在装備している称号 |
| H | CreatedAt | datetime | Not Null | 初回登録日時 |
| I | LastGlobalLogin | datetime | Not Null | 最終ログイン日時 |
| J | LoginStreak | number | Default: 1 | 連続ログイン日数 |

#### `Global_Trophies_Log` (全トロフィー獲得ログ)
| Col | Name | Type | Constraints | Description |
|---|---|---|---|---|
| A | **UserTrophyID** | string | Primary Key, Unique | 一意の獲得ID |
| B | UserEmail | string | Foreign Key → `Global_Users.Email` | ユーザーEmail |
| C | TrophyID | string | Foreign Key → `(TeacherDB).Trophies.TrophyID` | トロフィーID |
| D | AwardedAt | datetime | Not Null | 獲得日時 |

#### `Global_Items_Inventory` (全アイテム所持インベントリ)
| Col | Name | Type | Constraints | Description |
|---|---|---|---|---|
| A | **UserItemID** | string | Primary Key, Unique | 一意の所持ID |
| B | UserEmail | string | Foreign Key → `Global_Users.Email` | ユーザーEmail |
| C | ItemID | string | Foreign Key → `(TeacherDB).Items.ItemID` | アイテムID |
| D | Quantity | number | Not Null, Default: 1 | 所持数 |
| E | AcquiredAt | datetime | Not Null | 初回獲得日時 |

### 2.2. 教師別DB テーブル定義

#### `Enrollments` (在籍名簿)
| Col | Name | Type | Constraints | Description |
|---|---|---|---|---|
| A | **UserEmail** | string | Composite Primary Key (w/ TeacherCode), FK | ユーザーEmail (→ `Global_Users.Email`) |
| B | ClassRole | string | `student` or `main_teacher` | クラス内での役割 |
| C | Grade | number | Nullable | クラス内での学年 |
| D | Class | number | Nullable | クラス内での組 |
| E | Number | number | Nullable | クラス内での出席番号 |
| F | EnrolledAt | datetime | Not Null | クラスへの登録日時 |

#### `Tasks` (課題マスタ)
| Col | Name | Type | Constraints | Description |
|---|---|---|---|---|
| A | **TaskID** | string | Primary Key, Unique | 課題ID |
| B | Title | string | Not Null | 課題のタイトル |
| C | Subject | string | Nullable | 科目 |
| D | Question | text | Not Null | 問題文 |
| E | Type | string | `multiple_choice` or `free_text` | 問題形式 |
| F | Choices | JSON string | Nullable | 選択肢の配列 |
| G | Difficulty | string | `easy`, `normal`, `hard` | 難易度 |
| H | TimeLimit | number | Nullable | 制限時間（秒） |
| I | XpBase | number | Default: 0 | 基本XP |
| J | Status | string | `draft`, `open`, `closed` | 課題ステータス |
| K | CreatedAt | datetime | Not Null | 作成日時 |
| L | CorrectAnswer | string | Not Null | 問題の正解 |
| M | Explanation | text | Nullable | 正解に対する解説文 |
| N | IsAiGenerated | boolean | Not Null, Default: false | AI生成フラグ |

#### `Submissions` (回答ログ)
| Col | Name | Type | Constraints | Description |
|---|---|---|---|---|
| A | **SubmissionID** | string | Primary Key, Unique | 提出ID |
| B | UserEmail | string | Foreign Key → `Global_Users.Email` | ユーザーEmail |
| C | TaskID | string | Foreign Key → `Tasks.TaskID` | 課題ID |
| D | Answer | text | Not Null | 回答内容 |
| E | EarnedXP | number | Not Null | 獲得した合計XP |
| F | Bonuses | JSON string | Nullable | 獲得XPの内訳 |
| G | SubmittedAt | datetime | Not Null | 提出日時 |
| H | AiSummary | text | Nullable | AIによる自由記述回答の要約 |

#### `Trophies` (トロフィーマスタ)
| Col | Name | Type | Constraints | Description |
|---|---|---|---|---|
| A | **TrophyID** | string | Primary Key, Unique | トロフィーID |
| B | Name | string | Not Null | トロフィー名 |
| C | Description | text | Not Null | 獲得条件の説明 |
| D | IconURL | string | Nullable | アイコンのURLやID |
| E | Condition | JSON | Not Null | 獲得条件定義 |

#### `Items` (アイテムマスタ)
| Col | Name | Type | Constraints | Description |
|---|---|---|---|---|
| A | **ItemID** | string | Primary Key, Unique | アイテムID |
| B | Name | string | Not Null | アイテム名 |
| C | Type | string | `title`, `consumable`, etc. | アイテム種別 |
| D | Price | number | Default: 0 | 購入に必要なコイン |
| E | Effect | JSON | Not Null | アイテムの効果定義 |

#### `Leaderboard` (ランキング)
*Note: このシートはバッチ処理によって定期的に再生成される。永続的なデータソースではない。*
| Col | Name | Type | Description |
|---|---|---|---|
| A | Rank | number | 順位 |
| B | UserEmail | string | ユーザーEmail |
| C | HandleName | string | ニックネーム |
| D | Level | number | グローバルレベル |
| E | TotalXP | number | グローバルXP |
| F | UpdatedAt | datetime | ランキング更新日時 |

---

## 3. 認証・ログインフロー仕様書

### 3.1. 概要
本ドキュメントは、システムアーキテクチャ仕様書v4.2で定義された認証とログインに関するプロトコルを定義する。

### 3.2. 認証基本設計
* **認証基盤:** Google OAuth 2.0
* **認証キー (SSoT):** `Session.getEffectiveUser().getEmail()` から取得されるGoogleアカウントのメールアドレス。
* **認証フロー:** 全ての認証リクエストはクライアントサイドの `google.script.run` を介してトリガーされ、サーバーサイドのGAS関数で処理される。

### 3.3. 教師ログインフロー
#### `setupInitialTeacher(secretKey)`
* **目的:** 新規教師アカウントの初回セットアップとリソース生成。
* **トリガー:** フロントエンドの初回セットアップUIから実行。
* **Input:**
    * `secretKey` (string): サーバーサイドにハードコードされた共通秘密鍵。
* **Process:**
    1. `secretKey`を検証。一致しない場合はエラーを返し処理を中断。
    2. `Session.getEffectiveUser().getEmail()`で`email`を取得。
    3. `PropertiesService`で`teacherCode_<email>`の存在を確認。存在する場合はエラー (`already_exists`) を返す。
    4. `teacherCode`を生成 (`<6桁の英数>`)。
    5. `DriveApp.createFolder("StudyQuest_<teacherCode>")` を実行。
    6. `SpreadsheetApp.create("StudyQuest_DB_<teacherCode>")` を実行し、生成したフォルダに移動。
    7. 生成したDBの`Settings`シートに`{Key: "ownerEmail", Value: <email>}`を書き込む。
    8. `PropertiesService`に以下を保存:
        * `teacherCode_<email>`: `<teacherCode>`
        * `ssId_<teacherCode>`: `<Spreadsheet ID>`
* **Output:** `{ status: "ok", teacherCode: <string> }` or `{ status: "error", message: <string> }`

#### `loginAsTeacher()`
* **目的:** 既存教師のログイン認証。
* **トリガー:** フロントエンドの「教師としてログイン」UIから実行。
* **Input:** (none)
* **Process:**
    1. `Session.getEffectiveUser().getEmail()`で`email`を取得。
    2. `PropertiesService`から`teacherCode_<email>`をキーに`teacherCode`を取得。
    3. `teacherCode`が取得できた場合、`processLoginBonus(email)`を呼び出す。
* **Output:**
    * **Success:** `{ status: "ok", teacherCode: <string> }`
    * **Failure:** `{ status: "not_found" }`

### 3.4. 生徒ログインフロー
#### `loginAsStudent(teacherCode)`
* **目的:** 既存生徒のクラスへのログイン認証。
* **トリガー:** フロントエンドの生徒用ログインUIから実行。
* **Input:**
    * `teacherCode` (string): 生徒が入力した教師コード。
* **Process:**
    1. `Session.getEffectiveUser().getEmail()`で`email`を取得。
    2. `teacherCode`から対象の`TeacherDB`の`SpreadsheetID`を`PropertiesService`経由で取得。IDが無効な場合はエラーを返す。
    3. `SpreadsheetApp.openById()`で`TeacherDB`にアクセス。
    4. `TeacherDB.Enrollments`シートを`getValues()`で全件取得し、`email`列を検索。
    5. `email`に一致する行が存在することを確認。存在しない場合はエラー (`not_found_in_class`) を返す。
    6. `processLoginBonus(email)`を呼び出す。
    7. `Global_Users`から永続データ (`globalData`) を、`Enrollments`からクラス固有データ (`classData`) を取得。
* **Output:**
    * **Success:** `{ status: "ok", userInfo: { globalData: {...}, classData: {...} } }`
    * **Failure:** `{ status: "error", message: <string> }`

### 3.5. 共通ロジック
#### `processLoginBonus(userEmail)`
* **目的:** ログインボーナスの付与と連続ログイン日数の更新。
* **トリガー:** `loginAsTeacher`, `loginAsStudent` の認証成功直後に内部的に呼び出される。
* **Input:**
    * `userEmail` (string): ログインしたユーザーのEmail。
* **Process:**
    1. `LockService`で`userEmail`をキーにしたロックを取得。
    2. `Global_Users`から`LastGlobalLogin`と`LoginStreak`を取得。
    3. `now = new Date()` と `lastLoginDate = new Date(LastGlobalLogin)` を比較。
    4. 連続ログイン日数を判定し、`newStreak`を計算（連続なら+1、途切れていれば1にリセット）。
    5. `Global_Users`シートの`LoginStreak`を`newStreak`で、`LastGlobalLogin`を`now`で更新。
    6. 同日ログインでない場合、コインボーナス (`5 + (newStreak % 7)`) を計算し、`Global_Coins`に加算。
    7. ロックを解放。
* **Output:** `void`

---

## 4. バックエンド仕様書

### 4.1. 概要
本ドキュメントは、システム仕様書v4.2で定義されたデータモデルに基づき、サーバーサイド（Google Apps Script）の全関数シグネチャ、処理フロー、およびAPIエンドポイントを定義する。

### 4.2. Core Services & Utilities (`Code.gs`, `Utils.gs`)
* **`doGet(e)`**
    * **Input:** `e` (Event Object)
    * **Process:** `e.parameter`を解析し、`page`クエリに応じて適切なHTMLテンプレートを`HtmlService.createTemplateFromFile().evaluate()`で返す。
    * **Output:** `HtmlOutput`
* **`getCurrentUserEmail()`**
    * **Input:** (none)
    * **Process:** `Session.getEffectiveUser().getEmail()`を実行する。
    * **Output:** (string) ユーザーのメールアドレス。
* **`getGlobalDb_()`**
    * **Process:** `PropertiesService`から`GLOBAL_DB_ID`をキーにスプレッドシートIDを取得し、`SpreadsheetApp.openById()`で開く。IDは`CacheService`でキャッシュする。
    * **Output:** `Spreadsheet` object
* **`getTeacherDb_(teacherCode)`**
    * **Process:** `PropertiesService`から`ssId_<teacherCode>`をキーにスプレッドシートIDを取得し、`SpreadsheetApp.openById()`で開く。IDは`CacheService`でキャッシュする。
    * **Output:** `Spreadsheet` object
* **`logError_(functionName, error)`**
    * **Process:** 指定された関数名とエラーオブジェクトを、単一のログ専用スプレッドシートに記録する。

### 4.3. 認証・ユーザー管理 (`Auth.gs`, `User.gs`)
* **`setupInitialTeacher(secretKey)`:**
    * **Input:** `secretKey` (string)
    * **Process:** 1. `secretKey`を検証. 2. `email`を取得. 3. `PropertiesService`で重複確認. 4. `teacherCode`生成. 5. Driveリソース(Folder, Spreadsheet)作成. 6. DB初期化. 7. `Settings.ownerEmail`と`PropertiesService`にIDを保存.
    * **Output:** `{ status: "ok", teacherCode: <string> }`
* **`loginAsTeacher()`:**
    * **Input:** (none)
    * **Process:** 1. `email`を取得. 2. `PropertiesService`から`teacherCode`を検索. 3. `processLoginBonus(email)`を呼び出し.
    * **Output:** `{ status: "ok", teacherCode: <string> }`
* **`loginAsStudent(teacherCode)`:**
    * **Input:** `teacherCode` (string)
    * **Process:** 1. `email`を取得. 2. `teacherCode`から`TeacherDB`を特定. 3. `TeacherDB.Enrollments`で在籍確認. 4. `processLoginBonus(email)`を呼び出し. 5. `Global_Users`と`Enrollments`からデータを取得.
    * **Output:** `{ status: "ok", userInfo: { globalData: {...}, classData: {...} } }`
* **`registerUsersFromCsv(teacherCode, csvData)`:**
    * **Input:** `teacherCode` (string), `csvData` (string)
    * **Process:** 1. `teacherCode`から`TeacherDB`を特定. 2. CSVをパースしループ処理. 3. 各行の`Email`で`Global_Users`を検索/作成. 4. `TeacherDB.Enrollments`を検索/作成.
    * **Output:** `{ status: "success", created: <int>, enrolled: <int> }`

### 4.4. 課題・提出管理 (`Task.gs`, `Submission.gs`)
* **`createTask(teacherCode, taskData)`:**
    * **Input:** `teacherCode` (string), `taskData` (Object: `Title`, `Subject`, etc.)
    * **Process:** 1. `TaskID`を生成. 2. `taskData`に`TaskID`, `CreatedAt`等を付与. 3. `TeacherDB.Tasks`シートに新しい行として追加.
    * **Output:** `{ status: "ok", taskId: <string> }`
* **`updateTask(teacherCode, taskId, updateData)`:**
    * **Input:** `teacherCode` (string), `taskId` (string), `updateData` (Object)
    * **Process:** 1. `TeacherDB.Tasks`で`taskId`の行を検索. 2. `updateData`の内容で該当行のセルを更新.
    * **Output:** `{ status: "ok" }`
* **`getTask(teacherCode, taskId)`:**
    * **Input:** `teacherCode`, `taskId`
    * **Process:** `TeacherDB.Tasks`から`taskId`に一致する行のデータを取得。
    * **Output:** (Object) タスクデータ
* **`processSubmission(teacherCode, userEmail, taskId, answer)`:**
    * **Input:** `teacherCode`, `userEmail`, `taskId`, `answer`
    * **Process:**
        1. 事前検証: `Tasks.Status`が`open`であることを確認。
        2. XP計算: ボーナスを含めた`totalEarnedXp`を算出。
        3. ログ記録:
            * `Submissions`シートに回答ログを追加。
            * `Tasks.Type`が`free_text`の場合、`summarizeStudentAnswer(answer)`を呼び出し、返り値を`Submissions.AiSummary`列に記録する。
        4. グローバルステータス更新: `LockService`で排他制御し、`Global_Users`の`Global_TotalXP`と`Global_Level`を更新。
        5. コイン獲得: `floor(totalEarnedXp / 10)`を計算し、`Global_Users.Global_Coins`に加算。
        6. 後続処理: `checkAndAwardTrophies`を呼び出す。
    * **Output:** `{ status: "ok", ..., correctAnswer: <string>, explanation: <string> }`

### 4.5. ゲーミフィケーションロジック (`Gamification.gs`)
* **`processLoginBonus(userEmail)`:**
    * **Input:** `userEmail`
    * **Process:** `LockService`下で、1. `LastGlobalLogin`と日付比較. 2. `LoginStreak`を更新. 3. `LastGlobalLogin`を更新. 4. 条件に応じてコインボーナスを`Global_Coins`に加算.
    * **Output:** `void`
* **`checkAndAwardTrophies(userEmail, context)`:**
    * **Input:** `userEmail`, `context` (Object)
    * **Process:** 1. 未獲得トロフィーリストを作成. 2. 各トロフィーの`Condition`を`context`と`currentUserData`を基に判定. 3. 条件を満たした場合、`Global_Trophies_Log`に記録.
    * **Output:** (Array of awarded `TrophyID`)
* **`purchaseItem(userEmail, itemId, quantity)`:**
    * **Input:** `userEmail`, `itemId`, `quantity`
    * **Process:** `LockService`下で、1. `Items.Price`から必要コインを計算. 2. `Global_Users.Global_Coins`の残高を検証. 3. コインを減算. 4. `addItemToInventory`を呼び出し.
    * **Output:** `{ status: "ok" }`
* **`generateLeaderboard(teacherCode)`:**
    * **Trigger:** Time-based (daily)
    * **Process:** 1. `TeacherDB.Enrollments`から対象生徒リストを取得. 2. `Global_Users`から全データを取得. 3. 対象生徒をフィルタリング. 4. `Global_TotalXP`で降順ソート. 5. `TeacherDB.Leaderboard`シートをクリアし、整形したデータを一括書き込み.
    * **Output:** `void`

### 4.6. AI Service Integration (`Gemini.gs`)
* **`callGeminiAPI_(prompt, schema)`:**
    * **Input:** `prompt` (string), `schema` (Object, optional)
    * **Process:** 1. `UrlFetchApp`で`generateContent`エンドポイントに`POST`リクエスト. 2. `payload`に`contents`と`generationConfig` (含: `responseMimeType`, `responseSchema`) を設定. 3. レスポンスをパース.
    * **Output:** (Object or string) APIからのレスポンス。
* **ラッパー関数**
    * `generateTaskContent(subject, topic, type)`: `callGeminiAPI_`を構造化スキーマ付きで呼び出す。
    * `generateFollowUpQuestion(topic, originalQuestion)`: `callGeminiAPI_`を呼び出す。
    * `summarizeStudentAnswer(answer)`: `callGeminiAPI_`を呼び出す。

---

## 5. フロントエンド仕様書

### 5.1. 基本設計原則
* **State Management:** クライアントサイドはステートレスを原則とする。全ての状態はサーバーをSSoT (Single Source of Truth) とし、ページロード時または`google.script.run`によるAPIコールで取得する。
* **Reactivity:** UIの動的更新は、`google.script.run`の`withSuccessHandler`/`withFailureHandler`コールバックをトリガーとして実行する。
* **Rendering:** 全ての動的コンテンツは、サーバーから取得したデータ(Array, Object)を基に、クライアントサイドJavaScriptでHTML文字列を構築し、対象要素の`innerHTML`に一度に代入することでレンダリングする。
* **Security:** `escapeHtml()`関数を用いて、サーバーから受け取った全ての動_テキストコンテンツをHTMLエスケープ処理すること。

### 5.2. 共通コンポーネント・ライブラリ
* **CSS Framework:** Tailwind CSS
* **Animation Library:** GSAP (GreenSock Animation Platform) - XPバー、レベルアップ等の演出に使用。
* **Icons:** Lucide Icons
* **Global Components:**
    * `LoadingOverlay`: API通信中に表示する全画面オーバーレイ。
    * `ErrorModal`: APIエラー発生時にメッセージを表示するモーダル。

### 5.3. View 仕様
#### `Login View (login.html)`
* **State:** `isLoading` (boolean)
* **UI Components:**
    * `Teacher Login Button`: 教師用ログインボタン。
    * `Student Login Button`: 生徒用ログインボタン。
* **Actions:**
    * **Teacher Login:**
        * **Trigger:** `Teacher Login Button` `onclick`.
        * **Process:** `google.script.run.withSuccessHandler(onTeacherLoginSuccess).loginAsTeacher()`.
    * **Student Login:**
        * **Trigger:** `Student Login Button` `onclick`.
        * **Process:** `google.script.run.withSuccessHandler(onStudentLoginSuccess).loginAsStudent()`.
* **Callbacks:**
    * **`onTeacherLoginSuccess(response)`:** `response.teacherCode`を基に、管理ページへリダイレクト (`manage.html?teacher=<teacherCode>`)。
    * **`onStudentLoginSuccess(response)`:**
        * `response.enrolledClasses` (Array) の長さを評価。
        * `length === 1`: 単一クラスに在籍。`quest.html?teacher=<teacherCode>`へ直接リダイレクト。
        * `length > 1`: 複数クラスに在籍。`response.enrolledClasses`を`sessionStorage`に保存し、`class-select.html`へリダイレクト。
        * `length === 0`: 未在籍。エラーモーダルで「どのクラスにも登録されていません」と表示。

#### `Class Selection View (class-select.html)` - 【新規追加】
* **目的:** 複数クラスに在籍する生徒が、利用するクラスを選択する。
* **State:** `isLoading` (boolean), `enrolledClasses` (Array)
* **Initial Load:** `sessionStorage`からクラスリストを取得し、`renderClassCards()`を実行。
* **UI Components:**
    * **Class Card Grid:**
        * **Render:** `enrolledClasses`配列をループし、各クラスのカードを生成。カードにはクラス名や担当教師名（`HandleName`）を表示。
        * **Action:** 各カードは`<a>`タグとし、`href`に`quest.html?teacher=<teacherCode>`を設定する。
* **Data Structure (`enrolledClasses`):**
    ```json
    [
      { "teacherCode": "AB12CD", "className": "Taro Sensei no Math Class" },
      { "teacherCode": "EF34GH", "className": "Hanako Sensei no English Class" }
    ]
    ```

#### `Student Quest View (quest.html)`
* **State:** `isLoading` (boolean), `userInfo` (Object), `tasks` (Object), `activeTask` (Object), `chatHistory` (Array)
* **Initial Load:** URLパラメータから`teacherCode`を取得し、`loadStudentData(teacherCode)`を呼び出す。
* **UI Components:**
    * `Profile Header`: `userInfo.globalData`を基に`HandleName`, `Global_Level`等をプログレスバー付きで表示。
    * `Navigation Bar`: `Profile`, `Shop`, `Leaderboard`へのリンクボタンを配置。
    * `Task List`: 未完了/完了済のタブ付きリスト。クリックで`openTask(taskId)`を実行。
    * `Quest Interface`: チャット形式のUI。`handleSend()`で`processSubmission`を呼び出す。
* **Callbacks:**
    * **`onSubmissionSuccess(response)`:** 1. GSAPでXPバーをアニメーション。2. レベルアップ演出。3. 正解/解説モーダルを表示。4. UI状態を更新。

#### `Profile & Collections View (profile.html)`
* **目的:** ステータス、実績、所持品を一元管理する。
* **UI Components:**
    * `User Status Card`: `Global_Level`, `Global_Coins`等を表示。
    * `Title Equipment Module`: `<select>`で装備中の称号を変更。`updateUserTitle()`を呼び出す。
    * `Trophy Collection Grid`: 獲得済トロフィーをアイコンで表示。未獲得はシルエット。
    * `Item Inventory List`: 所持アイテムと数量を表示。

#### `Item Shop View (shop.html)`
* **目的:** ゲーム内通貨(`Global_Coins`)でアイテムを購入する。
* **UI Components:**
    * `Coin Balance Header`: 現在の所持コインを常時表示。
    * `Item Grid`: 購入可能なアイテムをカード形式で表示。価格、効果を明記。所持コインが不足している場合は購入ボタンを無効化。
    * `Purchase Button`: `onclick`で確認モーダル経由で`purchaseItem(itemId)`を呼び出す。

#### `Leaderboard View (leaderboard.html)` - 【新規追加】
* **目的:** クラス内のランキングを表示し、健全な競争を促進する。
* **State:** `isLoading` (boolean), `leaderboardData` (Array), `userEmail` (string)
* **Initial Load:** `google.script.run.withSuccessHandler(renderLeaderboard).getLeaderboard(teacherCode)`を呼び出し、`Leaderboard`シートのデータを取得する。
* **UI Components:**
    * **Ranking Table/List:**
        * **Render:** `leaderboardData`配列をループし、ランキングテーブルを生成。`Rank`, `HandleName`, `Global_Level`, `Global_TotalXP`の列を持つ。
        * **Highlighting:** `leaderboardData`の行の`UserEmail`が、ログイン中の`userEmail`と一致する場合、その行の背景色を変更するなどしてハイライト表示する。
    * **Time Period Filter (Optional Extension):** `All-Time`, `Weekly`を切り替えるタブを設置。`getLeaderboard`に期間パラメータを渡して再描画する。
