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
import { runCmd } from './terminal-apis.js'

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
 * Get inline shell integration command for sh/ash (one-liner format)
 * Uses PS1 injection as sh/ash lack PROMPT_COMMAND or advanced traps.
 */
function getShInlineIntegration () {
  return [
    'if [ -z "$ELECTERM_SHELL_INTEGRATION" ]',
    'then export ELECTERM_SHELL_INTEGRATION=1',
    '__e_esc() { printf "%s" "$1" | sed "s/\\\\/\\\\\\\\/g; s/;/\\\\x3b/g"; }',
    // We wrap the current PS1 with OSC 633 sequences.
    // \033]633;P;Cwd=... \007 marks the directory
    // \033]633;A \007 marks the start of the prompt
    'export PS1="\\e]633;P;Cwd=$(__e_esc "$PWD")\\a\\e]633;A\\a${PS1:-# }"',
    'fi'
  ].join('; ')
}

export function detectShellType (shellStr) {
  if (shellStr.includes('bash')) {
    return 'bash'
  } else if (shellStr.includes('zsh')) {
    return 'zsh'
  } else if (shellStr.includes('fish')) {
    return 'fish'
  } else {
    return 'sh'
  }
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
      return getShInlineIntegration()
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
export async function detectRemoteShell (pid) {
  // 1. We try the version variables first.
  // 2. We try your verified fish check: fish --version ...
  // 3. We use ps -p $$ to check the process name (highly reliable in Linux/Docker).
  // This syntax is safe for Bash, Zsh, and Fish.
  const cmd = 'fish --version 2>/dev/null | grep -q fish && echo fish || { env | grep -q ZSH_VERSION && echo zsh || { env | grep -q BASH_VERSION && echo bash || { ps -p $$ -o comm= 2>/dev/null || echo sh; }; }; }'

  const r = await runCmd(pid, cmd)
    .catch((err) => {
      console.error('detectRemoteShell error', err)
      return 'sh'
    })

  const shell = r.trim().toLowerCase()

  if (shell.includes('fish')) return 'fish'
  if (shell.includes('zsh')) return 'zsh'
  if (shell.includes('bash')) return 'bash'
  return 'sh' // Fallback for sh/ash/dash
}
