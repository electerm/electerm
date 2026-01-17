/**
 * Client-side Shell Integration Commands
 *
 * These are minimal shell integration commands that can be sent directly
 * to a local or remote shell from the frontend after connection.
 * They enable OSC 633 command tracking without needing server-side file sourcing.
 *
 * OSC 633 Protocol:
 * - OSC 633 ; A - Prompt started
 * - OSC 633 ; B - Command input started (ready for typing)
 * - OSC 633 ; C - Command execution started
 * - OSC 633 ; D ; <exitCode> - Command finished
 * - OSC 633 ; E ; <command> - Command line being executed
 * - OSC 633 ; P ; Cwd=<path> - Current working directory
 */

/* eslint-disable no-template-curly-in-string, no-useless-escape */

/**
 * Get inline shell integration command for bash (one-liner format)
 * Properly formatted for semicolon joining
 */
function getBashInlineIntegration () {
  // Each statement is complete and can be joined with semicolons
  return [
    'if [[ $- == *i* ]] && [[ -z "${ELECTERM_SHELL_INTEGRATION:-}" ]]',
    'then export ELECTERM_SHELL_INTEGRATION=1',
    '__e_esc() { local v="$1"; v="${v//\\\\/\\\\\\\\}"; v="${v//;/\\\\x3b}"; printf \'%s\' "$v"; }',
    '__e_pre() { [[ "$BASH_COMMAND" == "$PROMPT_COMMAND" ]] && return; [[ "$BASH_COMMAND" == "__e_"* ]] && return; [[ "${__e_in:-0}" == "0" ]] && { __e_in=1; printf \'\\e]633;E;%s\\a\\e]633;C\\a\' "$(__e_esc "$BASH_COMMAND")"; }; }',
    '__e_cmd() { local c="$?"; [[ "${__e_in:-0}" == "1" ]] && { printf \'\\e]633;D;%s\\a\' "$c"; __e_in=0; }; printf \'\\e]633;P;Cwd=%s\\a\\e]633;A\\a\' "$(__e_esc "$PWD")"; return "$c"; }',
    'trap \'__e_pre\' DEBUG',
    'PROMPT_COMMAND="__e_cmd${PROMPT_COMMAND:+; $PROMPT_COMMAND}"',
    'fi'
  ].join('; ')
}

/**
 * Get inline shell integration command for zsh (one-liner format)
 * Properly formatted for semicolon joining
 */
function getZshInlineIntegration () {
  // Each statement is complete and can be joined with semicolons
  // Note: 'then' must have a space/newline before the next command, not semicolon
  return [
    'if [[ -o interactive ]] && [[ -z "${ELECTERM_SHELL_INTEGRATION:-}" ]]',
    'then export ELECTERM_SHELL_INTEGRATION=1',
    '__e_esc() { local v="$1"; v="${v//\\\\/\\\\\\\\}"; v="${v//;/\\\\x3b}"; builtin printf \'%s\' "$v"; }',
    '__e_preexec() { __e_cmd="$1"; builtin printf \'\\e]633;E;%s\\a\\e]633;C\\a\' "$(__e_esc "$1")"; }',
    '__e_precmd() { local c="$?"; [[ -n "$__e_cmd" ]] && builtin printf \'\\e]633;D;%s\\a\' "$c"; __e_cmd=""; builtin printf \'\\e]633;P;Cwd=%s\\a\\e]633;A\\a\' "$(__e_esc "$PWD")"; }',
    'autoload -Uz add-zsh-hook',
    'add-zsh-hook precmd __e_precmd',
    'add-zsh-hook preexec __e_preexec',
    'fi'
  ].join('; ')
}

/**
 * Get inline shell integration command for fish (one-liner format)
 */
function getFishInlineIntegration () {
  return [
    'if status is-interactive; and not set -q ELECTERM_SHELL_INTEGRATION',
    'set -g ELECTERM_SHELL_INTEGRATION 1',
    'function __e_esc; echo $argv | string replace -a \'\\\\\' \'\\\\\\\\\' | string replace -a \';\' \'\\\\x3b\'; end',
    'function __e_prompt --on-event fish_prompt; printf \'\\e]633;A\\a\\e]633;P;Cwd=%s\\a\' (__e_esc "$PWD"); end',
    'function __e_preexec --on-event fish_preexec; printf \'\\e]633;E;%s\\a\\e]633;C\\a\' (__e_esc "$argv"); end',
    'function __e_postexec --on-event fish_postexec; printf \'\\e]633;D;%s\\a\' $status; end',
    'end'
  ].join('; ')
}

/**
 * Get shell integration command based on detected shell type
 * @param {string} shellType - 'bash', 'zsh', or 'fish'
 * @returns {string} Shell integration command to send
 */
export function getInlineShellIntegration (shellType) {
  switch (shellType) {
    case 'bash':
      return getBashInlineIntegration()
    case 'zsh':
      return getZshInlineIntegration()
    case 'fish':
      return getFishInlineIntegration()
    default:
      // Try bash as default for sh-compatible shells
      return getBashInlineIntegration()
  }
}

/**
 * Wrap shell integration command for execution
 * Now simplified since output suppression is handled at the attach addon level
 * @param {string} cmd - Shell integration command
 * @param {string} shellType - Shell type (unused, kept for API compatibility)
 * @returns {string} Command ready to send to terminal
 */
export function wrapSilent (cmd, shellType) {
  // Escape single quotes for embedding in single-quoted string
  const escaped = cmd.replace(/'/g, "'\\''")
  // The leading space prevents the command from being saved to history
  // The eval wrapper ensures proper execution
  return ` eval '${escaped}' 2>/dev/null\r`
}

/**
 * Get complete shell integration command ready to send
 * @param {string} shellType - 'bash', 'zsh', or 'fish'
 * @returns {string} Complete command to send to terminal
 */
export function getShellIntegrationCommand (shellType = 'bash') {
  const cmd = getInlineShellIntegration(shellType)
  return wrapSilent(cmd, shellType)
}

/**
 * Detect shell type from shell path or login script
 * @param {string} shellPath - Path to shell executable or login script
 * @returns {string} Shell type: 'bash', 'zsh', 'fish', or 'bash' (default)
 */
export function detectShellType (shellPath = '') {
  if (!shellPath) return 'bash'

  const normalizedPath = shellPath.toLowerCase()

  if (normalizedPath.includes('zsh')) {
    return 'zsh'
  } else if (normalizedPath.includes('fish')) {
    return 'fish'
  } else if (normalizedPath.includes('bash')) {
    return 'bash'
  } else if (normalizedPath.includes('sh')) {
    // Generic sh, try bash compatibility
    return 'bash'
  }

  return 'bash'
}
