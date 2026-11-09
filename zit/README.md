# zit

פרויקט הסיכום של קורס git: צוותים של 3 מתכננים git מבוזר לריפו ענק, שבו תוכן הקבצים מפוזר בין המחשבים של הצוות. כל צוות מוסיף פיצ'ר מיוחד, ומימוש בקוד הוא בונוס. התדריך המלא, עם אבני הדרך והמחוון, נמצא [במסמך הקורס](https://claude.ai/artifact/GCtFFVn5V4FDjmSYFgKWkt).

## התבנית לצוותים

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
