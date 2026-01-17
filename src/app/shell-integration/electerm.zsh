# ---------------------------------------------------------------------------------------------
#   Electerm Shell Integration for Zsh
#   Copyright (c) Electerm contributors. Licensed under MIT.
# ---------------------------------------------------------------------------------------------
#
# This script provides shell integration that enables Electerm to track:
# - Current command being executed
# - Command exit codes
# - Working directory changes
#
# It works by emitting OSC 633 escape sequences at key moments.

# Only run if not already loaded
[[ -n "${ELECTERM_SHELL_INTEGRATION:-}" ]] && return 0

export ELECTERM_SHELL_INTEGRATION=1

# Escape special characters for safe transmission
__electerm_escape_value() {
    local value="$1"
    # Escape backslashes and semicolons
    value="${value//\\/\\\\}"
    value="${value//;/\\x3b}"
    builtin printf '%s' "$value"
}

# OSC 633 ; A - Prompt started
__electerm_prompt_start() {
    builtin printf '\e]633;A\a'
}

# OSC 633 ; B - Command input started (after prompt)
__electerm_command_start() {
    builtin printf '\e]633;B\a'
}

# OSC 633 ; C - Command execution started
__electerm_command_executed() {
    builtin printf '\e]633;C\a'
}

# OSC 633 ; D ; <ExitCode> - Command finished
__electerm_command_finished() {
    local exit_code="$1"
    builtin printf '\e]633;D;%s\a' "$exit_code"
}

# OSC 633 ; E ; <CommandLine> - Send command line
__electerm_send_command() {
    local cmd="$1"
    if [[ -n "$cmd" ]]; then
        builtin printf '\e]633;E;%s\a' "$(__electerm_escape_value "$cmd")"
    fi
}

# OSC 633 ; P ; Cwd=<path> - Send current working directory
__electerm_send_cwd() {
    builtin printf '\e]633;P;Cwd=%s\a' "$(__electerm_escape_value "$PWD")"
}

# Store the current command
__electerm_current_command=""

# Called before each command is executed
__electerm_preexec() {
    __electerm_current_command="$1"
    __electerm_send_command "$1"
    __electerm_command_executed
}

# Called before each prompt is displayed
__electerm_precmd() {
    local last_exit_code="$?"
    
    # If we had a command, send completion
    if [[ -n "$__electerm_current_command" ]]; then
        __electerm_command_finished "$last_exit_code"
        __electerm_current_command=""
    else
        # Empty command (just pressed enter)
        __electerm_command_finished
    fi
    
    # Send current working directory
    __electerm_send_cwd
    
    # Start prompt sequence
    __electerm_prompt_start
}

# Wrap prompt to add command start marker
__electerm_update_prompt() {
    # Add invisible markers around the prompt
    PS1="%{$(__electerm_prompt_start)%}${PS1}%{$(__electerm_command_start)%}"
}

# Install the hooks using zsh's hook system
__electerm_install() {
    # Add our hooks to the arrays
    autoload -Uz add-zsh-hook
    add-zsh-hook precmd __electerm_precmd
    add-zsh-hook preexec __electerm_preexec
}

# Run installation
__electerm_install
