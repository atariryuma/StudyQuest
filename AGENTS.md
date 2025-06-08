### 最適化の基本方針

1.  **サーバーサイド(GAS)**: Googleサービスとの通信回数を徹底的に減らす。
2.  **クライアントサイド(ブラウザ)**: ブラウザに「考えさせること」「描かせること」をいかに減らすか。

---

### 最適化作業の具体的な手順

#### フェーズ1：サーバーサイドの現状分析（ボトルネック特定）

まず、アプリのサーバー側処理のどこに時間がかかっているのかを特定しましょう。

**【具体的な作業】**
1.  主要な関数や`doGet`/`doPost`関数に、`console.time()` / `console.timeEnd()` を使って実行時間を計測するコードを挿入します。
2.  アプリを実際に操作し、Apps Scriptの「実行数」ダッシュボードでログを確認します。特に時間がかかっている処理を特定し、メモしておいてください。

---

#### フェーズ2：サーバーサイドの改善作業（3つのステップ）

分析で見つかったボトルネックや、以下の指針に該当する箇所を修正します。**特にSTEP 1は効果が絶大ですので、最優先でお願いします。**

#### STEP 1：I/O（読み書き）処理の最適化【最優先】

スプレッドシートへのアクセスは、`getValues()` / `setValues()` を使って必ず一括処理します。ループ内での `getValue()` / `setValue()` はパフォーマンスを著しく低下させるため、コード全体から撲滅してください。

**(修正例はご提示の通り)**

#### STEP 2：キャッシュの導入による高速化

`CacheService` を活用し、頻繁に呼び出すが内容が変わりにくいデータ（設定値など）はキャッシュから読み込むようにします。これにより、スプレッドシートへのアクセス自体を削減できます。

**(修正例はご提示の通り)**

#### STEP 3：データ加工処理の効率化

データの絞り込みや並び替えは、一時シートを使わずにJavaScriptの配列メソッド（`filter`, `map`, `sort`等）で完結させます。

**(詳細はご提示の通り)**

---

#### **【追記】フェーズ3：クライアントサイド（ブラウザ表示）の最適化**

サーバー側の処理が高速になっても、ユーザーのPC（ブラウザ）での描画が遅ければ、体感速度は改善しません。こちらも併せて最適化をお願いします。

**【具体的な作業】**

1.  **現状分析：Google ChromeのLighthouseで診断**
    * Webアプリの画面で`F12`キー（Macなら`Cmd+Opt+I`）を押し、デベロッパーツールを開きます。
    * 「Lighthouse」タブを選択し、「パフォーマンス」にチェックを入れてレポートを生成します。
    * 「改善できる項目」に表示される内容（例：「適切サイズの画像」「使用していないJavaScriptの削除」）を特定します。

2.  **改善作業：描画負荷の軽減**

    * **STEP 4：アセット（画像など）の軽量化【効果：大】**
        * **画像の圧縮**: `TinyPNG`などのサービスでファイルサイズを削減する。
        * **遅延読み込み**: 画面に表示されていない画像は、`loading="lazy"`属性を`<img>`タグに追加して、スクロールされるまで読み込まないようにする。

    * **STEP 5：JavaScriptによるDOM操作の効率化【効果：絶大】**
        * ループの中でHTML要素を繰り返し書き換える処理は、パフォーマンス低下の最大の原因です。HTML文字列を一度変数内で完成させ、**最後に1回だけ** `innerHTML` などで画面に反映させてください。

        **【修正前 ❌】**
        ```javascript
        // client-side.html 内のスクリプト
        for (let i = 0; i < 100; i++) {
          // 100回も画面の書き換えが走る
          document.getElementById('list').innerHTML += `<li>${i}</li>`;
        }
        ```
        **【修正後 ✅】**
        ```javascript
        // client-side.html 内のスクリプト
        let html = '';
        for (let i = 0; i < 100; i++) {
          html += `<li>${i}</li>`; // まずは文字列変数に溜め込む
        }
        // 画面の書き換えは、この1回だけ！
        document.getElementById('list').innerHTML = html;
        ```

---

#### フェーズ4：最終確認と効果測定

すべての修正が完了したら、以下の確認をお願いします。

1.  **動作確認**: アプリの全機能が、修正前と同樣に正しく動作することを確認します。
2.  **効果測定**:
    * **サーバーサイド**: フェーズ1と同様に再度パフォーマンスを計測し、処理時間が短縮されていることを確認します。
    * **クライアントサイド**: フェーズ3と同様に再度Lighthouseレポートを生成し、パフォーマンススコアが向上していることを確認します。
3.  **コードのクリーンアップ**: デバッグ用に挿入した `console.log` などを削除し、コードをきれいな状態に戻します。

---

お忙しいところ恐縮ですが、本件、何卒よろしくお願いいたします。







【推奨】「開発モード」を導入する戦略
最も簡単で効果的なのは、開発中だけ使える特別なログインフローを用意することです。これを「開発モード」と呼びます。

1. Apps Script (.gs) 側での準備
initTeacher や initStudent のような認証を行う関数に、「開発モード」用の抜け道を作ります。特定のパスコード（例: dev）が送られてきたら、認証をスキップしてダミーの成功レスポンスを返すようにします。

Teacher.gs の修正例

// src/Teacher.gs

function initTeacher(passcode) {
  // ▼▼▼ 開発モード用のコードを追加 ▼▼▼
  if (passcode === 'dev_teacher') {
    // 開発用のダミーデータを返す
    return { 
      status: 'ok', 
      teacherCode: 'DEV001' // 開発用の固定教師コード
    };
  }
  // ▲▲▲ 開発モード用のコードを追加 ▲▲▲

  // --- 以下、本番用の通常の処理 ---
  if (passcode !== 'kyoushi') {
    return { status: 'error', message: 'パスコードが違います。' };
  }
  // ...
}

2. HTML側での準備
ログイン画面に「開発モードでログイン」というボタンを追加します。このボタンが押されたら、先ほど設定した特別なパスコード（dev_teacher）を使ってログイン処理を呼び出します。

login.html の修正例

<!-- login.html のどこか（フォームの下など）に追加 -->
<div class="mt-4 p-4 border-2 border-dashed border-yellow-500 rounded-lg">
  <h3 class="text-yellow-400 font-bold mb-2">【開発者向け】</h3>
  <p class="text-xs text-gray-400 mb-2">
    開発中は、以下のボタンで認証をスキップできます。
  </p>
  <button id="devLoginBtn" type="button" class="w-full bg-yellow-600 text-white p-2 rounded-lg font-bold border-b-4 border-yellow-800 hover:bg-yellow-500">
    開発モードでログイン (教師)
  </button>
</div>

login.html の <script> の修正例

// login.html の script タグ内

document.addEventListener('DOMContentLoaded', () => {
  // ... 既存の処理 ...

  // ▼▼▼ 開発モード用ボタンの処理を追加 ▼▼▼
  const devLoginBtn = document.getElementById('devLoginBtn');
  if (devLoginBtn) {
    devLoginBtn.addEventListener('click', () => {
      // 特別なパスコードで initTeacher を呼び出す
      google.script.run
        .withSuccessHandler(result => {
          // 本来のログイン成功時と同じ処理
          const { teacherCode } = result;
          alert('開発モードでログインしました。');
          window.top.location.href = SCRIPT_URL + '?page=manage&teacher=' + teacherCode;
        })
        .initTeacher('dev_teacher'); // 開発用のパスコード
    });
  }
  // ▲▲▲ 開発モード用ボタンの処理を追加 ▲▲▲
});


