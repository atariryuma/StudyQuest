GAS 自動デプロイ指示書
===================

以下は **GAS 自動デプロイ（バージョン一元管理）** を導入する開発者向けの手順書です。説明はすべて **ローカル → CI → Apps Script** の流れに沿っています。

---

# 0. 目的

1. **`package.json` の `version` を唯一の真実** にする
2. **GitHub Actions でワンコマンド自動デプロイ**
3. バージョンずれ・テスト失敗・手動更新漏れを撲滅

---

# 1. 前提条件

| 項目                               | バージョン / 内容                      |
| -------------------------------- | ------------------------------- |
| Node.js                          | v20 以上                          |
| Google Apps Script CLI (`clasp`) | 最新                              |
| GitHub Secrets                   | `CLASPRC_JSON`, `DEPLOYMENT_ID` |

## 1.1 Secrets の準備

| シークレット名         | 説明                                |
| --------------- | --------------------------------- |
| `CLASPRC_JSON`  | `~/.clasprc.json` の内容（clasp 認証情報） |
| `DEPLOYMENT_ID` | Web アプリの固定 Deployment ID          |

---

# 2. リポジトリ構成（抜粋）

```
/src
  └─ Code.gs           # VERSION プレースホルダーあり
/tests
  └─ Code.test.js      # package.json の version を参照
.github/workflows
  └─ deploy.yml        # 本書で示す CI 定義
package.json           # version の単一ソース
```

---

# 3. 実装手順

## 3.1 `src/Code.gs` にプレースホルダーを置く

```javascript
// ⭐ 変更はこの行のみ
const VERSION = '__BUILD_VERSION__';

function getSqVersion() {
  return VERSION;
}
```

## 3.2 Jest テストを動的に

```typescript
import { version as pkgVer } from '../package.json';
import { getSqVersion } from '../src/Code.gs';

test('getSqVersion returns correct version', () => {
  expect(getSqVersion()).toBe(`v${pkgVer}`);
});
```

## 3.3 GitHub Actions（`deploy.yml`）

```yaml
name: deploy-gas-webapp
on:
  push:
    branches: [ main ]
    paths: [ 'src/**', 'tests/**', 'package.json' ]

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      CLASPRC_JSON: ${{ secrets.CLASPRC_JSON }}
      DEPLOYMENT_ID: ${{ secrets.DEPLOYMENT_ID }}

    steps:
    - uses: actions/checkout@v4

    # ① package.json の version を取得
    - id: ver
      run: echo "VERSION=$(node -p \"require('./package.json').version\")" >> $GITHUB_OUTPUT

    # ② BUILD_VERSION を置換（コミットしない）
    - name: Inject version
      run: |
        ver="v${{ steps.ver.outputs.VERSION }}"
        sed -i "s/__BUILD_VERSION__/${ver}/" src/Code.gs

    # ③ 依存インストール & テスト
    - run: |
        npm ci
        npm test

    # ④ clasp デプロイ
    - run: |
        npm i -g @google/clasp
        mkdir -p ~/.config && echo "$CLASPRC_JSON" > ~/.clasprc.json
        clasp push --force
        clasp version "v${{ steps.ver.outputs.VERSION }}"
        # 最新 versionNumber を取得
        vnum=$(clasp versions --json | jq -r '.[0].versionNumber')
        clasp update-deployment "$DEPLOYMENT_ID" \
          --versionNumber "$vnum" \
          --description "v${{ steps.ver.outputs.VERSION }}"

    # ⑤ 次回に向けて patch バンプ
    - if: ${{ success() }}
      run: |
        npm version patch -m "chore: bump to %s [skip ci]"
        git push --follow-tags
```

> **ポイント**
>
> * `sed` 置換は **ワークツリーのみ** を書き換え、コミットはしない
> * テストは `package.json` を参照するため常に一致
> * デプロイ後に `npm version patch` → 次回の開発が `x.y.(z+1)` で開始

---

# 4. 運用フロー

1. **開発**
   普段どおりコードを編集 → コミット → `main` へプルリク
2. **マージ**
   CI が走り、テスト → Apps Script へ自動デプロイ
3. **次回開発**
   `package.json` は自動で patch +1 済み
   → バージョンずれの心配なし

---

# 5. トラブルシューティング

| 症状                         | 原因                       | 対処                            |
| -------------------------- | ------------------------ | ----------------------------- |
| CI の `sed` 置換で失敗           | macOS ローカルと GNU sed の差   | `-i ''` が不要か確認                |
| `clasp version` で番号取得できず失敗 | GAS プロジェクトに初回 commit がない | 手動で一度バージョン発行                  |
| `npm test` 失敗              | テストが旧 API を参照            | `package.json` 以外に固定文字列がないか確認 |

---

# 6. 拡張アイデア

* **semantic-release** で *コミットメッセージ → バージョン判定 → CHANGELOG 生成* を自動化
* **環境別デプロイ**：`DEPLOYMENT_ID_DEV` / `DEPLOYMENT_ID_PROD` を使い分けて `if: github.ref == 'refs/heads/main'` などで切替
* **Monorepo 化**：複数 GAS プロジェクトをサブディレクトリごとに同パターンで管理

---

以上で、手動更新レス・テスト失敗ゼロの GAS デプロイ体制が完成します。

