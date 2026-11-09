#!/usr/bin/env bash
# Runs once, when the codespace is created: installs the teaching toolset and
# wires the teaching shell helpers into bash.
set -Eeuo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly SHELL_HELPERS="$REPO_ROOT/tools/teaching-shell.sh"
readonly BASHRC="$HOME/.bashrc"
readonly BASHRC_MARKER="# kodkod: teaching shell helpers"
readonly DEFAULT_BRANCH="main"

readonly -a APT_PACKAGES=(
    tig               # text-mode history browser
    git-email         # git send-email, for the kernel patch workflow
    python3           # the calc demo project
    python3-venv
    python3-pip
    build-essential   # gcc, make
    gdb
    strace
    tree
    procps            # watch, for the live graph window
)

install_packages() {
    sudo apt-get update -q
    sudo DEBIAN_FRONTEND=noninteractive \
        apt-get install -y -q --no-install-recommends "${APT_PACKAGES[@]}"
}

# Fill in only what the user has not chosen; never override existing config.
configure_git_defaults() {
    git config --global --get init.defaultBranch >/dev/null \
        || git config --global init.defaultBranch "$DEFAULT_BRANCH"
}

wire_shell_helpers() {
    if grep -qxF "$BASHRC_MARKER" "$BASHRC" 2>/dev/null; then
        return
    fi
    printf '\n%s\n[ -f "%s" ] && . "%s"\n' \
        "$BASHRC_MARKER" "$SHELL_HELPERS" "$SHELL_HELPERS" >> "$BASHRC"
}

install_packages
configure_git_defaults
wire_shell_helpers
