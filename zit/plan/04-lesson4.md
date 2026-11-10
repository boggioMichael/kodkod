# שיעור 4 · ארגז כלים מתקדם ועבודה על zit

## מהלך השיעור

שעה ראשונה של כלים שכל מפתח צריך, ומסתיימת במה ש-git עצמו מציע לריפו ענק. משם עוברים ל-zit עד סוף המפגש.

| דקות | חלק | מה מדגימים |
| --- | --- | --- |
| 0-5 | פתיחה | save-your-work משיעור 1: מי מצא את הכלי? |
| 5-13 | stash | לשמור עבודה בצד, כולל קבצים חדשים |
| 13-25 | reset ו-revert | שלושת מצבי reset, ו-revert אחרי push |
| 25-40 | bisect | חיפוש בינארי של commit ששבר, ידני ואוטומטי |
| 40-46 | blame ו-log | מי כתב שורה, ומתי נכנס טקסט |
| 46-51 | tag | tag מוער, `describe` |
| 51-55 | worktree | שני branches פתוחים באותו זמן |
| 55-67 | ריפו ענק | partial clone, sparse-checkout ו-shallow, עם מדידות |
| 67-77 | הפסקה | |
| 77-135 | zit | עבודה בצוותים, ו-review חי על PR אחד מכל צוות |

## ההעשרה

כל הפקודות רצו בריפו בדיקה. המדידות בחלק האחרון מריפו עם קובץ בינארי של 3MB שהוחלף פעם אחת.

### stash (5-13)

```
git stash push -u -m "half-done example"   # -u כולל קבצים חדשים
git status --short                          # נקי
git stash list                              # stash@{0}: On main: half-done example
git stash pop
```

### reset ו-revert (13-25)

| פקודה | ה-commit | staging | הקבצים | מתי |
| --- | --- | --- | --- | --- |
| `git reset --soft HEAD~1` | מבוטל | השינויים staged | נשארים | לכתוב commit מחדש |
| `git reset HEAD~1` (mixed) | מבוטל | ריק | נשארים | לפצל commit |
| `git reset --hard HEAD~1` | מבוטל | ריק | נמחקים | לזרוק עבודה, בזהירות |
| `git revert <sha>` | נשאר, ונוסף commit הפוך | — | — | ביטול של commit שכבר נדחף |

```
git reset --soft HEAD~1    # M  calc.py   (staged)
git reset HEAD             #  M calc.py   (unstaged)
git reset --hard HEAD      # נקי
git revert --no-edit HEAD  # Revert "Add y"
```

### bisect (25-40)

בריפו יש 10 commits אחרי `v1.0`, ואחד מהם שובר את `add()`. קודם מדגימים ידנית עם `git bisect good` ו-`git bisect bad`, ואז באופן אוטומטי:

```
cat > test.sh <<'EOF'
#!/bin/sh
python3 -B -c "import calc; assert calc.add(2, 3) == 5"
EOF
chmod +x test.sh
git bisect start HEAD v1.0
git bisect run ./test.sh    # ... is the first bad commit: Refactor add()
git bisect reset
```

הדגל `-B` חשוב. בלעדיו Python עלול להשתמש ב-`.pyc` ישן, ו-bisect מצביע על commit לא נכון. זה קרה בבדיקה.

### blame ו-log (40-46)

```
git blame -L 1,2 calc.py         # מי כתב כל שורה, ובאיזה commit
git log -S "a - b" --oneline     # ה-commit שהכניס את הטקסט
git log -p --follow calc.py      # כל ההיסטוריה של קובץ, גם אחרי שינוי שם
```

### tag (46-51)

```
git tag -a v1.0 -m "First release"
git push origin v1.0
git describe              # v1.0-1-g8e0613c
```

### worktree (51-55)

```
git worktree add ../hotfix -b hotfix v1.0   # תיקייה שנייה על branch אחר
git worktree list
git worktree remove ../hotfix
```

### ריפו ענק (55-67)

| פקודה | גודל `.git` בבדיקה |
| --- | --- |
| `git clone <url> full` | 6.0M |
| `git clone --filter=blob:none --sparse <url> lazy` | 200K |
| `git sparse-checkout set docs`, בתוך lazy | 212K, רק `docs/` בתיקייה |
| `git sparse-checkout disable` | 3.1M, רק הגרסה הנוכחית של הקובץ |
| `git clone --depth 1 <url> shallow` | 3.1M, בלי היסטוריה |

ב-[partial clone](https://git-scm.com/docs/partial-clone), git מוריד קודם commits ו-trees, ו-blobs רק כשצריך. השרת צריך לאפשר סינון. בהדגמה עם שרת מקומי מריצים `git -C big.git config uploadpack.allowFilter true`.

שאלות לכיתה:

- reset או revert על commit שכבר ב-main המשותף? (revert)
- bisect מצא את הבאג מתוך 1,000 commits בכ-10 צעדים. למה? (חיפוש בינארי)
- מה חייב להיות נכון לגבי כל commit, כדי ש-bisect יעבוד? (שהקוד נבנה ורץ אחרי כל commit)
- partial clone מוריד blobs לפי הצורך. מאיפה, ומה קורה כשהשרת הזה למטה? (משרת אחד, והעבודה נעצרת. זו בדיוק הבעיה ש-zit פותר)

## עבודה על zit

בסוף המפגש הארכיטקטורה והפרוטוקול ממוזגים כטיוטה, ולכל צוות יש הצעה לפיצ'ר מיוחד. שעה בשיעור ועוד 120 דקות תרגול מוקדשות לפרויקט.

### בשיעור (77-135): review חי

הצוותים עובדים, ואתה מקרין PR פתוח אחד מכל צוות, בהסכמתם. סוקרים אותו יחד בכ-5 דקות: מה ברור, מה חסר, ואיך נראית הערה טובה.

### תרגול (120 דקות): היעד לסוף המפגש

- [ ] `docs/architecture.md` ממוזג, עם תרשים Mermaid של הרכיבים
- [ ] `docs/protocol.md` ממוזג כטיוטה: איך מחשבים מוצאים ומעבירים קבצים
- [ ] שתי החלטות תכנון (ADR) ב-`docs/decisions/`
- [ ] issue עם הצעה לפיצ'ר המיוחד, עם התווית `proposal`
- [ ] כל חבר כתב עוד שני PRs וסקר עוד שניים

חלוקת הזמן בתרגול:

| דקות | חלק | מה עושים |
| --- | --- | --- |
| 0-10 | חלוקת עבודה | issue לכל משימה, ואחראי לכל issue |
| 10-55 | `architecture.md` | הרכיבים, מה כל מחשב שומר, תרשים Mermaid, PR ו-review |
| 55-90 | `protocol.md` (טיוטה) | איך מחשב מוצא מי מחזיק אובייקט, איך מעבירים ובודקים את ה-hash, PR ו-review |
| 90-110 | החלטות תכנון והצעת פיצ'ר | שתי ADR ב-`docs/decisions/`, ו-issue עם התווית `proposal` |
| 110-120 | סגירה | שני PRs ושני reviews לכל חבר, הכול ממוזג |

### מסלול למתקדמים ותרגול של העשרה

השלבים ב-GitMastery שמתאימים בדיוק להעשרה: Undoing Commits, Git Stash, Advanced Git Techniques (tag ו-bisect) ו-Git Archaeology (blame, log ו-reflog). שני תרגילי bisect בלי רשת נמצאים ב-git-katas: `bisect` ו-`Bad-commit`.
