# kodkod

kodkod devops codespace: סביבת העבודה שלי לקורסים במכללת עתידים. טרמינל Linux בדפדפן ששומר הכול בין שיעור לשיעור, עם כל מה שצריך לקורס git ולהמשך ב-DevOps.

## פתיחה

https://codespaces.new/boggioMichael/kodkod?quickstart=1

הקישור פותח את ה-codespace הקיים, ויוצר חדש רק בפעם הראשונה (דקה-שתיים של התקנה). מכונה של 2 ליבות מספיקה, ובחשבון חינמי יש 60 שעות כאלה בחודש.

בסוף שיעור עוצרים את ה-codespace: ב-github.com/codespaces, בתפריט `⋯` ליד ה-codespace, בוחרים Stop codespace. הוא נעצר גם לבד אחרי 30 דקות בלי פעילות, ושום דבר לא נמחק בעצירה. codespace שלא נפתח 30 יום נמחק.

## מה יש בסביבה

- Ubuntu 24.04 עם git 2.43, הגרסה שבה נבדקו כל הפקודות במערך השיעורים
- GitHub CLI (`gh`), ‏tig ו-git send-email
- Docker, ‏kubectl, ‏helm ו-minikube
- Python 3, ‏Node LTS, ‏gcc, ‏make, ‏gdb ו-strace
- גופן 20 בטרמינל ו-18 בעורך, בשביל המקרן
- VS Code בתור העורך של git: `git rebase -i` ו-commit בלי `-m` נפתחים בלשונית, וסוגרים אותה כדי להמשיך

## פקודות מהירות

| פקודה | מה היא עושה |
| --- | --- |
| `demo <מפגש>` | מכינה את ריפו ההדגמה למפגש 1–5 ונכנסת אליו |
| `graph` | הגרף של כל ה-branches |
| `watch-graph` | הגרף מתעדכן כל שנייה, בשביל טרמינל בצד המסך |

הפרטים על ההדגמות נמצאים ב-[git/README.md](git/README.md).

## מבנה

```
.devcontainer/   הגדרת הסביבה, וההתקנה שרצה פעם אחת
tools/           העזרים של הטרמינל: demo, graph, watch-graph
git/             ההדגמות של קורס git לכל מפגש, ו-hooks
zit/             קורס git: מערך השיעורים, מצגות, תרגילים, ופרויקט הסיכום עם תבנית לצוותים
```

שאר התיקיות (cicd, ‏general_devops, ‏hypervision, ‏kubernetes, ‏nox, ‏os, ‏security) הן הנושאים הבאים במכללה, וכל נושא חדש מקבל תיקייה משלו בשורש. כלי חדש נכנס לרשימה `APT_PACKAGES` ב-`.devcontainer/post-create.sh`, ואחרי שינוי בסביבה מריצים ב-VS Code את הפקודה Codespaces: Rebuild Container.
