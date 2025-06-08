# StudyQuest: ゲーミフィケーション学習支援アプリ

## 1. コンセプト 🎯

**StudyQuest**は、小中学校の課題管理にゲーミフィケーション要素を取り入れ、生徒の学習意欲を自然に引き出すWebアプリケーションです。教師はGoogleスプレッドシートをデータベースとして、課題の作成や進捗管理を直感的に行えます。生徒はクエスト（課題）をクリアすることで経験値（XP）やトロフィーを獲得し、自身の成長を可視化できます。

* **教師の体験**: 課題作成、生徒の進捗・回答のリアルタイム確認、AIによるフィードバック支援。
* **生徒の体験**: クエスト形式の課題挑戦、XP・レベル・トロフィーによる成長実感。

---

## 2. アーキテクチャ概要 🛠️

本アプリは、**Google Apps Script (GAS) Web App** と **単一のGoogleスプレッドシート** を組み合わせたサーバーレスアーキテクチャを採用します。

* **バックエンド (GAS)**: 全てのビジネスロジック、データ操作、Gemini APIとの連携を担当。
* **データベース (Spreadsheet)**: 教師ごとに専用のスプレッドシート（DB）を生成し、全てのデータをシート（テーブル）で管理。
* **フロントエンド (HTML/CSS/JS)**: GASから配信されるUI。`google.script.run` を介してバックエンドと非同期通信。

---

## 3. データモデル (スプレッドシート設計) 📚

教師ごとの`StudyQuest_DB_<TeacherCode>`スプレッドシートが単一のデータベースとして機能します。TeacherCodeはGoogleアカウントのメールアドレスに紐付いて発行され、メールアドレスが教師の一意なIDとなります。

**⚠️【重要】設計方針の変更**
当初の`生徒_<StudentID>`シート案は、生徒数が増えると**パフォーマンスが著しく低下し、メンテナンス性も悪化**します。そのため、この個別シートは**作成せず**、全ての回答ログは`Submissions`シートに集約する方針とします。生徒個別のログは、`Submissions`シートを`StudentID`でフィルタリングして表示します。

### 3.1. テーブル（シート）一覧

| シート名 | 役割 |
| :--- | :--- |
| `Tasks` | 課題マスタ |
| `Students` | 生徒マスタ |
| `Submissions` | **全生徒の全回答ログ**（中心となるテーブル） |
| `Trophies` | トロフィーマスタ（実績） |
| `AI_Log` | AIによるフィードバックの全ログ |
| `Settings` | アプリの各種設定値 |
| `TOC` | 各シートと列の日本語説明（開発者向け） |

### 3.2. テーブル定義

#### Tasks (課題マスタ)
| Col | Name | Type | Description |
|---|---|---|---|
| A | TaskID | string | 一意の課題ID (例: `task_1717826400000`) |
| B | Title | string | 課題のタイトル (例: 「光合成の仕組み」) |
| C | **XpBase** | number | **この課題クリアで得られる基本XP** |
| D | Payload | JSON | `{ subject, question, type, choices?, followup? }` 形式の課題詳細 |
| E | Status | string | `draft` (下書き), `open` (公開中), `closed` (終了) |
| F | CreatedAt | datetime | 作成日時 |

#### Students (生徒マスタ)
| Col | Name | Type | Description |
|---|---|---|---|
| A | StudentID | string | `"6-1-04"` (学年-組-番号) 形式の一意ID |
| B | HandleName | string | 生徒のニックネーム |
| C | TotalXP | number | **累計獲得XP** |
| D | Level | number | **現在のレベル** |
| E | TrophyList | string | 獲得したトロフィーIDのカンマ区切りリスト |
| F | LastLogin | datetime | 最終ログイン日時 |

#### Submissions (回答ログ)
| Col | Name | Type | Description |
|---|---|---|---|
| A | SubmissionID | string | 一意の提出ID (例: `sub_1717826400000`) |
| B | StudentID | string | → `Students!A` |
| C | TaskID | string | → `Tasks!A` |
| D | Answer | text | 生徒の回答内容や成果物URL |
| E | **EarnedXP** | number | **この提出で獲得した合計XP** (基本値+ボーナス) |
| F | **TrophyID** | string | この提出で**新たに獲得した**トロフィーのID |
| G | SubmittedAt | datetime | 提出日時 |

#### Trophies (トロフィーマスタ) - 📝**新規追加**
| Col | Name | Type | Description |
|---|---|---|---|
| A | TrophyID | string | 一意のトロフィーID (例: `first_quest_clear`) |
| B | Name | string | トロフィー名 (例: 「はじめてのクエスト」) |
| C | Description | string | 獲得条件の説明 |
| D | IconURL | string | 表示するアイコンのURLやID |
| E | **Condition** | JSON | **獲得条件を定義するJSON** (例: `{"type":"submission_count", "value":1}` ) |

---

## 4. 主要ロジック（計画） 🧠

### 4.1. 経験値 (XP) とレベルアップの管理

生徒のモチベーションの核となるXP付与ロジックです。回答が提出された際に、以下の順で判定・計算を行います。

1.  **基本XPの取得**:
    * 提出された課題の`Tasks.XpBase`を基本値とします。

2.  **ボーナスXPの判定**:
    * **初回クリアボーナス**: `Submissions`シートに同じ生徒の同じ`TaskID`のログが存在しない場合、ボーナスXP (例: `+10XP`) を加算。
    * **スピードクリアボーナス**: 課題公開 (`Tasks.CreatedAt`) から一定時間以内 (例: 24時間以内) の提出であれば、ボーナスXP (例: `+5XP`) を加算。
    * 今後、自己評価や他者評価によるボーナスもここに追加予定。

3.  **最終獲得XPの計算**:
    * `最終獲得XP = 基本XP + 各種ボーナスXP`

4.  **データ更新**:
    * 計算した最終獲得XPを `Submissions.EarnedXP` に記録。
    * `Students.TotalXP` に最終獲得XPを加算。
    * 新しい`TotalXP`を元にレベルを再計算 (`Level = floor(TotalXP / 100)`) し、`Students.Level` を更新。

### 4.2. トロフィーの管理 (📝**未実装仕様**)

特定の条件を満たした際に一度だけ贈られる実績です。XP同様、回答提出時に獲得判定処理を呼び出します。

1.  **判定トリガー**:
    * XP計算とデータ更新が完了した直後に実行。

2.  **判定ロジック**:
    * まず、生徒がまだ獲得していないトロフィーのリストを取得 (`Trophies`マスタと`Students.TrophyList`を比較)。
    * そのリストをループし、各トロフィーの`Trophies.Condition` (条件JSON) を満たしているかチェック。
        * 例: `{ "type": "level", "value": 10 }` → 生徒のレベルが10に達したか？
        * 例: `{ "type": "total_xp", "value": 1000 }` → 累計XPが1000を超えたか？
    * 条件を満たしたトロフィーがあれば、獲得処理へ。

3.  **データ更新**:
    * 獲得したトロフィーのIDを `Submissions.TrophyID` に記録（どの提出で獲得したかのログ）。
    * `Students.TrophyList` に獲得したトロフィーIDを追記（カンマ区切り）。

---

## 5. パフォーマンスと品質に関する開発ガイドライン ✨

本プロジェクトでは、ユーザーに最高の体験を提供するため、サーバーとクライアント両面でのパフォーマンスを重視します。

### 5.1. サーバーサイド (GAS) の基本原則

1.  **データアクセス**:
    * **【最重要】** スプレッドシートへの読み書きは、**必ず `getValues()` と `setValues()` で一括処理**してください。ループ内での `getValue()` / `setValue()` はパフォーマンスを著しく低下させるため**禁止**とします。
    * `QUERY`関数やフィルタ機能を**GASから呼び出すのは非推奨**です。データは一旦すべて配列として取得し、JavaScriptの `filter()` や `map()` で加工する方が高速です。

2.  **状態管理**:
    * 頻繁にアクセスするが変更の少ないデータ（例: `Settings`シートの内容、`Tasks`マスタ）は、**`CacheService` を積極的に利用**し、スプレッドシートへのアクセス回数を削減してください。
    * 例えば最新の公開クエストIDは `getLatestActiveTaskId()` で取得し、30秒間キャッシュして余分なシート読み込みを避けます。
    * **ログイン処理もキャッシュ対象**です。Google認証トークンの検証結果や `registration.json` の内容は短時間 `CacheService` に保存し、Drive へのアクセス回数を減らします。

### 5.2. クライアントサイド (ブラウザ) の基本原則 📝**新規追加**

1.  **DOM操作の効率化**:
    * **【最重要】** JavaScriptによるHTML要素の書き換え（DOM操作）は、パフォーマンスに最も影響します。多数の要素をリスト表示する際などは、**HTML文字列を一度変数内で完成させ、最後に1回だけ `innerHTML` 等で画面に反映**させてください。

    **【悪い例 ❌】**
    ```javascript
    // ループのたびに画面が書き換えられ、非常に重い
    for (const item of data) {
      document.getElementById('list').innerHTML += `<li>${item.name}</li>`;
    }
    ```
    **【良い例 ✅】**
    ```javascript
    let html = '';
    // まずはメモリ上でHTML文字列を完成させる
    for (const item of data) {
      html += `<li>${item.name}</li>`;
    }
    // 画面の書き換えは、この1回だけ！
    document.getElementById('list').innerHTML = html;
    ```

2.  **アセットの軽量化**:
    * **画像**: 表示サイズに対して過度に大きい画像は使用しないでください。必要に応じて圧縮し、画面に表示されていない画像には`loading="lazy"`属性を付与して遅延読み込みを検討します。
    * **ライブラリ**: UIをリッチにするための外部ライブラリは、本当に必要か吟味し、最小限に留めてください。

3.  **描画負荷の軽減**:
    * **アニメーション**: CSSでアニメーションを実装する際は、`left`や`top`を変更するより、GPUを使いやすく描画負荷の低い **`transform` と `opacity`** の利用を優先してください。

### 5.3. パフォーマンス最適化ワークフロー 🏃‍♂️

サーバーとクライアント両面のチューニングを計画的に進めるため、以下のフローで作業することを推奨します。

1. **フェーズ1: サーバーサイドの現状分析**
   * `console.time()` / `console.timeEnd()` を用いて `doGet` など主要関数の処理時間を計測し、ログからボトルネックを特定します。
2. **フェーズ2: サーバーサイドの改善**
   * **STEP 1: I/O 処理の最適化** — `getValues()` / `setValues()` による一括処理を徹底し、ループ内での単一セル操作を排除します。
   * **STEP 2: キャッシュの活用** — `CacheService` に設定値やマスタデータを保存し、スプレッドシートへのアクセスを最小化します。
   * **STEP 3: データ加工の効率化** — フィルタや並び替えは JavaScript の配列メソッドで完結させます。
3. **フェーズ3: クライアントサイドの最適化**
   * Lighthouse レポートで描画の遅延要因を洗い出します。
   * **STEP 4: アセットの軽量化** — 画像圧縮や `loading="lazy"` の利用などで転送量を減らします。
   * **STEP 5: DOM 操作の効率化** — HTML 文字列をバッファし、画面の書き換えは 1 回にまとめます。
4. **フェーズ4: 効果測定とクリーンアップ**
   * 再度処理時間と Lighthouse スコアを確認し、改善効果を記録します。
   * デバッグ用ログを削除し、コードを整理して完了です。

## 6. セットアップとデプロイ 🚀

この設計書を正として開発を進めてください。このドキュメントは「生きたドキュメント」です。実装中に新たな発見や改善案があれば、随時更新し、チームで共有しましょう。最高の学習体験を届けられるよう、協力をお願いします！

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

5. 教師として初回ログインした際に、README で定義されたシート構造の
   **StudyQuest_DB** スプレッドシートが自動生成されます。
   生成後は Apps Script の `initTeacher()` を呼び出して確認してください。

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
