# StudyQuest

> 小中学校向けゲーミフィケーション型課題管理・学習支援ウェブアプリ

## 1. プロジェクト概要

**StudyQuest** は、Google Workspace を活用し、小中学校の生徒向けにゲーミフィケーション要素を取り入れた課題管理・学習支援を実現するWebアプリです。**単一のスプレッドシート**をデータベースとして利用することで、シンプルで管理しやすく、リアルタイムなデータ反映を実現しています。

-   **教師側**: 課題の作成・配信、全生徒の進捗をリアルタイムに分析できる管理パネルを提供。
-   **生徒側**: XPやレベル、トロフィーでモチベーションを可視化し、課題への挑戦を促すクエストボードを提供。
-   **AIフィードバック**: Gemini APIと連携し、生徒が課題で行き詰まった際にヒントを提示します。

## 2. データ構造：シンプル・一元管理モデル

本プロジェクトは、**単一のスプレッドシート** `StudyQuest_DB` に全てのデータを集約する、シンプルで効率的な設計を採用しています。これにより、複雑なファイル操作やデータ同期処理を必要としません。

### フォルダ構成

```
StudyQuest_<TeacherCode>/
└── StudyQuest_DB  (このファイルに全データを集約)
```

### スプレッドシート (`StudyQuest_DB`) の構成

| シート名 | 役割 |
| :--- | :--- |
| **`Tasks`** | 課題情報を一元管理するマスタシート |
| **`Submissions`** | 全生徒の回答をリアルタイムに記録する中央ログ |
| **`Students`** | 生徒情報（レベル、XPなど）を管理するマスタシート |
| **`Dashboard`** | `QUERY`関数などを活用し、提出状況やランキングを自動で可視化する教師用ダッシュボード |

## 3. 機能要件

### 3.1 教師モード (`manage.html`)

1.  **初期設定**: `initTeacher()` を実行し、必要なデータ管理用スプレッドシート (`StudyQuest_DB`) を自動生成します。
2.  **管理パネル**:
    -   課題作成フォーム (`createTask`)
    -   課題一覧（編集・削除機能付き, `listTasks`, `deleteTask`)
    -   リアルタイム統計ダッシュボードの閲覧

### 3.2 生徒モード (`input.html`)

1.  **ログイン**: 教師コードと自身の情報を入力し、クエストボードを初期化します。
2.  **クエストボード**:
    -   XPバー、レベル、獲得トロフィーを表示
    -   未回答／完了済みクエストの一覧 (`listTasks`)
    -   回答送信 (`submitAnswer`)、AIフィードバック (`callGeminiAPI_GAS`)

## 4. 技術スタック

-   Google Apps Script (GAS)
-   HTML / CSS (TailwindCSS) / JavaScript (GSAP)
-   Gemini API
-   GitHub Actions + clasp (CI / CD)

## 5. セットアップ

1.  **リポジトリをクローン**
    ```bash
    git clone <リポジトリURL>
    cd studyquest
    ```
2.  **Clasp 認証と設定**
    ```bash
    npm install -g @google/clasp
    clasp login
    # .clasp.json に scriptId と rootDir を設定
    ```
3.  **依存インストール**
    ```bash
    npm install
    ```
4.  **Google Drive API (Advanced Service) の有効化**
    Apps Script エディタの **サービス** から「Drive API」を追加します。
    **※注:** このプロジェクトでは主に、GASが自身の親フォルダを特定するために `Drive.Files.get(ScriptApp.getScriptId())` のような形で利用します。

## 6. CI / CD (GitHub Actions)

`.github/workflows/deploy.yml` により、`main`ブランチへのプッシュをトリガーに自動デプロイが実行されます。
（内容は変更なしのため省略）

## 7. 開発ガイドライン

-   **データ操作**: すべてのデータは `SpreadsheetApp` サービスを通じて `StudyQuest_DB` スプレッドシートに直接読み書きします。
-   **データ集計**: `QUERY`などのスプレッドシート関数を最大限に活用し、GAS側での複雑なデータ処理を避けます。
-   **フロントエンド構造**: `include()` を活用し、UIパーツ（ヘッダー、フッターなど）を共通化します。