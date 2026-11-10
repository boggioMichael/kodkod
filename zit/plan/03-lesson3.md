# שיעור 3 · מאחורי הקלעים, פלטפורמות ופתיחת zit

## מהלך השיעור

החצי הראשון מראה ש-git הוא מאגר של אובייקטים ששמם הוא ה-hash של התוכן. זה בדיוק הרעיון שמאפשר לפזר קבצים בין מחשבים, ולכן zit מושק מיד אחריו.

| דקות | חלק | מה מדגימים |
| --- | --- | --- |
| 0-5 | פתיחה | איפה git שומר את כל ההיסטוריה? כמה מקום תופס branch? |
| 5-20 | סיור ב-`.git` | `HEAD`, `refs/heads`, `objects` |
| 20-44 | אובייקטים | blob, tree ו-commit; אותו תוכן נשמר פעם אחת; בונים commit ביד |
| 44-60 | packfiles וריפו ענק | `gc`, `count-objects`, `verify-pack`, ומה קורה לסרט של 4GB |
| 60-70 | הפסקה | |
| 70-85 | GitHub, GitLab ו-Bitbucket | git מול הפלטפורמה, וטבלת השוואה |
| 85-125 | השקת zit | הבעיה, המשימה, אבני הדרך והמחוון, מתוך פרק הפרויקט |
| 125-135 | צוותים | חלוקה לשלישיות וקבלת ריפו לכל צוות |

## איך git עובד מאחורי הקלעים

כל מה ש-git שומר הוא ארבעה סוגי אובייקטים ב-`.git/objects`, ושם כל אובייקט הוא ה-hash של התוכן שלו. ההדגמה בריפו חדש עם commit אחד של `calc.py`.

### סיור ב-.git וקריאת אובייקטים (5-44)

```
cat .git/HEAD                    # ref: refs/heads/main
cat .git/refs/heads/main         # ה-hash של ה-commit
git cat-file -t HEAD             # commit
git cat-file -p HEAD             # tree, author, committer והודעה
git cat-file -p 'HEAD^{tree}'    # 100644 blob 4693ad3...  calc.py
git cat-file -p HEAD:calc.py     # התוכן עצמו
git hash-object calc.py          # אותו hash כמו של ה-blob
cp calc.py copy.py
git hash-object copy.py          # שוב אותו hash
git branch feature
wc -c .git/refs/heads/feature    # 41 בתים
```

שלוש תובנות ללוח:

- תוכן זהה מקבל אותו hash, ולכן נשמר פעם אחת, בכל מחשב.
- branch הוא קובץ של 41 בתים עם hash של commit. לכן הוא כמעט חינם.
- שינוי של בית אחד משנה את ה-hash. כך כל מחשב מזהה מיד אובייקט פגום.

בונים commit בלי `add` ובלי `commit`, רק עם פקודות plumbing:

```
echo "hello from plumbing" | git hash-object -w --stdin    # <blob>
git update-index --add --cacheinfo 100644,<blob>,hello.txt
git write-tree                                            # <tree>
echo "Add hello.txt by hand" | git commit-tree <tree> -p HEAD    # <commit>
git update-ref refs/heads/main <commit>
git log --oneline
git status --short          #  D hello.txt
git restore hello.txt       # הקובץ קיים ב-commit, ועכשיו גם בתיקייה
```

ה-`D` ב-status הוא רגע טוב לשאלה: הקובץ קיים ב-commit וב-staging, אבל מעולם לא היה בתיקייה.

### packfiles, ולמה ריפו ענק כבד (44-60)

```
git count-objects -v       # count: 6  (אובייקטים בודדים)
git gc
git count-objects -v       # in-pack: 6, packs: 1
git verify-pack -v .git/objects/pack/*.idx | head -5
```

ה-blob הוא הקובץ כולו. סרט של 4GB ששונה עשר פעמים הוא עשרה blobs ענקיים, ו-`git clone` מוריד את כולם. דחיסת ההפרשים ב-pack עובדת טוב על טקסט, וכמעט לא עוזרת לקבצים דחוסים כמו וידאו.

שאלות לכיתה:

- למה git משתמש ב-hash כשם של אובייקט? (אותו שם בכל מחשב, בדיקת שלמות וחיסכון במקום)
- שיניתי אות אחת בקובץ של 1GB. כמה מקום חדש נוסף? (blob מלא חדש, עד ש-gc אולי ידחס)
- מישהו שינה בית אחד בתוך אובייקט בשרת. מה יקרה ב-clone הבא? (ה-hash לא מתאים, ו-git מזהה)
- אם לכל קובץ יש שם שנגזר מהתוכן, האם משנה מאיזה מחשב מורידים אותו? (לא. זו נקודת הפתיחה של zit)

## GitHub, GitLab ו-Bitbucket

שלושתן מאחסנות ריפו של git ומוסיפות עליו שכבת עבודה משותפת: בקשת מיזוג, review, CI והרשאות. ה-PR עצמו הוא פיצ'ר של הפלטפורמה, ולא של git.

| | GitHub | GitLab | Bitbucket |
| --- | --- | --- | --- |
| חברה | Microsoft | GitLab Inc. | Atlassian |
| שם בקשת המיזוג | Pull Request | [Merge Request](https://docs.gitlab.com/user/project/merge_requests/) | Pull Request |
| CI מובנה | GitHub Actions | GitLab CI/CD | Bitbucket Pipelines |
| התקנה בשרת של הארגון | GitHub Enterprise Server | GitLab Self-Managed | Bitbucket Data Center |
| בולט במיוחד | קהילת הקוד הפתוח | פלטפורמת DevOps אחת, גם בהתקנה עצמית | חיבור הדוק ל-Jira |

Atlassian מסיימת את מוצרי ה-Data Center שלה ב-28 במרץ 2029, אבל [Bitbucket Data Center הוחרג](https://www.atlassian.com/licensing/data-center-end-of-life) וימשיך אחרי התאריך הזה.

שאלות לכיתה:

- GitHub נפל לשעה. מה נעצר ומה ממשיך? (commits מקומיים ממשיכים. PR ו-CI נעצרים)
- למה בנק או חברת ביטחון תתקין GitLab בשרת משלה, במקום לעבוד ב-GitHub.com?

## השקת zit ותרגול

בסוף המפגש לכל צוות יש ריפו מוגן, ארבעה PRs ממוזגים לפחות, וקונפליקט אחד שפתרו יחד.

### השקה בשיעור (85-135)

1. פותחים בשאלה: סטודיו משחקים מחזיק ריפו של 2TB עם מודלים, טקסטורות וסרטונים. מה קורה ב-`git clone` של עובד חדש?
2. מקרינים את פרק הפרויקט: הבעיה, מה מגישים, איך עובדים, אבני הדרך והמחוון.
3. מסבירים מה זה "פיצ'ר מיוחד" עם דוגמה אחת בלבד: `zit where <file>`, שמראה באילו מחשבים הקובץ נמצא. השאר על הצוותים.
4. מחלקים לשלישיות, וכל צוות מקבל ריפו מתבנית הפרויקט בארגון של הקורס.

### תרגול (120 דקות)

| דקות | משימה | מה עושים |
| --- | --- | --- |
| 20 | הקמת הריפו | clone לכל חבר, בדיקה ש-main מוגן, וקריאת `CONTRIBUTING.md` |
| 30 | קונפליקט מתוכנן | כל אחד מוסיף שורה ל-`TEAM.md` (שם, תפקיד ותחום) ב-branch משלו, ופותח PR |
| 30 | הבעיה במילים שלנו | פסקה ב-`README.md`, ב-PR אחד שכולם סוקרים |
| 40 | issues ומחקר | חמישה issues לתחומי התכנון; כל חבר חוקר כלי אחד וכותב עליו פסקה ב-`docs/research.md` |

במשימת הקונפליקט, אחרי שה-PR הראשון ממוזג, לשני האחרים יש קונפליקט באותה שורה. זה בכוונה:

```
git fetch origin
git rebase origin/main      # CONFLICT ב-TEAM.md
# פותרים ושומרים את כל השורות
git add TEAM.md
git rebase --continue
git push --force-with-lease
```

אחרי הדחיפה מבקשים review מחדש.

קריטריון הצלחה: ארבעה PRs ממוזגים לפחות. כל חבר כתב PR אחד וסקר PR אחד של חבר, ואין אף commit ישיר ל-main.
