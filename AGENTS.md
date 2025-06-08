#### 最適化の基本方針

GAS高速化の鍵は**「Googleサービス（スプレッドシート等）との通信回数を徹底的に減らすこと」**です。これから行う作業は、すべてこの基本方針に繋がります。

---

### 最適化作業の具体的な手順

#### フェーズ1：現状分析（ボトルネックの特定）

まず、アプリのどこに時間がかかっているのかを特定しましょう。主要な関数や、`doGet`/`doPost`関数内の処理時間を計測してください。

**【具体的な作業】**
1.  処理の開始地点と終了地点に、実行時間をログ出力するコードを挿入します。
    ```javascript
    function someFunction() {
      console.time('someFunctionの処理時間'); // 計測開始

      // ...既存の処理...

      console.timeEnd('someFunctionの処理時間'); // 計測終了
    }
    ```
2.  アプリを実際に操作し、Apps Scriptの「実行数」ダッシュボードでログを確認します。特に時間がかかっている処理を特定し、メモしておいてください。

---

#### フェーズ2：改善作業（3つのステップ）

分析で見つかったボトルネックや、以下の指針に該当する箇所を修正していきます。**特にSTEP 1は効果が絶大ですので、最優先でお願いします。**

#### STEP 1：I/O（読み書き）処理の最適化【最優先】

スプレッドシートへのアクセスは、1回ずつ行うと非常に遅くなります。データを「まとめて取得」し、「まとめて書き込む」ように変更してください。

**【具体的な作業】**
* **`getValue()` / `setValue()` の撲滅**:
    コード全体から `getValue()` や `setValue()` がループ処理の中で使われている箇所を探します。
    
    **【修正前 ❌】**
    ```javascript
    for (let i = 1; i <= 100; i++) {
      const value = sheet.getRange(i, 1).getValue(); // 100回の通信
      // ...処理...
    }
    ```
    **【修正後 ✅】**
    ```javascript
    const allValues = sheet.getRange("A1:A100").getValues(); // 1回の通信で済む！
    for (let i = 0; i < allValues.length; i++) {
      const value = allValues[i][0];
      // ...処理...
    }
    ```
    書き込み時も同様に、`setValues()` を使って一括で更新してください。

#### STEP 2：キャッシュの導入による高速化

同じデータを何度も取得する処理がある場合、2回目以降は「キャッシュ」という一時保管場所から高速に読み込むようにします。

**【具体的な作業】**
1.  **キャッシュ候補の特定**:
    アプリ内で、頻繁に呼び出されるが、内容はあまり変わらないデータを取得している処理を探します。（例：設定シートの読み込み、分類マスターの取得など）
2.  **`CacheService` の実装**:
    特定した処理にキャッシュ機能を実装します。

    **【修正前 ❌】**
    ```javascript
    function getSettings() {
      // 毎回シートにアクセスしている
      return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('設定').getRange("A1:B10").getValues();
    }
    ```
    **【修正後 ✅】**
    ```javascript
    function getSettings() {
      const cache = CacheService.getScriptCache();
      const cached = cache.get('settings_data'); // まずキャッシュを探す
      if (cached != null) {
        return JSON.parse(cached); // あれば即座に返す
      }
      
      const data = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('設定').getRange("A1:B10").getValues();
      cache.put('settings_data', JSON.stringify(data), 3600); // なければ取得し、キャッシュに保存（例：1時間）
      return data;
    }
    ```
#### STEP 3：データ加工処理の効率化

データの並び替えや絞り込みのために、一時的なシートを作成している場合は、それを廃止し、すべてスクリプト内で完結させます。

**【具体的な作業】**
* **一時シート作成処理の廃止**:
    `insertSheet()`, `deleteSheet()` や、シートの `QUERY` 関数をスクリプトから呼び出している箇所を探し、その処理をJavaScriptの配列メソッドに置き換えます。
    
    **【置き換えに使うと便利なメソッド】**
    * **絞り込み**: `Array.prototype.filter()`
    * **データ変換**: `Array.prototype.map()`
    * **並び替え**: `Array.prototype.sort()`
    * **集計・グループ化**: `Array.prototype.reduce()`
    
    これらのメソッドを使えば、シートを操作することなく、高速にデータ加工が可能です。

---

#### フェーズ3：最終確認と効果測定

すべての修正が完了したら、以下の確認をお願いします。

1.  **動作確認**: アプリの全機能が、修正前と同樣に正しく動作することを確認します。
2.  **効果測定**: フェーズ1と同様の方法で再度パフォーマンスを計測し、処理時間が大幅に短縮されていることを確認します。
3.  **コードのクリーンアップ**: デバッグ用に挿入した `console.log` などを削除し、コードをきれいな状態に戻します。

---

お忙しいところ恐縮ですが、本件、何卒よろしくお願いいたします。
