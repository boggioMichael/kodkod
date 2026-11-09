# Sourced from ~/.bashrc in the codespace: helpers for live git demos.
# shellcheck shell=bash

KODKOD_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export KODKOD_ROOT
: "${KODKOD_DEMO_DIR:=$HOME/demo}"
export KODKOD_DEMO_DIR

# The commit graph, the way it is shown in class.
alias graph='git log --oneline --graph --all --decorate'

# Redraw the graph every second (or every $1 seconds), for a terminal on the side.
watch-graph() {
    watch --color -n "${1:-1}" git log --oneline --graph --all --decorate --color=always
}

# Prepare the demo repositories for lesson N, then step into them.
demo() {
    "$KODKOD_ROOT/git/demos/stage.sh" "$@" || return
    case "${1:-}" in
        [0-9]*) ;;
        *) return ;;
    esac
    if [ -d "$KODKOD_DEMO_DIR/calc" ]; then
        cd "$KODKOD_DEMO_DIR/calc" || return
    else
        cd "$KODKOD_DEMO_DIR" || return
    fi
}
