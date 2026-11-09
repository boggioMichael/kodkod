# איך עובדים בריפו הזה

## הכללים

1. כל שינוי ב-branch משלו, בשם כמו `docs/protocol-draft` או `feat/where-command`.
2. issue לכל משימה, ו-`Closes #N` בתיאור ה-PR.
3. ‏main מוגן: PR עם אישור אחד לפחות, בלי force push ובלי מחיקה.
4. קונפליקט נפתר ב-rebase על main, והדחיפה עם `git push --force-with-lease`.
5. כל חבר כותב לפחות 5 PRs וסוקר 5, עם הערות של ממש ולא רק Approve.

## הודעות commit

<!-- מפגש 5: הקונבנציה שבחרתם (קרנל לינוקס, Chris Beams או Conventional Commits), הכללים שלה, ודוגמה אחת. -->

## שיטת מיזוג

<!-- מפגש 5: merge commit, ‏squash או rebase, ולמה. את שתי האחרות מכבים בהגדרות הריפו. -->

## hooks

<!-- מפגש 5: הסבר קצר על ה-hooks שב-.githooks, ומה כל אחד מהם בודק. -->

אחרי clone מריצים פעם אחת:

```
git config core.hooksPath .githooks
```
