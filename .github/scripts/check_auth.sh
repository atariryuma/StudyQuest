#!/usr/bin/env bash
set -e

# --- 事前チェック ---
if [[ -z "${GCP_PROJECT}" ]]; then
  echo "【ERROR】GCP_PROJECT が設定されていません。"
  exit 1
fi
if [[ -z "${SCRIPT_ID}" ]]; then
  echo "【ERROR】SCRIPT_ID が設定されていません。"
  exit 1
fi

echo "========================"
echo "  1. 有効化済みの API を確認 "
echo "    (Apps Script API, Drive API の有効化状況をチェック)"
echo "========================"
gcloud services list \
  --project "${GCP_PROJECT}" \
  --enabled \
  --filter="NAME=('script.googleapis.com','drive.googleapis.com')" \
  --format="table(NAME, TITLE)"

echo
echo "========================"
echo "  2. サービスアカウントの IAM ロール を確認 "
echo "    (プロジェクトポリシーにサービスアカウントが登録されているか)"
echo "========================"
gcloud projects get-iam-policy "${GCP_PROJECT}" \
  --format="table(bindings.role, bindings.members)" \
  --filter="bindings.members:${SERVICE_ACCOUNT}"

echo
echo "========================"
echo "  3. Apps Script プロジェクトのパーミッションを確認 "
echo "    (Drive API 経由で script ファイルの permissions を列挙)"
echo "========================"

ACCESS_TOKEN="$(gcloud auth application-default print-access-token)"

echo "→ Drive API: /drive/v3/files/${SCRIPT_ID}/permissions"
echo "  (各 permission の role, type, emailAddress をチェックしてください)"
curl -s \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "https://www.googleapis.com/drive/v3/files/${SCRIPT_ID}?fields=permissions" \
  | jq '.permissions[] | {id: .id, type: .type, role: .role, emailAddress: .emailAddress}'

echo
echo "========================"
echo "  4. Apps Script API でプロジェクト情報を取得 "
echo "    (プロジェクト自体が存在しているか、parentId などを確認)"
echo "========================"
curl -s \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "https://script.googleapis.com/v1/projects/${SCRIPT_ID}" \
  | jq '{ scriptId: .scriptId, title: .title, parentId: .parentId, createTime: .createTime, updateTime: .updateTime }'

echo
echo "========================"
echo "  チェック完了 "
echo "========================"
