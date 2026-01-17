# ---------------------------------------------------------------------------------------------
#   Electerm Shell Integration for Fish
#   Copyright (c) Electerm contributors. Licensed under MIT.
# ---------------------------------------------------------------------------------------------
#
# This script provides shell integration that enables Electerm to track:
# - Current command being executed
# - Command exit codes
# - Working directory changes
#
# It works by emitting OSC 633 escape sequences at key moments.

# Only run in interactive mode and if not already loaded
status is-interactive
or exit

set -q ELECTERM_SHELL_INTEGRATION
and exit

set -g ELECTERM_SHELL_INTEGRATION 1

# Helper function to emit OSC 633 sequences
function __electerm_esc -d "Emit OSC 633 escape sequences"
    builtin printf "\e]633;%s\a" (string join ";" -- $argv)
end

# Escape special characters for safe transmission
function __electerm_escape_value
    # Escape backslashes and semicolons
    echo $argv \
    | string replace --all '\\' '\\\\' \
    | string replace --all ';' '\\x3b' \
    ;
end

# Sent when prompt is about to be displayed
function __electerm_prompt_start --on-event fish_prompt
    __electerm_esc A
    # Send current working directory
    __electerm_esc P Cwd=(__electerm_escape_value "$PWD")
end

# Sent right before executing an interactive command
function __electerm_preexec --on-event fish_preexec
    # Send the command line
    __electerm_esc E (__electerm_escape_value "$argv") 
    # Mark command execution starting
    __electerm_esc C
end

# Sent right after an interactive command has finished executing
function __electerm_postexec --on-event fish_postexec
    # Send exit code
    __electerm_esc D $status
end

# Sent when a command line is cleared or reset, but no command was run
function __electerm_cancel --on-event fish_cancel
    # Clear command with no exit code
    __electerm_esc E ""
    __electerm_esc C
    __electerm_esc D
end

# Preserve and wrap the existing fish_prompt if it exists
if functions -q fish_prompt
    functions -c fish_prompt __electerm_original_fish_prompt
    
    function fish_prompt
        __electerm_original_fish_prompt
        # Mark command input starting (after prompt)
        __electerm_esc B
    end
else
    # Default prompt with our marker
    function fish_prompt
        echo -n (whoami)@(prompt_hostname) (prompt_pwd) '> '
        __electerm_esc B
    end
end
