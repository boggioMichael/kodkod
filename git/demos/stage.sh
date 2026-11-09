#!/usr/bin/env bash
# Prepares the calc demo in the state each lesson of the git course starts
# from, by replaying the demos of the lessons before it.
#
#   stage.sh <lesson>    lesson is 1-5
#   stage.sh --help
#
# Environment (see config.sh):
#   KODKOD_DEMO_DIR       where the demo lives        (default: ~/demo)
#   KODKOD_PARTNER_NAME   the simulated teammate       (default: Moshe)
#   KODKOD_PARTNER_EMAIL  the teammate's commit email  (default: moshe@example.com)
#
# An existing demo directory is moved aside to <dir>.bak-<timestamp>, never deleted.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly HOOKS_DIR="$SCRIPT_DIR/../hooks"
# shellcheck source=config.sh
source "$SCRIPT_DIR/config.sh"

# What each lesson needs on top of the lesson before it.
readonly -a PREPARE=(
    [2]=replay_lesson_1
    [3]=replay_lesson_2
    [4]=prepare_lesson_4
    [5]=prepare_lesson_5
)

readonly -a NEXT_STEP=(
    [1]="mkdir calc && cd calc && git init    (offline remote: ../server.git)"
    [2]="git log --oneline --graph --all"
    [3]="cat .git/HEAD"
    [4]="git log --oneline $RELEASE_TAG..$MAIN    (big repo: file://$BIG_SERVER)"
    [5]="chmod +x $HOOKS_DEMO_DIR/* && git config core.hooksPath $HOOKS_DEMO_DIR"
)

# ----------------------------------------------------------------- helpers --

log() { printf '%s\n' "$*"; }
die() { printf 'stage: %s\n' "$*" >&2; exit 1; }

on_error() {
    printf 'stage: failed at line %s. The end of %s:\n' "$1" "$LOG_FILE" >&2
    tail -n 20 "$LOG_FILE" >&2 2>/dev/null || true
}
trap 'on_error $LINENO' ERR

calc_git() { git -C "$REPO" "$@" >>"$LOG_FILE" 2>&1; }

partner_git() {
    GIT_AUTHOR_NAME="$PARTNER_NAME" GIT_AUTHOR_EMAIL="$PARTNER_EMAIL" \
    GIT_COMMITTER_NAME="$PARTNER_NAME" GIT_COMMITTER_EMAIL="$PARTNER_EMAIL" \
        git -C "$PARTNER_REPO" "$@" >>"$LOG_FILE" 2>&1
}

# A step the lesson shows failing on purpose: a rejected push, a conflict.
expect_failure() {
    if "$@"; then
        die "expected this step to fail: $*"
    fi
}

# Replace a file with stdin, keeping the file's permissions.
rewrite() {
    local tmp
    tmp="$(mktemp)"
    cat > "$tmp"
    cat "$tmp" > "$1"
    rm -f "$tmp"
}

append_line()   { printf '%s\n' "$2" >> "$1"; }
append_block()  { printf '\n\n%s\n' "$2" >> "$1"; }               # a top-level block
prepend_block() { { printf '%s\n\n\n' "$2"; cat "$1"; } | rewrite "$1"; }  # before the first block
random_file()   { head -c "$2" /dev/urandom > "$1"; }

# Swap every line equal to $2 for $3, which may span several lines.
replace_line() {
    OLD="$2" NEW="$3" awk '
        $0 == ENVIRON["OLD"] { print ENVIRON["NEW"]; found = 1; next }
        { print }
        END { exit !found }
    ' "$1" | rewrite "$1"
}

# Swap the block that starts at the line equal to $2, up to the next empty line, for $3.
replace_block() {
    FIRST="$2" NEW="$3" awk '
        skipping && $0 == "" { skipping = 0 }
        skipping { next }
        $0 == ENVIRON["FIRST"] { print ENVIRON["NEW"]; skipping = 1; found = 1; next }
        { print }
        END { exit !found }
    ' "$1" | rewrite "$1"
}

# Resolve every conflict in a file by keeping both sides.
resolve_keep_both() {
    awk '!/^(<<<<<<< |=======$|>>>>>>> )/' "$1" | rewrite "$1"
}

# Resolve every conflict in a file with the given text.
resolve_with() {
    TEXT="$2" awk '
        /^<<<<<<< / { print ENVIRON["TEXT"]; inside = 1; next }
        /^>>>>>>> / { inside = 0; next }
        inside { next }
        { print }
    ' "$1" | rewrite "$1"
}

commit_change() {         # message command...: run the command, then commit -am
    local message=$1
    shift
    "$@"
    calc_git commit -q -am "$message"
}

free_backup_path() {
    local base candidate n=1
    base="$DEMO_DIR.bak-$(date +%Y%m%d-%H%M%S)"
    candidate=$base
    while [[ -e $candidate ]]; do
        candidate="$base-$n"
        n=$((n + 1))
    done
    printf '%s\n' "$candidate"
}

# ----------------------------------------------------------------- lessons --

setup_workspace() {
    if [[ -e $DEMO_DIR ]]; then
        local backup
        backup="$(free_backup_path)"
        mv "$DEMO_DIR" "$backup"
        log "The previous demo was moved to $backup"
    fi
    mkdir -p "$DEMO_DIR"
    : > "$LOG_FILE"
    git init -q --bare --initial-branch="$MAIN" "$SERVER"
}

replay_lesson_1() {
    local calc="$REPO/$CALC_FILE" readme="$REPO/$README_FILE"

    # The three states
    git init -q --initial-branch="$MAIN" "$REPO"
    snippet_add > "$calc"
    calc_git add "$CALC_FILE"
    calc_git commit -q -m "Add calculator with add()"
    append_block "$calc" "$(snippet_sub)"
    append_line "$REPO/$ENV_FILE" "$ENV_SECRET_LINE"
    append_line "$REPO/.gitignore" "$ENV_FILE"
    calc_git add .gitignore "$CALC_FILE"
    calc_git commit -q -m "Add sub() and ignore .env"

    # branch and merge
    calc_git switch -q -c add-mul
    append_block "$calc" "$(snippet_mul)"
    calc_git commit -q -am "Add mul()"
    calc_git switch -q "$MAIN"
    calc_git merge -q add-mul
    calc_git branch -q -d add-mul
    calc_git switch -q -c add-div
    append_block "$calc" "$(snippet_div)"
    calc_git commit -q -am "Add div()"
    calc_git switch -q "$MAIN"
    readme_intro > "$readme"
    calc_git add "$README_FILE"
    calc_git commit -q -m "Add README"
    calc_git merge -q --no-edit add-div
    calc_git branch -q -d add-div

    # Working with others: the teammate pushes first, so our push is rejected
    calc_git remote add origin "$SERVER"
    calc_git push -q -u origin "$MAIN"
    git clone -q "$SERVER" "$PARTNER_REPO" >>"$LOG_FILE" 2>&1
    append_line "$PARTNER_REPO/$README_FILE" "$README_MAINTAINERS"
    partner_git commit -q -am "Name the maintainers in README"
    partner_git push -q
    prepend_block "$calc" "$MODULE_DOCSTRING"
    calc_git commit -q -am "Add a module docstring"
    expect_failure calc_git push -q
    calc_git pull -q --no-rebase --no-edit
    calc_git push -q

    # The daily flow, then a PR merged the way GitHub merges it
    calc_git switch -q -c fix-div-by-zero
    replace_line "$calc" "$DIV_RETURN" "$(snippet_div_guarded)"
    calc_git commit -q -am "Check division by zero"
    calc_git push -q -u origin fix-div-by-zero
    calc_git switch -q "$MAIN"
    calc_git merge -q --no-ff -m "Merge pull request #1 from fix-div-by-zero" fix-div-by-zero
    calc_git push -q origin "$MAIN"
    calc_git push -q origin --delete fix-div-by-zero
    calc_git branch -q -d fix-div-by-zero
    partner_git pull -q --no-rebase
}

replay_lesson_2() {
    local calc="$REPO/$CALC_FILE" readme="$REPO/$README_FILE"

    # amend
    append_block "$calc" "$(snippet_example)"
    calc_git commit -q -am "Pirnt sub example"
    calc_git commit -q --amend -m "Print a sub() example"
    append_line "$REPO/$TODO_FILE" "$TODO_LINE"
    calc_git add "$TODO_FILE"
    calc_git commit -q --amend --no-edit

    # Conflicts: abort once, then resolve by combining both sides
    calc_git switch -q -c better-add
    replace_line "$calc" "$ADD_RETURN" "$ADD_FLOAT_RETURN"
    calc_git commit -q -am "Make add() work with strings"
    calc_git switch -q "$MAIN"
    replace_line "$calc" "$ADD_RETURN" "$ADD_ROUND_RETURN"
    calc_git commit -q -am "Round the result of add()"
    expect_failure calc_git merge better-add
    calc_git merge --abort
    expect_failure calc_git merge better-add
    resolve_with "$calc" "$ADD_RESOLVED_RETURN"
    calc_git add "$CALC_FILE"
    calc_git commit -q --no-edit
    calc_git branch -q -d better-add

    # rebase with a conflict in the middle, then --force-with-lease
    calc_git switch -q -c docs
    append_line "$readme" "$README_USAGE"
    calc_git commit -q -am "Document usage"
    calc_git switch -q "$MAIN"
    append_line "$readme" "$README_LICENSE"
    calc_git commit -q -am "Add license line"
    calc_git switch -q docs
    expect_failure calc_git rebase "$MAIN"
    resolve_keep_both "$readme"
    calc_git add "$README_FILE"
    calc_git -c core.editor=true rebase --continue
    calc_git push -q -u origin docs
    calc_git commit -q --amend -m "Document usage in README"
    expect_failure calc_git push -q
    calc_git push -q --force-with-lease
    partner_git fetch -q
    partner_git switch -q docs
    append_line "$PARTNER_REPO/$README_FILE" "$README_WELCOME"
    partner_git commit -q -am "Welcome contributions in README"
    partner_git push -q
    calc_git commit -q --amend -m "Document usage and license"
    expect_failure calc_git push -q --force-with-lease
    calc_git fetch -q
    calc_git reset -q --hard origin/docs

    # Interactive rebase: a fixup squashed in with autosquash
    calc_git switch -q -c mod
    append_block "$calc" "$(snippet_mod_buggy)"
    calc_git commit -q -am "Add mod()"
    append_line "$readme" "$README_MOD"
    calc_git commit -q -am "Document mod() in README"
    replace_line "$calc" "$MOD_BUGGY_RETURN" "$MOD_FIXED_RETURN"
    calc_git commit -q -a --fixup HEAD~1
    calc_git -c sequence.editor=: rebase -q -i --autosquash HEAD~3

    # cherry-pick, then the reflog rescue
    calc_git switch -q "$MAIN"
    calc_git cherry-pick -x mod~1
    calc_git reset -q --hard HEAD~1
    calc_git reset -q --hard 'HEAD@{1}'

    # One clean main for the lessons that follow
    calc_git merge -q --no-edit mod
    calc_git push -q origin "$MAIN"
    calc_git push -q origin --delete docs
    calc_git branch -q -d docs mod
    partner_git switch -q "$MAIN"
    partner_git pull -q --no-rebase
    partner_git branch -q -D docs
}

# Lesson 3 builds one commit by hand, with plumbing commands.
replay_lesson_3() {
    local blob tree commit
    blob="$(printf '%s\n' "$PLUMBING_TEXT" | git -C "$REPO" hash-object -w --stdin)"
    calc_git update-index --add --cacheinfo "100644,$blob,$PLUMBING_FILE"
    tree="$(git -C "$REPO" write-tree)"
    commit="$(printf '%s\n' "$PLUMBING_MESSAGE" | git -C "$REPO" commit-tree "$tree" -p HEAD)"
    calc_git update-ref "refs/heads/$MAIN" "$commit"
    calc_git restore "$PLUMBING_FILE"
}

# Ten commits after the release, and one of them breaks add().
add_post_release_history() {
    local calc="$REPO/$CALC_FILE" readme="$REPO/$README_FILE"
    commit_change "Add power()"                append_block "$calc" "$(snippet_power)"
    commit_change "Document power() in README" append_line "$readme" "$README_POWER"
    commit_change "Add sqrt()"                 append_block "$calc" "$(snippet_sqrt)"
    commit_change "Add percent()"              append_block "$calc" "$(snippet_percent)"
    commit_change "Add average()"              append_block "$calc" "$(snippet_average)"
    commit_change "$BUGGY_COMMIT_SUBJECT"      replace_block "$calc" "$ADD_SIGNATURE" "$(snippet_add_refactored)"
    commit_change "Document add() in README"   append_line "$readme" "$README_ADD"
    commit_change "Add clamp()"                append_block "$calc" "$(snippet_clamp)"
    commit_change "Add x"                      append_block "$calc" "$CONSTANT_X"
    commit_change "Add y"                      append_block "$calc" "$CONSTANT_Y"
}

# A server with a big binary that was replaced once, for partial clone.
build_big_server() {
    local work page
    work="$(mktemp -d)"
    git init -q --initial-branch="$MAIN" "$work"
    mkdir -p "$work/docs" "$(dirname "$work/$BIG_ASSET")"
    printf '%s\n' "$BIG_README" > "$work/README.md"
    for page in "${BIG_DOC_PAGES[@]}"; do
        printf '# %s\n' "$page" > "$work/docs/$page.md"
    done
    random_file "$work/$BIG_ASSET" "$BIG_ASSET_BYTES"
    git -C "$work" add . >>"$LOG_FILE" 2>&1
    git -C "$work" commit -q -m "Add the docs and the first video" >>"$LOG_FILE" 2>&1
    random_file "$work/$BIG_ASSET" "$BIG_ASSET_BYTES"
    git -C "$work" commit -q -am "Replace the video" >>"$LOG_FILE" 2>&1
    git clone -q --bare --no-local "$work" "$BIG_SERVER" >>"$LOG_FILE" 2>&1
    git -C "$BIG_SERVER" config uploadpack.allowFilter true
    rm -rf "$work"
}

prepare_lesson_4() {
    replay_lesson_3
    calc_git tag -a "$RELEASE_TAG" -m "$RELEASE_MESSAGE"
    add_post_release_history
    calc_git push -q origin "$MAIN" "$RELEASE_TAG"
    build_big_server
}

# Lesson 4 ends with the bug found and reverted; lesson 5 starts from its hooks.
prepare_lesson_5() {
    local bad hook
    bad="$(git -C "$REPO" log --format=%H --fixed-strings --grep="$BUGGY_COMMIT_SUBJECT" -n 1)"
    [[ -n $bad ]] || die "no commit named '$BUGGY_COMMIT_SUBJECT'"
    calc_git revert --no-edit "$bad"
    calc_git push -q origin "$MAIN"
    mkdir -p "$REPO/$HOOKS_DEMO_DIR"
    for hook in "${HOOKS[@]}"; do
        install -m 0644 "$HOOKS_DIR/$hook" "$REPO/$HOOKS_DEMO_DIR/$hook"
    done
    random_file "$REPO/$HOOK_DEMO_FILE" "$HOOK_DEMO_FILE_BYTES"
}

# -------------------------------------------------------------------- main --

usage() {
    cat <<EOF
Usage: $(basename "$0") <lesson>

Prepares $DEMO_DIR in the state lesson <lesson> ($FIRST_LESSON-$LAST_LESSON) of the git course starts from:
  1  an empty demo directory, with server.git as a local server
  2  calc as lesson 1 left it, with server.git and $(basename "$PARTNER_REPO") as the teammate
  3  calc after lesson 2: amend, a resolved conflict, rebase, fixup and cherry-pick
  4  tag $RELEASE_TAG with $COMMITS_AFTER_RELEASE commits after it, one breaking add() for bisect; big.git
  5  the add() bug reverted, the hooks in $HOOKS_DEMO_DIR (not executable yet), and $HOOK_DEMO_FILE
An existing $DEMO_DIR is moved aside, never deleted.
EOF
}

print_summary() {
    local lesson=$1
    log "Ready for lesson $lesson in $DEMO_DIR:"
    ls -1 "$DEMO_DIR"
    log "Next: ${NEXT_STEP[lesson]}"
}

main() {
    local lesson=${1:-} step
    case $lesson in
        -h | --help) usage; exit 0 ;;
        '') usage >&2; exit 1 ;;
    esac
    if ! [[ $lesson =~ ^[0-9]+$ ]] || ((lesson < FIRST_LESSON || lesson > LAST_LESSON)); then
        die "the lesson must be a number from $FIRST_LESSON to $LAST_LESSON"
    fi
    setup_workspace
    for ((step = FIRST_LESSON + 1; step <= lesson; step++)); do
        "${PREPARE[step]}"
    done
    print_summary "$lesson"
}

main "$@"
