# zit · קורס git

קורס git של קודקוד במכללת עתידים: שישה מפגשים, בכל אחד 135 דקות של עבודה חיה מול הכיתה ו-120 דקות תרגול, ובסופם פרויקט הסיכום zit. כאן נמצא כל החומר של הקורס. ההדגמות שרצות בטרמינל (`demo <מפגש>`) וה-hooks נמצאים ב-[`git/`](../git).

| תיקייה | מה בה |
| --- | --- |
| [`plan/`](plan) | מערך השיעורים המלא: סקירה, שישה מפגשים, תדריך הפרויקט והערות למדריך, ועותק Word שלו (`zit-plan.docx`) |
| [`slides/`](slides) | מצגת לכל מפגש: כותרת ענקית לכל נושא, נקודות למדריך, תשובות בהערות הדובר, ו-cheatsheet בסוף |
| [`exercises/`](exercises) | תרגיל הפתיחה של מפגש 1: `Calc.java` בלי git |
| [`template/`](template) | התבנית לריפו של כל צוות בפרויקט |
| [`build/`](build) | הקוד שבונה את המצגות ואת עותק ה-Word |

## המפגשים

| מפגש | נושא | חומר |
| --- | --- | --- |
| 1 | תרגיל פתיחה בלי git, שלושת המצבים, branch ו-merge, עבודה עם אחרים, PR ו-code review | [מערך](plan/01-lesson1.md) · [מצגת](slides/01-lesson1.pptx) · [תרגיל](exercises/lesson1-calc) |
| 2 | amend, קונפליקטים, rebase, rebase אינטראקטיבי, cherry-pick ו-reflog | [מערך](plan/02-lesson2.md) · [מצגת](slides/02-lesson2.pptx) |
| 3 | מאחורי הקלעים, ‏GitHub, ‏GitLab ו-Bitbucket, והשקת zit | [מערך](plan/03-lesson3.md) · [מצגת](slides/03-lesson3.pptx) |
| 4 | stash, reset ו-revert, bisect, blame, tag, worktree, וריפו ענק | [מערך](plan/04-lesson4.md) · [מצגת](slides/04-lesson4.pptx) |
| 5 | git hooks ו-webhooks, כללי הגנה וקונבנציות של צוותים | [מערך](plan/05-lesson5.md) · [מצגת](slides/05-lesson5.pptx) |
| 6 | הקפאת גרסה, tag ו-Release, והצגות הצוותים | [מערך](plan/06-lesson6.md) · [מצגת](slides/06-lesson6.pptx) |

הסקירה ב-[`plan/00-overview.md`](plan/00-overview.md), תדריך הפרויקט ב-[`plan/07-project.md`](plan/07-project.md), וההערות למדריך ב-[`plan/08-instructor.md`](plan/08-instructor.md).

## פרויקט zit

צוותים של 3 מתכננים git מבוזר לריפו ענק, שבו תוכן הקבצים מפוזר בין המחשבים של הצוות. כל צוות מוסיף פיצ'ר מיוחד, ומימוש בקוד הוא בונוס.

`template/` היא נקודת ההתחלה של הריפו של כל צוות: README עם כותרות, `TEAM.md`, `CONTRIBUTING.md`, שלדים לכל מסמכי `docs/` עם השאלות המנחות, תבנית להחלטת תכנון (ADR) ותבנית PR.

לפני מפגש 3 מעלים אותה כריפו נפרד בארגון של הקורס, ומסמנים אותו כ-Template repository:

```
cp -r zit/template /tmp/zit-template && cd /tmp/zit-template
git init -b main && git add . && git commit -m "Add the zit project template"
gh repo create <org>/zit-template --private --source . --push
gh repo edit <org>/zit-template --template
```

ב-codespace, ‏`gh` מקבל כברירת מחדל טוקן שמוגבל לריפו הזה. אם הוא מסרב ליצור ריפו בארגון, מריצים קודם `unset GITHUB_TOKEN` ואז `gh auth login`.

בחשבון חינמי, כללי ההגנה על main עובדים רק בריפו ציבורי. לריפו פרטי צריך GitHub Team, שאפשר לקבל בחינם דרך GitHub Education.

## בנייה מחדש

כל מצגת נבנית מקובץ JSON אחד ב-`build/slides/lessons`, שבו כל קטע במפגש עם הזמנים, מה אומרים, מה מדגימים ומה שואלים. הבנייה מעריכה כמה זמן לוקח כל קטע, ונעצרת אם קטע לא נכנס בזמן שהוקצב לו. מערך השיעורים נכתב ב-`plan/*.md`, ועותק ה-Word נבנה ממנו.

```
cd zit/build
npm install
npm run slides   # המצגות ל-slides/, ודוח הזמנים ל-build/slides/out/timing.json
npm run plan     # plan/*.md ל-plan/zit-plan.docx
```

כל הטקסטים, הגדלים והצבעים של המצגות נמצאים ב-`build/slides/config.json`, ושל עותק ה-Word ב-`build/plan/config.json`.
