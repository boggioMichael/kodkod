# Shared by stage.sh and selftest.sh: settings, names, and the calc project as
# it grows through the lessons. Change the demo here, not in the scripts.
# shellcheck shell=bash

# ---------------------------------------------------------------- settings --

DEMO_DIR="${KODKOD_DEMO_DIR:-$HOME/demo}"
PARTNER_NAME="${KODKOD_PARTNER_NAME:-Moshe}"
PARTNER_EMAIL="${KODKOD_PARTNER_EMAIL:-moshe@example.com}"

FIRST_LESSON=1
LAST_LESSON=5
MAIN="main"

REPO="$DEMO_DIR/calc"
PARTNER_REPO="$DEMO_DIR/calc-${PARTNER_NAME,,}"
SERVER="$DEMO_DIR/server.git"
BIG_SERVER="$DEMO_DIR/big.git"
LOG_FILE="$DEMO_DIR/stage.log"

# ------------------------------------------------------- lessons 4 and 5 --

RELEASE_TAG="v1.0"
RELEASE_MESSAGE="First release"
COMMITS_AFTER_RELEASE=10
BUGGY_COMMIT_SUBJECT="Refactor add()"
ADD_TEST='import calc; assert calc.add(2, 3) == 5'   # the bisect test of lesson 4

BIG_ASSET="assets/video.bin"
BIG_ASSET_BYTES=$((3 * 1024 * 1024))                 # replaced once: about 6MB of history
BIG_README="# big project"
BIG_DOC_PAGES=(intro setup usage)

HOOKS=(commit-msg pre-commit)
HOOKS_DEMO_DIR=".githooks"
HOOK_DEMO_FILE="big.bin"
HOOK_DEMO_FILE_BYTES=2000000                         # above the 1MB pre-commit limit

# ------------------------------------------------------- the calc project --

CALC_FILE="calc.py"
README_FILE="README.md"
ENV_FILE=".env"
ENV_SECRET_LINE="PASSWORD=not-a-real-secret"
TODO_FILE="TODO.txt"
TODO_LINE="- Add power()"
MODULE_DOCSTRING='"""A small calculator."""'

PLUMBING_FILE="hello.txt"
PLUMBING_TEXT="hello from plumbing"
PLUMBING_MESSAGE="Add hello.txt by hand"

ADD_SIGNATURE="def add(a, b):"
ADD_RETURN="    return a + b"
ADD_FLOAT_RETURN="    return float(a) + float(b)"
ADD_ROUND_RETURN="    return round(a + b, 2)"
ADD_RESOLVED_RETURN="    return round(float(a) + float(b), 2)"
DIV_RETURN="    return a / b"
DIV_GUARD_LINE='        raise ValueError("division by zero")'
MOD_BUGGY_RETURN="    return a // b"
MOD_FIXED_RETURN="    return a % b"
CONSTANT_X="x = 10"
CONSTANT_Y="y = 20"

README_TITLE="# calc"
README_ABOUT="A small calculator in Python."
README_MAINTAINERS="Maintained by the calc team."
README_USAGE="Usage: python calc.py"
README_LICENSE="License: MIT"
README_WELCOME="Contributions welcome."
README_MOD="mod(a, b) returns the remainder"
README_POWER="power(a, b) raises a to the power of b"
README_ADD="add(*values) adds any number of values"

readme_intro()        { printf '%s\n' "$README_TITLE" "" "$README_ABOUT"; }

snippet_add()         { printf '%s\n' "$ADD_SIGNATURE" "$ADD_RETURN"; }
snippet_sub()         { printf '%s\n' 'def sub(a, b):' '    return a - b'; }
snippet_mul()         { printf '%s\n' 'def mul(a, b):' '    return a * b'; }
snippet_div()         { printf '%s\n' 'def div(a, b):' "$DIV_RETURN"; }
snippet_div_guarded() { printf '%s\n' '    if b == 0:' "$DIV_GUARD_LINE" "$DIV_RETURN"; }
snippet_example()     { printf '%s\n' 'def example():' '    print("sub(5, 3) =", sub(5, 3))'; }
snippet_mod_buggy()   { printf '%s\n' 'def mod(a, b):' "$MOD_BUGGY_RETURN"; }
snippet_power()       { printf '%s\n' 'def power(a, b):' '    return a ** b'; }
snippet_sqrt()        { printf '%s\n' 'def sqrt(a):' '    if a < 0:' '        raise ValueError("negative input")' '    return a ** 0.5'; }
snippet_percent()     { printf '%s\n' 'def percent(a, b):' '    return a * b / 100'; }
snippet_average()     { printf '%s\n' 'def average(*values):' '    return sum(values) / len(values)'; }
snippet_clamp()       { printf '%s\n' 'def clamp(value, low, high):' '    return max(low, min(value, high))'; }

# The bug bisect finds in lesson 4: the sum starts from 1 instead of 0.
snippet_add_refactored() {
    printf '%s\n' 'def add(*values):' \
        '    from functools import reduce' \
        '    return round(reduce(lambda total, value: total + float(value), values, 1), 2)'
}
