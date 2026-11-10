# שיעור 2 · amend, קונפליקטים, rebase ו-cherry-pick

## מהלך השיעור

השיעור עולה בדרגת קושי: amend פשוט, אחריו קונפליקט ב-merge שכבר מוכר משיעור 1, ורק אז rebase, שמייצר את אותם קונפליקטים במקום אחר. reflog סוגר את השיעור כרשת ביטחון.

| דקות | חלק | מה מדגימים |
| --- | --- | --- |
| 0-8 | פתיחה | מי נתקע ב-merge-conflict מ-git-exercises, ואיפה |
| 8-20 | amend | תיקון הודעה, קובץ שנשכח, וה-hash שמשתנה |
| 20-50 | קונפליקטים | יוצרים קונפליקט ב-`add()`, קוראים סימונים, `--abort`, פתרון |
| 50-60 | הפסקה | |
| 60-90 | rebase | rebase על main, קונפליקט באמצע, כלל הזהב, `--force-with-lease` |
| 90-110 | rebase אינטראקטיבי | fixup עם autosquash, reword, squash, סידור מחדש |
| 110-119 | cherry-pick | commit בודד ל-main עם `-x` |
| 119-128 | reflog | "מחקתי commit" ושחזור |
| 128-135 | סיכום | טבלת "איזה כלי מתי" |

## ההדגמה

ממשיכים באותו ריפו `calc` משיעור 1. כל הפקודות רצו בריפו בדיקה, כולל ההודעות שמצוטטות בהערות.

### פתיחה (0-8)

שואלים מי סיים את merge-conflict, ומה בילבל. אחר כך מציגים מצב של שני אנשים שדחפו לאותו branch, ושואלים: איך אפשר לחבר בין העבודות? merge מוכר כבר, והיום נכיר דרך נוספת.

### amend (8-20)

```
git commit -am "Pirnt sub example"
git commit --amend -m "Print a sub() example"
# שכחנו קובץ
git add TODO.txt
git commit --amend --no-edit
git show --stat HEAD
```

מראים את ה-hash לפני ואחרי. amend לא משנה commit, אלא יוצר commit חדש במקומו. לכן משתמשים בו רק לפני push.

שאלה לכיתה: שינינו רק את ההודעה. למה ה-hash השתנה? (ההודעה היא חלק מתוכן ה-commit. התשובה המלאה בשיעור 3)

### קונפליקטים (20-50)

```
git switch -c better-add
# משנים ל: return float(a) + float(b)
git commit -am "Make add() work with strings"
git switch main
# משנים ל: return round(a + b, 2)
git commit -am "Round the result of add()"
git merge better-add       # CONFLICT (content): Merge conflict in calc.py
git status --short         # UU calc.py
```

פותחים את הקובץ וקוראים את הסימונים יחד:

```
def add(a, b):
<<<<<<< HEAD
    return round(a + b, 2)
=======
    return float(a) + float(b)
>>>>>>> better-add
```

```
git merge --abort          # חזרה למצב שלפני ה-merge
git merge better-add
# פתרון שמשלב את שני הצדדים: return round(float(a) + float(b), 2)
git add calc.py
git commit --no-edit
git log --oneline --graph -5
```

מראים גם את עורך ה-merge של VS Code, עם Accept Current, Incoming ו-Both.

שאלות לכיתה:

- מי צודק, HEAD או better-add? (שניהם. וכשלא בטוחים, שואלים את מי שכתב)
- למה git לא פותר לבד? (אותה שורה שונתה בשתי דרכים, ו-git לא מבין משמעות)
- לפני `git add`: מה git עדיין לא יודע? (שסיימנו לפתור)
- איך מקטינים קונפליקטים? (PR קטן, branch קצר חיים, pull לעתים קרובות)

### rebase (60-90)

```
git switch -c docs
echo "Usage: python calc.py" >> README.md
git commit -am "Document usage"
git switch main
echo "License: MIT" >> README.md
git commit -am "Add license line"
git switch docs
git rebase main            # CONFLICT (content): Merge conflict in README.md
# פותרים את הקונפליקט
git add README.md
git rebase --continue      # Successfully rebased and updated refs/heads/docs
git log --oneline --graph -4
```

משווים לגרף של merge: קו ישר, בלי merge commit, ול-commit יש hash חדש. כלל הזהב: לא עושים rebase ל-commits שכבר אצל אחרים. על branch שלך שכבר נדחף, דוחפים עם `--force-with-lease`, ולא עם `--force`:

```
git push -u origin docs
git commit --amend -m "Document usage in README"
git push                       # ! [rejected] docs -> docs (non-fast-forward)
git push --force-with-lease    # + ... docs -> docs (forced update)
# בינתיים "משה" דוחף commit ל-docs
git commit --amend -m "Document usage and license"
git push --force-with-lease    # ! [rejected] docs -> docs (stale info)
```

הדחייה האחרונה היא הנקודה: `--force-with-lease` סירב למחוק commit של משה שלא ראינו. מכאן מחליפים את ההגדרה משיעור 1: `git config --global pull.rebase true`.

שאלות לכיתה:

- מה ההבדל בגרף בין merge ל-rebase?
- למה ה-hash של "Document usage" השתנה?
- מה היה קורה עם `--force` רגיל? (ה-commit של משה היה נמחק מהשרת)

### rebase אינטראקטיבי (90-110)

```
git switch -c mod
# מוסיפים mod() עם באג: return a // b
git commit -am "Add mod()"
echo "mod(a, b) returns the remainder" >> README.md
git commit -am "Document mod() in README"
# מתקנים את הבאג: return a % b
git commit -a --fixup HEAD~1      # fixup! Add mod()
git rebase -i --autosquash HEAD~3
git log --oneline -3              # התיקון נבלע בתוך "Add mod()"
```

אחר כך `git rebase -i HEAD~3` רגיל, ועוברים על הפקודות בעורך: `pick`, `reword`, `edit`, `squash`, `fixup`, `drop`, והזזת שורות לשינוי הסדר. בהדגמה התיקון נוגע בקובץ אחר מזה של ה-commit שבאמצע. תיקון שנוגע באותן שורות ייצור קונפליקט באמצע ה-rebase.

שאלות לכיתה: למה מנקים היסטוריה לפני PR? (הסוקר קורא סיפור ברור). מתי אסור? (אחרי שמישהו בנה על ה-commits האלה)

### cherry-pick (110-119)

```
git switch main
git cherry-pick -x mod~1
git log -1 --format=%B    # (cherry picked from commit 0b25cee...)
```

המקרה הקלאסי: תיקון דחוף צריך להגיע ל-main, ושאר ה-branch עוד לא מוכן. `-x` רושם בהודעה מאיפה ה-commit הגיע.

שאלה לכיתה: מה החיסרון? (שני commits עם אותו שינוי ו-hash שונה. merge מאוחר יותר עלול להתבלבל)

### reflog (119-128)

```
git reset --hard HEAD~1   # "אוי, מחקתי commit"
git log --oneline -2
git reflog -3
git reset --hard HEAD@{1}
git log --oneline -2      # ה-commit חזר
```

reflog שומר לאן HEAD הצביע, ולכן commit ש"נעלם" עדיין נמצא. הוא קיים רק במחשב שלך, ולא עובר ב-push.

### סיכום (128-135)

| מצב | כלי |
| --- | --- |
| טעות ב-commit האחרון, לפני push | `git commit --amend` |
| שני branches שינו את אותן שורות | פתרון קונפליקט ו-`git add` |
| לעדכן branch מ-main בלי merge commit | `git rebase main` |
| לסדר commits לפני PR | `git rebase -i` |
| להעביר commit אחד ל-branch אחר | `git cherry-pick -x` |
| דחיפה אחרי rebase של branch שלך | `git push --force-with-lease` |
| "מחקתי משהו" | `git reflog` |

## תרגול (120 דקות)

שני חלקים, המשך המשחק ושבעה תרגילי rebase בסדר קושי עולה, עם פתיחה וסיום קצרים. הקשה מכולם הוא rebase-complex.

| דקות | חלק | מה עושים |
| --- | --- | --- |
| 0-5 | פתיחה | חברותות, וממשיכים מאותו מקום במשחק |
| 5-55 | Learn Git Branching | מ-Ramping Up עד שלבים 7-8 ב-Push & Pull |
| 55-115 | git-exercises: rebase | שבעה תרגילים, מ-fix-typo עד rebase-complex |
| 115-120 | סיום | כל אחד מסביר במשפט מתי rebase ומתי merge |

### חלק א': Learn Git Branching (50 דקות)

| לשונית | רצף | שלבים | מה מתרגלים |
| --- | --- | --- | --- |
| Main | Ramping Up | 1–4 (כולם) | detached HEAD, `^` ו-`~`, ביטול שינויים |
| Main | Moving and Staging Work | 1–2 | cherry-pick, ו-rebase אינטראקטיבי |
| Main | A Mixed Bag | 1–3 | העברת commit בודד, ולהטות סדר commits |
| Remote | Push & Pull | 7–8 | היסטוריה שהתפצלה, ו-main נעול |

מי שמסיים מוקדם עובר ל-Advanced Topics, שלושה שלבים.

### חלק ב': התרגיל הקשה על rebase (60 דקות)

ממשיכים בתיקיית `exercises` משיעור 1. הפקודה `git start <name>` קופצת ישר לתרגיל לפי שם, בלי לעבור בכל הקודמים.

| סדר | תרגיל | מה נדרש |
| --- | --- | --- |
| 1 | fix-typo | amend של קובץ ושל הודעה |
| 2 | too-many-commits | לאחד שני commits לאחד (squash או fixup) |
| 3 | invalid-order | להחליף סדר של שני commits |
| 4 | fix-old-typo | לתקן commit שיש מעליו commit נוסף (`edit`) |
| 5 | commit-lost | למצוא את הגרסה הראשונה של commit שעבר amend (reflog) |
| 6 | pick-your-features | שלושה branches של features, כל אחד כ-commit יחיד אחד |
| 7 | rebase-complex | להעביר תיקון מ-branch שנפתח מ-branch אחר, בלי העבודה שלו |

רמז למדריך, למי שתקוע בתרגיל 7: לצייר קודם את הגרף על דף, ואז לקרוא על `git rebase --onto`. הפקודה מקבלת בסיס חדש, בסיס ישן ו-branch.

קריטריון הצלחה: שבעת התרגילים פתורים, וכל חניך מסביר במשפט אחד מתי rebase ומתי merge.

חלופה בלי רשת: ב-git-katas, `reorder-the-history`, `squashing` ו-`advanced-rebase-interactive`.

### מסלול למתקדמים: GitMastery

השלב Rebasing (חמש משימות, כולל קונפליקטים ב-rebase ו-rebase אינטראקטיבי). אחריו המשימה הרביעית ב-Git Workflows (amend), והשלישית ב-Git Archaeology (reflog).
