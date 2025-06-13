# StudyQuest Developer Guide v1.0

> \*\*Audience \*\*: Apps Script / Front‑End engineers contributing to the StudyQuest code‑base.
> \*\*Scope \*\*: Server‑side GAS modules, Spreadsheet schema, front‑end APIs and deployment pipeline.

---

## 0  Glossary

| Term           | Meaning                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------ |
| **Global DB**  | Master Spreadsheet (ID stored as `Global_Master_DB`) holding user‑centric persistent data. |
| **Teacher DB** | Per‑teacher Spreadsheet (`StudyQuest_DB_<TeacherCode>`). Holds class‑scoped data.          |
| **SSoT**       | Single Source of Truth – the Global DB for XP/coins/level/trophies.                        |
| **PK / FK**    | Primary / Foreign key. All PKs are unique and immutable.                                   |

---

## 1  Spreadsheet Schemas (Quick Reference)

### 1.1 Global\_Master\_DB

| Sheet                        | PK             | Selected Columns                                                                                            |
| ---------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| **Global\_Users**            | `Email`        | `HandleName, Role, Global_TotalXP, Global_Level, Global_Coins, EquippedTitle, LastGlobalLogin, LoginStreak, TotalLikesGiven, TotalLikesReceived` |
| **Global\_Trophies\_Log**    | `UserTrophyID` | `UserEmail → Global_Users.Email`, `TrophyID`, `AwardedAt`                                                   |
| **Global\_Items\_Inventory** | `UserItemID`   | `UserEmail`, `ItemID`, `Quantity`, `AcquiredAt`                                                             |

### 1.2 Teacher\_DB (`StudyQuest_DB_<TeacherCode>`)

| Sheet           | PK / Composite PK           | Notes                                         |
| --------------- | --------------------------- | --------------------------------------------- |
| **Enrollments** | `UserEmail + Grade + Class` | `ClassRole` = `student` (固定) – 先生は別途登録済み。     |
| **Tasks**       | `TaskID`                    | `Status` ∈ {`draft`,`open`,`closed`}          |
| **Submissions** | `SubmissionID`              | AI summary stored in `AiSummary` if free-text |
| **Likes**       | `LikeID`                    | `TaskID`, `StudentID`, `LikedBy`, `Value`, `CreatedAt` |
| **Trophies**    | `TrophyID`                  | JSON `Condition` を評価                          |
| **Items**       | `ItemID`                    | `Type` ∈ {`title`,`consumable`,...}           |
| **Leaderboard** | generated                   | 再生成用ワークシート（非永続）                               |

---

## 2  Server‑Side Modules & Public APIs

> **All functions return plain JS objects** (`{status: "ok", ...}`) to ease JSON‑serialisation over `google.script.run`.

### 2.1 Auth.gs

```js
/** 初回: 教師用DB作成 & teacherCode 発行 */
function setupInitialTeacher(secretKey): {status, teacherCode}
/** 既存教師ログイン */
function loginAsTeacher(): {status, teacherCode}
/** 生徒ログイン */
function loginAsStudent(teacherCode): {status, userInfo | error}
```

*Lock scope*: per‑user row lock when mutating `Global_Users`.

### 2.2 Enrollment.gs

```js
function registerUsersFromCsv(teacherCode, csvString)
  -> {created, enrolled, skipped, errors[]}
function registerSingleStudent(teacherCode, studentObj)
function deleteStudentsFromClass(teacherCode, emailList)
```

*CSV header must be exactly*: `Email, Name, Grade, Class, Number`.

### 2.3 Submission.gs

```js
function processSubmission(teacherCode, userEmail, taskId, answer)
  -> {status, earnedXp, earnedCoins, trophies[], correctAnswer, explanation}
```

*Flow*:

1. Validate task (`open`, not duplicate).
2. Compute XP (base 10 ± bonuses).
3. **Global Users**: add XP, recalc level ⇒ `level = floor(sqrt(totalXP/100))`.
4. Coins = XP / 10 (int).
5. AI summary for free text.
6. Append to `Submissions`.
7. `checkAndAwardTrophies`.

### 2.4 Gamification.gs

```js
function processLoginBonus(userEmail)
function checkAndAwardTrophies(userEmail, context)
function generateLeaderboard(teacherCode)   // daily trigger
```

*Daily coins*: `5 + (streak % 7)`.

*Lock scope*: entire `Global_Users` row.
### 2.5 Like.gs
```js
function addLike(teacherCode, taskId, targetStudentId)
  -> {status, newScore | error}
```
*Adds a reaction entry and updates score columns.*


---

## 3  Utility Conventions

* **Caching**: Use `CacheService` (6 h) for Spreadsheet IDs.
* **Batch I/O**: Always group `getValues / setValues` – avoid cell‑by‑cell writes.
* **Locking**: `LockService.getDocumentLock()` for cross‑sheet mutations; release in `finally`.
* **Error Codes** (non‑exhaustive):

  * `invalid_header`, `unexpected_column`, `invalid_email`, `duplicate_number`, `not_found_in_class`, `duplicate_main_teacher`.
* **Logging**: `logError_(fn, err)` → central `Errors` sheet.

---

## 4  Front‑End Contract

| View           | Primary API calls                  | Success handler duties                              |
| -------------- | ---------------------------------- | --------------------------------------------------- |
| `login.html`   | `loginAsTeacher / loginAsStudent`  | route, store session info                           |
| `quest.html`   | `processSubmission`                | animate XP bar, stash trophy IDs → `sessionStorage` |
| `profile.html` | `loadProfileData` (client wrapper) | highlight new trophies                              |

---

## 5  Deployment & CI

* **Tooling**: `clasp push --force` via GitHub Actions (`gas-push.yml`).
* **Secrets**: `CLASPRC_JSON`.
* **Branch policy**: PR → `main` triggers lint + Jest (optional) + deploy.

---

## 6  Testing Matrix

| Area        | Tests                                                          |
| ----------- | -------------------------------------------------------------- |
| CSV Import  | header mismatch, dup email, dup number, enrol vs global upsert |
| Login Bonus | streak reset, day‑skip, same‑day no double coins               |
| Submission  | XP calc, level up edge, coin calc, trophy trigger              |
| Concurrency | simultaneous submissions (Lock collisions)                     |

---

## 7  Coding Standards

* ES5 syntax (GAS runtime). Use `var` + IIFE to mimic modules.
* **No** arrow functions / `let` / `const` (still V8 but keeps linter happy).
* Centralise literals (`consts.gs`).

---

## 8  Reference Snippets

```js
// Get Teacher DB once, cached
function getTeacherDb_(code) {
  var cache = CacheService.getUserCache();
  var id = cache.get(code) || PropertiesService.getScriptProperties().getValue('ssId_' + code);
  if (!id) throw new Error('invalid_teacher_code');
  cache.put(code, id, 21600); // 6h
  return SpreadsheetApp.openById(id);
}
```

---

## 9  Spreadsheet I/O Optimisation Best Practices

| Area                  | Recommendation                                                                                                 | Rationale                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Open / close cost** | Cache Spreadsheet IDs (`CacheService`) **and** Sheet objects when possible.                                    | `openById()` is an API round‑trip (\~300–400 ms).                  |
| **Row index map**     | Build an **email → rowIdx** map once via `Array.prototype.reduce` and reuse for look‑ups.                      | O(1) access vs linear scan.                                        |
| **Diff‑aware writes** | Compare in‑memory row snapshot with new payload; `setValues()` only if something changed.                      | Eliminates \~70 % of needless writes in load‑test.                 |
| **Chunk size**        | For bulk inserts, push in blocks of **500 rows** max.                                                          | Keeps payload <50 KB, fits quota.                                  |
| **Retry strategy**    | Wrap write ops in `Utilities.sleep(100*retry)` exponential‑backoff (max 3).                                    | Handles sporadic `Rate Limit` or `Service invoked too many times`. |
| **Archiving**         | Year末に古い `Submissions` を別シートへ移動し、メインを軽量化。                                                                      | Sheets degrade >50 k rows.                                         |
| **Named Ranges**      | Use Named Ranges (`GLOBAL_USERS_RANGE`) instead of hard‑coding `A2:K`.                                         | Resilient to column re‑order, self‑documenting.                    |
| **Advanced Service**  | For massive ops (> 10 k rows), use **Sheets Advanced Service** batchUpdate (`updateCells`, `appendDimension`). | Cuts HTTP overhead vs Apps Script wrappers.                        |
| **Atomic writes**     | When appending multiple related sheets, write to a hidden temp sheet then `moveTo` target.                     | Guarantees all‑or‑nothing visibility to users.                     |

*Implement gradually; start with diff‑aware writes and row‑index maps—they yield the biggest win with minimal refactor.*

---

> *End of Reference*
