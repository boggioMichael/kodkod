#!/usr/bin/env bash
# Runs every stage in a temporary directory and checks what each lesson relies
# on, including the bisect of lesson 4 and the hooks of lesson 5.
# Never touches the real demo directory. Run it after changing the demos.
set -Euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly STAGE="$SCRIPT_DIR/stage.sh"

WORK="$(mktemp -d)"
readonly WORK
trap 'rm -rf "$WORK"' EXIT
export KODKOD_DEMO_DIR="$WORK/demo"
# shellcheck source=config.sh
source "$SCRIPT_DIR/config.sh"

# The commits of the lesson 5 hooks demo, and whether each one should pass.
readonly BAD_SUBJECT="added stuff"
readonly GOOD_SUBJECT="feat(calc): add w constant"
readonly BIG_FILE_SUBJECT="chore: add big file"
readonly NO_VERIFY_SUBJECT="bad message"
readonly HOOK_DEMO_CHANGE="w = 3"
readonly LAZY_CLONE_MAX_RATIO=10      # a lazy clone is at least 10 times smaller
readonly CHERRY_PICK_TRAILER="cherry picked from commit"   # what cherry-pick -x writes

failures=0
pass() { printf 'ok    %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }

check() {                 # description command...
    local description=$1
    shift
    if "$@" >/dev/null 2>&1; then pass "$description"; else fail "$description"; fi
}

in_repo()     { git -C "$REPO" "$@"; }
add_works()   { (cd "$REPO" && python3 -B -c "$ADD_TEST"); }
has_line()    { grep -qxF -- "$2" "$1"; }
same_commit() { [[ "$(git -C "$1" rev-parse "$2")" == "$(git -C "$3" rev-parse "$4")" ]]; }
size_kb()     { du -sk "$1" | cut -f1; }

only_main_left() { [[ "$(in_repo branch --format='%(refname:short)')" == "$MAIN" ]]; }
is_bare()        { [[ "$(git -C "$1" rev-parse --is-bare-repository)" == true ]]; }
cherry_picked()  { [[ -n "$(in_repo log --fixed-strings --grep="$CHERRY_PICK_TRAILER" --format=%H -n 1 "$MAIN")" ]]; }
commits_after_release() { [[ "$(in_repo rev-list --count "$RELEASE_TAG..$MAIN")" == "$COMMITS_AFTER_RELEASE" ]]; }

# Lesson 4: the doc's test.sh, run by git bisect, names the buggy commit.
bisect_finds_the_bug() {
    local found
    printf '%s\n' '#!/bin/sh' "python3 -B -c \"$ADD_TEST\"" > "$REPO/test.sh"
    chmod +x "$REPO/test.sh"
    in_repo bisect start HEAD "$RELEASE_TAG" &&
        in_repo bisect run ./test.sh &&
        found="$(in_repo log -1 --format=%s refs/bisect/bad)"
    in_repo bisect reset
    rm -f "$REPO/test.sh"
    [[ ${found:-} == "$BUGGY_COMMIT_SUBJECT" ]]
}

# Lesson 4: a lazy clone skips the big blobs until sparse-checkout is disabled.
partial_clone_works() {
    local url="file://$BIG_SERVER" clones="$WORK/clones"
    mkdir -p "$clones"
    git clone -q "$url" "$clones/full" || return 1
    git clone -q --filter=blob:none --sparse "$url" "$clones/lazy" || return 1
    (($(size_kb "$clones/lazy/.git") * LAZY_CLONE_MAX_RATIO < $(size_kb "$clones/full/.git"))) || return 1
    [[ ! -e $clones/lazy/$BIG_ASSET ]] || return 1
    git -C "$clones/lazy" sparse-checkout disable || return 1
    [[ -s $clones/lazy/$BIG_ASSET ]]
}

# Lesson 5: the hooks reject what the lesson rejects, and --no-verify skips them.
hooks_work_like_the_lesson() {
    (
        cd "$REPO" || exit 1
        chmod +x "$HOOKS_DEMO_DIR"/*
        git config core.hooksPath "$HOOKS_DEMO_DIR"
        printf '%s\n' "$HOOK_DEMO_CHANGE" >> "$CALC_FILE"
        ! git commit -q -am "$BAD_SUBJECT" || exit 1
        git commit -q -am "$GOOD_SUBJECT" || exit 1
        git add "$HOOK_DEMO_FILE"
        ! git commit -q -m "$BIG_FILE_SUBJECT" || exit 1
        git commit -q -m "$NO_VERIFY_SUBJECT" --no-verify
    )
}

check_lesson_1() {
    check "1: server.git is a bare repository" is_bare "$SERVER"
}

check_lesson_2() {
    check "2: div() checks division by zero" has_line "$REPO/$CALC_FILE" "$DIV_GUARD_LINE"
    check "2: the teammate's README line was merged" has_line "$REPO/$README_FILE" "$README_MAINTAINERS"
    check "2: .env is ignored" in_repo check-ignore -q "$ENV_FILE"
    check "2: main is pushed" same_commit "$REPO" "$MAIN" "$SERVER" "$MAIN"
    check "2: the teammate is up to date" same_commit "$PARTNER_REPO" "$MAIN" "$SERVER" "$MAIN"
    check "2: add() works" add_works
}

check_lesson_3() {
    check "3: the conflict was resolved with both sides" has_line "$REPO/$CALC_FILE" "$ADD_RESOLVED_RETURN"
    check "3: the fixup was squashed into mod()" has_line "$REPO/$CALC_FILE" "$MOD_FIXED_RETURN"
    check "3: the rebase kept both README lines" has_line "$REPO/$README_FILE" "$README_USAGE"
    check "3: the teammate's commit on docs survived" has_line "$REPO/$README_FILE" "$README_WELCOME"
    check "3: cherry-pick -x left its trailer" cherry_picked
    check "3: only main is left" only_main_left
    check "3: add() works" add_works
}

check_lesson_4() {
    check "4: $COMMITS_AFTER_RELEASE commits after $RELEASE_TAG" commits_after_release
    check "4: bisect finds '$BUGGY_COMMIT_SUBJECT'" bisect_finds_the_bug
    check "4: partial clone and sparse-checkout behave" partial_clone_works
}

check_lesson_5() {
    check "5: add() works again" add_works
    check "5: the hooks are not executable yet" test ! -x "$REPO/$HOOKS_DEMO_DIR/${HOOKS[0]}"
    check "5: $HOOK_DEMO_FILE is $HOOK_DEMO_FILE_BYTES bytes" test "$(stat -c %s "$REPO/$HOOK_DEMO_FILE")" -eq "$HOOK_DEMO_FILE_BYTES"
    check "5: the hooks reject and accept like the lesson" hooks_work_like_the_lesson
}

for ((lesson = FIRST_LESSON; lesson <= LAST_LESSON; lesson++)); do
    if "$STAGE" "$lesson" >/dev/null 2>&1; then
        pass "stage $lesson"
        "check_lesson_$lesson"
    else
        fail "stage $lesson"
    fi
done

if ((failures)); then
    printf '%s check(s) failed\n' "$failures"
    exit 1
fi
printf 'all checks passed\n'
