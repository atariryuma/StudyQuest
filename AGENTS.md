# AGENTS.md

### 高速化・効率化のための3大原則

#### 原則1：I/O（読み書き）は必ず「まとめて」行う (バルク処理)

これが最も重要です。スプレッドシートやドキュメントなどのGoogleサービスとの通信は、処理の中で最も時間がかかる部分です。通信回数を1回でも減らすことが、劇的な速度向上に繋がります。

**良い例 ✅ (最初にまとめて読み、最後にまとめて書く)**
```javascript
// 最初にまとめて500行分を読み込み、最後にまとめて書き出す
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('データ');
const dataRange = sheet.getRange("A1:A500");

const allValues = dataRange.getValues(); // 1回の読み込み！

const newValues = allValues.map(row => {
  const value = row[0];
  return [value * 2]; // 書き込み用の新しい配列を作成
});

sheet.getRange("B1:B500").setValues(newValues); // 1回の書き込み！
// 合計2回の通信で完了し、圧倒的に速い！
```
`getValue` / `setValue` の代わりに `getValues` / `setValues` を使うのが基本中の基本です。

#### 原則2：キャッシュを積極的に使う (`CacheService`)

何度も同じデータを取得する場合、その都度スプレッドシートや外部APIにアクセスするのは無駄です。`CacheService`を使うと、一度取得したデータをGASの高速なキャッシュ領域に一定時間保存できます。

**利用シーンの例**
* 全ユーザー共通の設定情報
* 外部APIから取得した、頻繁には更新されないデータ（例：商品マスター、天気予報）
* 重い計算の結果

**簡単なコード例**
```javascript
function getHeavyData() {
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get('heavy_data_key');

  if (cachedData != null) {
    // キャッシュにデータがあれば、それをすぐに返す
    console.log('キャッシュからデータを取得しました');
    return JSON.parse(cachedData);
  }
  
  // キャッシュになければ、重い処理を実行
  console.log('データベースからデータを取得しています...');
  const result = SpreadsheetApp.getActiveSheet().getDataRange().getValues(); // 重い処理の例
  
  // 処理結果をキャッシュに保存（例：10分間保存）
  cache.put('heavy_data_key', JSON.stringify(result), 600); 

  return result;
}
```
2回目以降の呼び出しでは、スプレッドシートへのアクセス自体が発生せず、瞬時に結果が返るようになります。

#### 原則3：データ加工はGAS (JavaScript) の中で完結させる

前回の話題の核心ですが、データの絞り込み、並び替え、重複排除などの処理のために**一時的なシートを作成するのは避けましょう。**

スプレッドシートから `getValues()` でデータを2次元配列として取得したら、あとはJavaScriptの強力な配列メソッド（`filter`, `map`, `sort`, `reduce`など）を使ってメモリ上で効率的に加工します。

* **`filter`**: 条件に合うデータだけを抽出する
* **`map`**: 配列の各要素を変換して新しい配列を作る
* **`sort`**: データを並び替える
* **`reduce`**: 配列から単一の結果（合計値、グループ化されたオブジェクトなど）を生成する

この方法なら、シート操作という重い処理を挟むことなく、高速にデータを整形できます。

---

### まとめ

GASで高速なWebアプリを作るための基本は、以下の3つに集約されます。

1.  **バルク処理**: 読み書きは `getValues` / `setValues` で一括で行う。
2.  **キャッシュ**: 繰り返し使うデータは `CacheService` に保存する。
3.  **JSで完結**: データ加工は一時シートを使わず、JavaScriptの配列メソッドで行う。

この「**いかに通信回数を減らし、処理をメモリ上で完結させるか**」という意識を持つだけで、アプリのパフォーマンスは劇的に向上し、1日の実行時間上限（クォータ）にも引っかかりにくくなります。
