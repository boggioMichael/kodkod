# שיעור 5 · hooks, הגנות ריפו וקונבנציות של צוותים מובילים

## מהלך השיעור

השיעור עונה על שאלה אחת: איך צוות שומר על ריפו משותף נקי ובטוח. מקומית עם hooks, בשרת עם כללים, ובאנשים עם קונבנציות.

| דקות | חלק | מה מדגימים |
| --- | --- | --- |
| 0-5 | פתיחה | איך מוודאים שאף אחד לא דוחף סיסמה, או הודעת commit גרועה? |
| 5-28 | git hooks | `commit-msg`, `pre-commit`, `core.hooksPath`, ו-`--no-verify` |
| 28-43 | webhooks | webhook על push, וקריאת ה-payload ב-Recent Deliveries |
| 43-63 | כללים וחסימות | branch protection ו-rulesets, CODEOWNERS, ו-push ל-main שנדחה |
| 63-73 | הפסקה | |
| 73-88 | עבודת צוות ב-GitHub | הרשאות, issues, תבנית PR, draft ושיטות מיזוג |
| 88-118 | קונבנציות | הודעות commit, אסטרטגיות branch ו-review בצוותים מובילים |
| 118-135 | בחירת קונבנציה | כל צוות בוחר קונבנציה, והסבר על התרגול |

## git hooks ו-webhooks

hook הוא סקריפט ש-git מריץ ברגע מסוים, ויכול לעצור אותו. webhook הוא הודעת HTTP ש-GitHub שולח לשירות אחר אחרי שאירוע כבר קרה.

### git hooks (5-28)

ה-hooks יושבים ב-`.git/hooks`, שם מחכות דוגמאות `.sample`. תיקייה זו לא נכנסת ל-commit, ולכן מחזיקים אותם בתיקייה של הריפו ומפנים אליה עם [`core.hooksPath`](https://git-scm.com/docs/githooks). שני הסקריפטים קוראים את ההגדרות שלהם מ-git config, כך שצוות משנה את הכללים בלי לגעת בקוד.

`.githooks/commit-msg`:

```
#!/bin/sh
# commit-msg: enforce Conventional Commits on the subject line.
# Allowed types and the subject length come from git config, with defaults.
types=$(git config --get hooks.commitTypes || echo "feat|fix|docs|refactor|test|chore")
max=$(git config --get hooks.subjectMax || echo 72)
pattern="^($types)(\([a-z0-9-]+\))?!?: .{1,$max}\$"
subject=$(head -n 1 "$1")
if ! printf '%s\n' "$subject" | grep -Eq "$pattern"; then
    echo "commit-msg: '$subject' does not match $pattern" >&2
    exit 1
fi
```

`.githooks/pre-commit`:

```
#!/bin/sh
# pre-commit: block staged files above a size limit (bytes, from git config).
limit=$(git config --get hooks.maxFileBytes || echo 1048576)
too_big=$(git diff --cached --name-only --diff-filter=AM | while read -r f; do
    size=$(git cat-file -s ":$f")
    [ "$size" -gt "$limit" ] && echo "$f ($size bytes)"
done)
if [ -n "$too_big" ]; then
    echo "pre-commit: staged files above $limit bytes:" >&2
    echo "$too_big" >&2
    exit 1
fi
```

```
chmod +x .githooks/*
git config core.hooksPath .githooks
git commit -am "added stuff"                  # נדחה
git commit -am "feat(calc): add w constant"   # עובר
git add big.bin && git commit -m "chore: add big file"   # נדחה: big.bin (2000000 bytes)
git commit -am "bad message" --no-verify      # עובר!
```

השורה האחרונה היא הנקודה: hook מקומי הוא עזרה למפתח, ולא אכיפה. אכיפה אמיתית קורית בשרת. בשרת git של הארגון זה `pre-receive` ו-`update`, שמסוגלים לדחות דחיפה. ב-GitHub.com זה נעשה בכללים, בחלק הבא.

שאלות לכיתה:

- חבר חדש עשה clone. האם ה-hooks עובדים אצלו? (רק אחרי `core.hooksPath`. לכן זה נכנס ל-`CONTRIBUTING.md`)
- מה עוד כדאי לבדוק ב-`pre-commit`? (סיסמאות, רווחים מיותרים, סימוני קונפליקט שנשכחו)

### webhooks (28-43)

1. בריפו ההדגמה: Settings, ואז Webhooks ו-Add webhook. כתובת כלשהי, סוג תוכן `application/json`, ורק אירוע push.
2. דוחפים commit.
3. פותחים את ה-webhook ואת Recent deliveries. רואים בדיוק את הכותרות וה-payload ש-GitHub שלח, ואת התשובה שחזרה.

GitHub מציג שם את כל המשלוחים מ-3 הימים האחרונים, גם כשהשרת בצד השני לא קיים, כך שלא צריך שירות חיצוני להדגמה ([תיעוד](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/viewing-webhook-deliveries)). שימושים נפוצים לפי [GitHub](https://docs.github.com/en/webhooks/about-webhooks): הפעלת CI, הודעה לצ'אט, עדכון מערכת משימות ופריסה לשרת.

שאלה לכיתה: מה ההבדל בין `pre-receive` ל-webhook? (הראשון רץ לפני העדכון ויכול לחסום. השני מודיע אחרי שזה קרה)

## כללים וחסימות, ועבודת צוות ב-GitHub

בחשבון חינמי כל כללי ההגנה עובדים רק בריפו ציבורי. בריפו פרטי צריך GitHub Pro או Team, ולכן ההחלטה על סוג הריפו נעשית עוד לפני שיעור 3 (ראו "לפני השיעור הראשון" בפרק הסקירה).

### כללים על main (43-63)

| כלל | מה הוא מונע |
| --- | --- |
| Require a pull request, עם אישור אחד | push ישיר ל-main, ומיזוג בלי review |
| Require conversation resolution | מיזוג כשהערות עדיין פתוחות |
| Require status checks | מיזוג של קוד שהבדיקות שלו נכשלו |
| Block force pushes ו-Restrict deletions | מחיקת היסטוריה ומחיקת ה-branch |
| Require linear history | merge commits, אם הצוות בחר squash או rebase |
| Require signed commits | commits שלא נחתמו ואומתו |

מקור: [תיעוד ה-protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches). [rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) הם הדור החדש: כמה rulesets חלים יחד והמחמיר מנצח, אפשר לתת לתפקידים מסוימים לעקוף, ואפשר לכבות בלי למחוק. את מה שה-hook בודק מקומית אוכפים בשרת עם בדיקת סטטוס חובה, למשל GitHub Action שבודק את הודעות ה-commit.

בהדגמה מפעילים ruleset על `main` של `calc-demo`, ומריצים `git push origin main`. הדחיפה נדחית, והשינוי חייב לעבור דרך PR.

עוד שתי שכבות הגנה:

- **[CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners).** קובץ ב-`.github/CODEOWNERS` שמשייך קבצים לאנשים, למשל `/docs/protocol.md @moshe`. הבעלים מתבקשים ל-review אוטומטית, ועם "Require review from Code Owners" האישור שלהם חובה.
- **[push protection](https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection).** ברמת המשתמש היא פעילה כברירת מחדל, ועוצרת דחיפת סודות כמו טוקנים לריפו ציבורי.

### עבודת צוות (73-88)

- **הרשאות.** Read, Triage, Write, Maintain ו-Admin. בפרויקט החניכים מקבלים Write, ואתה Admin.
- **issues.** כל משימה היא issue עם תווית ואחראי. `Closes #12` בתיאור ה-PR סוגר אותה במיזוג.
- **תבנית PR.** `.github/pull_request_template.md` עם שלוש שאלות: מה שינית, למה, ואיך בדקת.
- **draft PR.** פותחים PR מוקדם כדי לקבל כיוון, לפני שהעבודה מוכנה.
- **שיטת מיזוג אחת לצוות.** [שלוש האפשרויות](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges): merge commit שומר את כל ה-commits ונקודת מיזוג; squash הופך את ה-PR ל-commit אחד; rebase מעתיק כל commit ושומר קו ישר. מכבים בהגדרות את מה שלא נבחר.

שאלה לכיתה: עם squash, מה קורה ל-commits הקטנים שכתבתם בתוך ה-PR? מתי זה טוב, ומתי חבל?

## קונבנציות של הצוותים המובילים

אין קונבנציה אחת נכונה, אבל לכל צוות מקצועי יש כללים כתובים שנאכפים. בסוף החלק כל צוות zit בוחר את שלו ורושם אותם ב-`CONTRIBUTING.md`.

### הודעות commit

| מקור | הכללים העיקריים |
| --- | --- |
| [קרנל לינוקס](https://docs.kernel.org/process/submitting-patches.html) | שינוי לוגי אחד בכל patch; הקוד נבנה ורץ אחרי כל patch, בשביל bisect; התיאור בלשון ציווי ומסביר קודם את הבעיה; `Signed-off-by` (עם `git commit -s`); `Fixes:` עם 12 תווים לפחות מה-hash והכותרת |
| [Chris Beams](https://cbea.ms/git-commit/) | שורת נושא עד 50 תווים, עם אות ראשונה גדולה ובלי נקודה, בלשון ציווי; שורה ריקה אחריה; גוף שנשבר ב-72 ומסביר מה ולמה |
| [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) | `<type>(scope): description`; `feat` מעלה גרסת MINOR, `fix` מעלה PATCH, ו-`!` או `BREAKING CHANGE:` מעלים MAJOR; הסוגים מגיעים מהקונבנציה של Angular |

שימו לב לסתירה קטנה: Beams מבקש אות גדולה בתחילת הנושא, וב-Conventional Commits הנושא מתחיל בסוג קטן. בוחרים אחת לכל ריפו, ואוכפים אותה ב-hook.

### אסטרטגיות branch

| אסטרטגיה | איך זה עובד | מתי מתאים |
| --- | --- | --- |
| [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow) | branch קצר, PR, review, מיזוג ל-main ומחיקת ה-branch | רוב הצוותים, וגם zit |
| [Trunk-based](https://trunkbaseddevelopment.com/) | כולם משלבים ל-main לעתים קרובות, branches של שעות, ועבודה לא גמורה מוסתרת מאחורי feature flags | Google עובדת כך ב-monorepo אחד עם כ-35,000 מפתחים ובודקים |
| [Git flow](https://nvie.com/posts/a-successful-git-branching-model/) | branches קבועים ל-develop, release ו-hotfix | תוכנה עם גרסאות מפורשות. המחבר כתב במרץ 2020 שלאתרי ווב עדיף GitHub flow |

### review

- [Google](https://google.github.io/eng-practices/review/reviewer/standard.html): מאשרים שינוי ברגע שהוא משפר בוודאות את בריאות הקוד, גם אם הוא לא מושלם. הערה לא חשובה מסומנת `Nit:`.
- הקרנל: שינוי לוגי אחד בכל patch, כדי שאפשר יהיה לבדוק אותו לבד.

שאלות לכיתה:

- למה דווקא הקרנל מתעקש שכל patch ייבנה? (אחרת bisect נתקע באמצע)
- מה מרוויחים מ-`feat` ו-`fix` בהודעה? (אפשר להפיק changelog ומספר גרסה אוטומטית)
- איזו אסטרטגיה מתאימה לצוות של שלושה אנשים בשבועיים?

## תרגול (120 דקות)

כל צוות מגן את הריפו שלו בעצמו, ומוכיח שההגנה עובדת. השעה השנייה מוקדשת לפיצ'ר המיוחד.

| דקות | משימה | הוכחה שזה עובד |
| --- | --- | --- |
| 25 | `.githooks/commit-msg` ו-`.githooks/pre-commit`, והוראה ל-`core.hooksPath` ב-`CONTRIBUTING.md` | כל חבר מראה commit עם הודעה גרועה שנדחה |
| 20 | ruleset על main: PR עם אישור, בלי force push ובלי מחיקה, ופתרון כל השיחות | `git push origin main` נדחה |
| 15 | `CODEOWNERS` (כל חבר בעלים על מסמך אחד) ותבנית PR | PR שנוגע במסמך מבקש review מהבעלים לבד |
| 60 | `docs/feature.md`: הבעיה, סיפור משתמש, התכנון ודוגמת שימוש, והחלטת תכנון שלישית | ממוזג עם שני אישורים |

מי שרוצה אתגר: GitHub Action שבודק את הודעות ה-commit ב-PR, שמוגדר כבדיקת סטטוס חובה. כך הכלל נאכף גם על מי שעוקף את ה-hook.

מסלול למתקדמים: השלבים Git Mastery (כולל Git Hooks and Automation), Team Collaboration ו-Git Workflows ב-GitMastery.
