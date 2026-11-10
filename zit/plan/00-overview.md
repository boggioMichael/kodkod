# קורס Git — 6 שיעורים ופרויקט zit

9 בנובמבר 2026 · מיכאל בוג׳יו

שישה מפגשים בנובמבר. בכל מפגש 3 שעות אקדמיות (135 דקות) של הדגמה חיה על המחשב שלך מול הכיתה, עם שיח ושאלות, ואחריהן 2 שעות תרגול. הקורס נסגר בפרויקט zit: גרסה מבוזרת של git לריפו ענק, בצוותים של 3.

## מפת הקורס

שני המפגשים הראשונים בונים את הבסיס, ומהמפגש השלישי כל השאר נבנה סביב zit: החניכים מתרגלים את מה שנלמד על הריפו של הצוות.

| מפגש | בשיעור (135 דקות) | בתרגול (120 דקות) | zit |
| --- | --- | --- | --- |
| 1 · יסודות | תרגיל פתיחה בלי git: שלושה על קובץ אחד; מה זה git; working directory, staging ו-commit; branch ו-merge; clone, push ו-pull; PR ו-code review | Learn Git Branching עד Push & Pull שלב 6; git-exercises תרגילים 1–6 | — |
| 2 · שכתוב היסטוריה | amend; קונפליקטים; rebase ו-rebase אינטראקטיבי; cherry-pick; reflog כרשת ביטחון | Learn Git Branching מ-Ramping Up עד Locked Main; שבעה תרגילי rebase ב-git-exercises, עד rebase-complex | — |
| 3 · מאחורי הקלעים | blob, tree, commit ו-refs: בונים commit ביד; GitHub, GitLab ו-Bitbucket; השקת zit | ריפו לכל צוות, PR ראשון לכל חניך וקונפליקט מתוכנן | צוותים, ריפו ו-issues |
| 4 · ארגז כלים | stash, reset ו-revert, bisect, blame, tag, worktree, partial clone ו-sparse-checkout; אחר כך עבודה על zit | עבודה על zit | architecture ו-protocol |
| 5 · hooks והגנות | git hooks ו-webhooks; branch protection ו-rulesets; עבודת צוות ב-GitHub; קונבנציות של צוותים מובילים | hook וכללי הגנה לריפו של הצוות; המשך zit | הפיצ'ר המיוחד |
| 6 · הצגות | הקפאה ו-tag לגרסה v1.0 | הצגות הצוותים | הגשה |

מי שמסיים את התרגול מוקדם ממשיך ב-[GitMastery](https://gitmastery.me), בשלבים שמתאימים למפגש. הם מפורטים בפרק של כל שיעור.

## מבנה כל מפגש

כל מפגש פותח ב-135 דקות של הדגמה ושיח, וממשיך ב-120 דקות תרגול. ההנחה היא ששעתיים התרגול הן שעות שעון. אם הן שעות אקדמיות (90 דקות), חלק א' של התרגול מתקצר ל-35 דקות וחלק ב' ל-45. הזמנים המדויקים בטבלה שבראש כל פרק, ובמצגת של השיעור.

| חלק | דקות | מה קורה |
| --- | --- | --- |
| פתיחה | 5-8 | שאלת חזרה על המפגש הקודם, ושאלת פתיחה של הנושא החדש. בשיעור 1: תרגיל של 17 דקות בלי git |
| שיעור, חלק א' | כ-55 | הדגמה חיה על המחשב שלך, עם שאלות לכיתה |
| הפסקה | 10 | |
| שיעור, חלק ב' | כ-55 | הדגמה חיה של הנושא הבא |
| סיכום | 5-10 | מה לקחנו, ומעבר לתרגול |
| פתיחת התרגול | 5 | חברותות, ומה עושים |
| תרגול, חלק א' | 50 | משחק בדפדפן עד שלב מוגדר |
| תרגול, חלק ב' | 60 | תרגיל קשה בטרמינל |
| סיום התרגול | 5 | בודקים התקדמות |

בשיעורים 3-5 התרגול כולו עבודה על zit, בחלוקה שבפרק של כל שיעור.

ארבעה כללים להדגמה חיה:

1. **קודם מנבאים, אחר כך מריצים.** לפני כל פקודה מעניינת שואלים "מה יקרה עכשיו?", ורק אז מריצים. רוב השאלות בפרקי השיעורים בנויות ככה.
2. **הגרף תמיד על המסך.** טרמינל שני שמריץ `watch -n1 --color git log --oneline --graph --all --color=always`, כך שכל פקודה משנה את הגרף מול העיניים. גופן של 20 נקודות ומעלה, ו-prompt שמציג את ה-branch.
3. **שגיאה היא חומר לימוד.** כשפקודה נכשלת, קוראים את ההודעה יחד ומחפשים בה את הפתרון. git כמעט תמיד מציע את הפקודה הבאה.
4. **תרגול בחברותות.** אחד מקליד והשני מכוון, ומתחלפים בכל שלב. שני המשחקים באנגלית בלבד, והחברותא עוזרת למי שהאנגלית שלו חלשה.

## לפני השיעור הראשון

רוב מה שיכול להשתבש בשיעור 1 הוא גישה: אתר חסום ברשת, חשבון GitHub חסר, או git שלא מותקן. הבדיקות כאן נמשכות שעה, וחוסכות חצי שיעור.

- [ ] בדיקת גישה מרשת המכללה, ומאחורי הסינון אם יש: learngitbranching.js.org, gitmastery.me, github.com, ו-gitexercises.fracz.com, כולל `git clone https://gitexercises.fracz.com/git/exercises.git`
- [ ] גיבוי למקרה שאתר חסום: clone של git-katas מראש, על כל מחשב
- [ ] על כל מחשב: `git --version` עובד, יש עורך כמו VS Code, וב-Windows גם Git Bash
- [ ] חשבון GitHub לכל חניך, ורשימת שמות המשתמש אצלך
- [ ] ארגון GitHub לקורס, והחלטה על סוג הריפו (פירוט מתחת)
- [ ] ריפו `calc-demo` ריק בארגון, וחשבון שני או מתנדב לתפקיד "משה"
- [ ] לתרגיל הפתיחה של שיעור 1: קבוצת וואטסאפ או תיקיית דרייב לכיתה עם הקובץ Calc.java, ו-javac שעובד על כל מחשב
- [ ] תבנית zit בארגון, מסומנת כ-Template repository (התוכן בפרק הפרויקט, תחת "איך עובדים")
- [ ] מסך ההדגמה: גופן 20 ומעלה, prompt עם ה-branch, וחלון `watch` של הגרף
- [ ] חלוקה לשלישיות עד שיעור 3

סוג הריפו קובע את שיעור 5. בחשבון חינמי, branch protection, rulesets ו-CODEOWNERS עובדים רק בריפו ציבורי.

| אפשרות | יתרון | חסרון |
| --- | --- | --- |
| ריפו ציבורי | כל ההגנות חינם, מהיום | הקוד ושמות המשתמש של החניכים גלויים לכולם |
| ריפו פרטי עם GitHub Team | פרטיות, וכל ההגנות | דורש אישור של GitHub Education, שניתן למרצים במוסד מוכר ולוקח זמן |

מרצה שמאומת ב-[GitHub Education](https://docs.github.com/en/education/about-github-education/github-education-for-teachers/about-github-education-for-teachers) מקבל GitHub Team בחינם, עם מספר משתמשים וריפוזיטורים פרטיים ללא הגבלה. אם בוחרים בזה, מגישים השבוע.

## מקורות

כל הדפים נפתחו ונבדקו ב-9 בנובמבר 2026. רשימת השלבים של GitMastery נלקחה מהקוד של האתר, ורשימת התרגילים של git-exercises מהאתר עצמו.

**תרגול**

- [Learn Git Branching](https://learngitbranching.js.org), ו[רשימת השלבים בקוד שלו](https://raw.githubusercontent.com/pcottle/learnGitBranching/main/src/levels/index.js)
- [GitMastery](https://gitmastery.me), ו[הריפו שלו](https://github.com/MikaStiebitz/Git-Mastery)
- [git-exercises](https://gitexercises.fracz.com), ו[סקריפט ההתקנה configure.sh](https://github.com/fracz/git-exercises/blob/master/configure.sh)
- [git-katas](https://github.com/eficode-academy/git-katas), ו[סדר התרגילים המומלץ](https://raw.githubusercontent.com/eficode-academy/git-katas/master/Overview.md)

**GitHub**

- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) ו-[Available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) ו-[About push protection](https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection)
- [About webhooks](https://docs.github.com/en/webhooks/about-webhooks) ו-[Viewing webhook deliveries](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/viewing-webhook-deliveries)
- [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow) ו-[About pull request merges](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges)
- [GitHub Education for teachers](https://docs.github.com/en/education/about-github-education/github-education-for-teachers/about-github-education-for-teachers)

**git**

- [githooks](https://git-scm.com/docs/githooks), [partial-clone](https://git-scm.com/docs/partial-clone), [scalar](https://git-scm.com/docs/scalar), [gitattributes](https://git-scm.com/docs/gitattributes)

**קונבנציות ופלטפורמות**

- [Submitting patches](https://docs.kernel.org/process/submitting-patches.html), [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/), [How to Write a Git Commit Message](https://cbea.ms/git-commit/)
- [Trunk Based Development](https://trunkbaseddevelopment.com/), [A successful Git branching model](https://nvie.com/posts/a-successful-git-branching-model/), [Google code review standard](https://google.github.io/eng-practices/review/reviewer/standard.html)
- [GitLab merge requests](https://docs.gitlab.com/user/project/merge_requests/), [Atlassian Data Center end of life](https://www.atlassian.com/licensing/data-center-end-of-life)

**מקורות השראה ל-zit**

- [git-annex](https://git-annex.branchable.com/), [Git LFS](https://git-lfs.com/), [IPFS: content addressing](https://docs.ipfs.tech/concepts/content-addressing/)
