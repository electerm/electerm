# ---------------------------------------------------------------------------------------------
#   Electerm Shell Integration for Bash
#   Copyright (c) Electerm contributors. Licensed under MIT.
# ---------------------------------------------------------------------------------------------
#
# This script provides shell integration that enables Electerm to track:
# - Current command being executed
# - Command exit codes
# - Working directory changes
#
# It works by emitting OSC 633 escape sequences at key moments.

# Only run in interactive shells and if not already loaded
[[ $- != *i* ]] && return
[[ -n "${ELECTERM_SHELL_INTEGRATION:-}" ]] && return

export ELECTERM_SHELL_INTEGRATION=1

# Escape special characters for safe transmission
__electerm_escape_value() {
    local value="$1"
    # Escape backslashes and semicolons
    value="${value//\\/\\\\}"
    value="${value//;/\\x3b}"
    printf '%s' "$value"
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

# Track if we're in command execution
__electerm_in_command=0
__electerm_current_command=""

# Called before each command is executed (via DEBUG trap)
__electerm_preexec() {
    # Skip if we're in the prompt command itself
    [[ "$BASH_COMMAND" == "$PROMPT_COMMAND" ]] && return
    [[ "$BASH_COMMAND" == "__electerm_"* ]] && return
    
    # Only process if we haven't started execution yet
    if [[ "$__electerm_in_command" == "0" ]]; then
        __electerm_in_command=1
        __electerm_current_command="$BASH_COMMAND"
        __electerm_send_command "$BASH_COMMAND"
        __electerm_command_executed
    fi
}

# Called before each prompt is displayed
__electerm_precmd() {
    local last_exit_code="$?"
    
    # If we were in a command, send the completion
    if [[ "$__electerm_in_command" == "1" ]]; then
        __electerm_command_finished "$last_exit_code"
        __electerm_in_command=0
        __electerm_current_command=""
    fi
    
    # Send current working directory
    __electerm_send_cwd
    
    # Start prompt sequence
    __electerm_prompt_start
    
    return "$last_exit_code"
}

# Wrap PS1 to include command start marker
__electerm_update_ps1() {
    # Add command start marker after the prompt
    if [[ "$PS1" != *'$(__electerm_command_start)'* ]]; then
        PS1="${PS1}"'\[$(__electerm_command_start)\]'
    fi
}

# Install the hooks
__electerm_install() {
    # Save and wrap PROMPT_COMMAND
    if [[ -z "${__electerm_original_prompt_command:-}" ]]; then
        __electerm_original_prompt_command="${PROMPT_COMMAND:-}"
    fi
    
    if [[ -n "$__electerm_original_prompt_command" ]]; then
        PROMPT_COMMAND="__electerm_precmd; $__electerm_original_prompt_command; __electerm_update_ps1"
    else
        PROMPT_COMMAND="__electerm_precmd; __electerm_update_ps1"
    fi
    
    # Install preexec via DEBUG trap
    trap '__electerm_preexec' DEBUG
}

# Run installation
__electerm_install
