# StudyQuest セットアップガイド

このリポジトリをコピーしてご利用いただく方向けに、最初に一度だけ実行する初期設定手順をまとめました。

1. Apps Script エディタで **Setup.gs** の `quickStudyQuestSetup` 関数を実行します。
2. Google ドライブのマイドライブ直下に **StudyQuest** フォルダが自動作成されます。
3. フォルダ内に以下が配置されます。
   - このスクリプトファイル一式
   - グローバルデータベース用スプレッドシート
   - 本ドキュメント
4. グローバルデータベースのIDはスクリプトプロパティ `Global_Master_DB` に保存されます。
5. 以降は教師としてログインするだけで、教師用データベースが自動生成されます。

グローバルデータベースは全教師が書き込み可能、生徒は読み取り専用となります。教師や生徒のメールアドレスが登録されたタイミングで、必要なアクセス権限がDriveに付与されます。

## スプレッドシート構成一覧

### グローバルDB (Global_Master_DB)

| シート名 | 主な列 |
| --- | --- |
| Global_Users | Email, HandleName, Role, Global_TotalXP, Global_Level, Global_Coins, EquippedTitle, CreatedAt, LastGlobalLogin, LoginStreak, TotalLikesGiven, TotalLikesReceived |
| Global_Trophies_Log | UserTrophyID, UserEmail, TrophyID, AwardedAt |
| Global_Items_Inventory | UserItemID, UserEmail, ItemID, Quantity, AcquiredAt |

### 教師用DB (StudyQuest_DB_<TeacherCode>)

| シート名 | 主な列 |
| --- | --- |
| Enrollments | UserEmail, ClassRole, Grade, Class, Number, EnrolledAt |
| Students | StudentID, Grade, Class, Number, FirstLogin, LastLogin, LoginCount, TotalXP, Level, LastTrophyID, TotalLikes |
| Tasks | TaskID, Title, Subject, Question, Type, Choices, Difficulty, TimeLimit, XpBase, Status, CreatedAt, CorrectAnswer, Explanation, IsAiGenerated |
| Submissions | SubmissionID, UserEmail, TaskID, Answer, EarnedXP, Bonuses, SubmittedAt, AiSummary, LikeScore |
| Trophies | TrophyID, Name, Description, IconURL, Condition |
| Items | ItemID, Name, Type, Price, Effect |
| Leaderboard | Rank, UserEmail, HandleName, Level, TotalXP, UpdatedAt |
| Settings | Key, Value |
| TOC | Sheet, Description |

#### Global_Users
| 列 | 意味 |
| --- | --- |
| Email | Googleアカウントのメールアドレス |
| HandleName | 画面表示用の名前 |
| Role | teacher または student |
| Global_TotalXP | 全体で累積したXP |
| Global_Level | 現在のレベル |
| Global_Coins | 所持コイン数 |
| EquippedTitle | 装備中の称号 |
| CreatedAt | ユーザー登録日時 |
| LastGlobalLogin | 直近のログイン日時 |
| LoginStreak | 連続ログイン日数 |
| TotalLikesGiven | 送信したいいね数 |
| TotalLikesReceived | 受け取ったいいね数 |

#### Global_Trophies_Log
| 列 | 意味 |
| --- | --- |
| UserTrophyID | 付与履歴の一意ID |
| UserEmail | 対象ユーザーのメール |
| TrophyID | トロフィーID |
| AwardedAt | 付与日時 |

#### Global_Items_Inventory
| 列 | 意味 |
| --- | --- |
| UserItemID | 所持アイテムの一意ID |
| UserEmail | 対象ユーザーのメール |
| ItemID | アイテムID |
| Quantity | 所持数 |
| AcquiredAt | 入手日時 |

#### Enrollments
| 列 | 意味 |
| --- | --- |
| UserEmail | 登録メールアドレス |
| ClassRole | student 固定 |
| Grade | 学年 |
| Class | クラス |
| Number | 出席番号 |
| EnrolledAt | 登録日時 |

#### Students
| 列 | 意味 |
| --- | --- |
| StudentID | "学年-組-番号" 形式のID |
| Grade | 学年 |
| Class | クラス |
| Number | 出席番号 |
| FirstLogin | 初回ログイン日時 |
| LastLogin | 最終ログイン日時 |
| LoginCount | ログイン回数 |
| TotalXP | 獲得XP合計 |
| Level | 現在のレベル |
| LastTrophyID | 直近に獲得したトロフィーID |
| TotalLikes | 累計いいね数 |

#### Tasks
| 列 | 意味 |
| --- | --- |
| TaskID | 課題ID |
| Title | タイトル |
| Subject | 教科・カテゴリ |
| Question | 問題文 |
| Type | question形式 (choice/free等) |
| Choices | 選択肢(JSON) |
| Difficulty | 難易度 |
| TimeLimit | 制限時間(秒) |
| XpBase | 基本XP |
| Status | draft/open/closed |
| CreatedAt | 作成日時 |
| CorrectAnswer | 正答 |
| Explanation | 解説 |
| IsAiGenerated | AI生成フラグ |

#### Submissions
| 列 | 意味 |
| --- | --- |
| SubmissionID | 提出ID |
| UserEmail | 回答者メール |
| TaskID | 課題ID |
| Answer | 回答内容 |
| EarnedXP | 得たXP |
| Bonuses | 付与ボーナス |
| SubmittedAt | 提出日時 |
| AiSummary | AI要約 (自由回答時) |
| LikeScore | いいねポイント |

#### Trophies
| 列 | 意味 |
| --- | --- |
| TrophyID | トロフィーID |
| Name | 名称 |
| Description | 説明文 |
| IconURL | アイコンURL |
| Condition | 取得条件(JSON) |

#### Items
| 列 | 意味 |
| --- | --- |
| ItemID | アイテムID |
| Name | 名称 |
| Type | 種類(title/consumable等) |
| Price | 価格 |
| Effect | 効果説明 |

#### Leaderboard
| 列 | 意味 |
| --- | --- |
| Rank | 順位 |
| UserEmail | ユーザーのメール |
| HandleName | 表示名 |
| Level | レベル |
| TotalXP | 累計XP |
| UpdatedAt | 更新日時 |

#### Settings
| 列 | 意味 |
| --- | --- |
| Key | 設定キー |
| Value | 値 |

#### TOC
| 列 | 意味 |
| --- | --- |
| Sheet | シート名 |
| Description | 説明 |
