# קורס git · קודקוד, מכללת עתידים

שישה מפגשים. בכל מפגש 135 דקות של עבודה חיה ב-git מול הכיתה, ו-120 דקות תרגול. מערך השיעורים המלא, עם זמנים, פקודות ושאלות לכיתה, נמצא [במסמך הקורס](https://claude.ai/artifact/GCtFFVn5V4FDjmSYFgKWkt). כאן נמצא מה שצריך להריץ.

| מפגש | נושא | תרגול |
| --- | --- | --- |
| 1 | מה זה git, שלושת המצבים, branch ו-merge, עבודה עם אחרים, PR ו-code review | Learn Git Branching עד Push & Pull 6, ו-git-exercises 1–6 |
| 2 | amend, קונפליקטים, rebase, rebase אינטראקטיבי, cherry-pick ו-reflog | Learn Git Branching עד Locked Main, ושבעה תרגילי rebase ב-git-exercises |
| 3 | מאחורי הקלעים: blob, tree, commit ו-refs. ‏GitHub, ‏GitLab ו-Bitbucket. פתיחת zit | zit: PR ראשון וקונפליקט מתוכנן |
| 4 | stash, reset ו-revert, bisect, blame, tag, worktree, וריפו ענק | zit: ארכיטקטורה ופרוטוקול |
| 5 | git hooks ו-webhooks, rulesets, CODEOWNERS וקונבנציות של צוותים | zit: hooks, כללי הגנה ו-feature.md |
| 6 | הקפאת גרסה, tag ו-Release, והצגות הצוותים | — |

## ההדגמות: `demo <מפגש>`

הפקודה מכינה ב-`~/demo` את פרויקט calc במצב שבו המפגש מתחיל, ונכנסת לתיקייה. היא משחזרת בפועל את ההדגמות של המפגשים הקודמים, כך שאפשר לקפוץ לכל מפגש, או להתחיל מחדש באמצע שיעור אם משהו השתבש. `~/demo` קיים עובר לגיבוי `~/demo.bak-<תאריך>`, ולא נמחק.

| פקודה | מה מוכן |
| --- | --- |
| `demo 1` | תיקייה ריקה, ו-`server.git` כשרת מקומי למקרה שהרשת נופלת |
| `demo 2` | calc בסוף מפגש 1, עם השרת המקומי ועם `calc-moshe` בתור השותף |
| `demo 3` | calc בסוף מפגש 2: אחרי amend, קונפליקט שנפתר, rebase, ‏fixup ו-cherry-pick |
| `demo 4` | tag `v1.0` ואחריו 10 commits, שאחד מהם (`Refactor add()`) שובר את `add()`, ו-`big.git` להדגמת הריפו הענק |
| `demo 5` | הבאג כבר תוקן, שני ה-hooks ב-`.githooks` (עדיין בלי הרשאת הרצה), ו-`big.bin` בגודל 2,000,000 בתים |

כדאי לדעת לפני מפגש 4:

- **tag.** ב-`demo 4` כבר יש `v1.0`, כי bisect צריך אותו. בחלק של tag יוצרים `v1.1`.
- **ריפו ענק.** משכפלים את `big.git` דרך `file://`. עם נתיב רגיל git מדפיס `--filter is ignored in local clones` ומוריד הכול, וכך גם עם `--depth`.

```
cd ~/demo
git clone file://$HOME/demo/big.git full
git clone --filter=blob:none --sparse file://$HOME/demo/big.git lazy
du -sh full/.git lazy/.git
```

המדידות שיצאו כאן, מול אלה שבמסמך:

| שלב | גודל `.git` |
| --- | --- |
| clone מלא | 6.2M |
| `--filter=blob:none --sparse` | 212K |
| ואחריו `sparse-checkout set docs` | 224K |
| ואחריו `sparse-checkout disable` | 3.3M |
| `--depth 1` | 3.2M |

`graph` מציג את הגרף. ‏`watch-graph` בטרמינל שני מצייר אותו מחדש כל שנייה, וכדאי להשאיר אותו פתוח בצד המסך.

אחרי כל שינוי בהדגמות מריצים `git/demos/selftest.sh`. הוא מריץ את כל ההכנות בתיקייה זמנית ובודק אותן, כולל ש-bisect מוצא את `Refactor add()` ושה-hooks עוצרים בדיוק את מה שהשיעור מראה. כל התוכן של ההדגמה (שמות, שורות קוד, גדלים) מרוכז ב-`demos/config.sh`.

## hooks

`hooks/commit-msg` ו-`hooks/pre-commit` הם הסקריפטים ממפגש 5. שניהם קוראים את ההגדרות שלהם מ-git config:

| הגדרה | ברירת מחדל |
| --- | --- |
| `hooks.commitTypes` | `feat\|fix\|docs\|refactor\|test\|chore` |
| `hooks.subjectMax` | `72` |
| `hooks.maxFileBytes` | `1048576` |

## פרויקט zit

תבנית הפרויקט לצוותים נמצאת ב-[`zit/template`](../zit/template), יחד עם ההוראות להעלות אותה כ-Template repository לפני מפגש 3.

## תרגול

- [Learn Git Branching](https://learngitbranching.js.org): כותבים `levels` כדי לפתוח את תפריט השלבים
- [git-exercises](https://gitexercises.fracz.com): ‏`git clone https://gitexercises.fracz.com/git/exercises.git`, ואז `./configure.sh` ו-`git start`
- [git-katas](https://github.com/eficode-academy/git-katas): חלופה שעובדת בלי רשת אחרי clone אחד
- [GitMastery](https://gitmastery.me): מסלול למתקדמים
