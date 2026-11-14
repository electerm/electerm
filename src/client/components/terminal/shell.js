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

// The PowerShell integration script is shared with the server, which hands it
// to the pty as a spawn argument instead of typing it (server-local PowerShell
// is the one shell where the typed form can not be hidden, #4737). It is still
// typed here for `pwsh` running as a *local* shell on macOS/Linux, where the
// pty is not spawnable by us.
import { getPowerShellIntegrationScript } from '../../common/powershell-integration.js'

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
    '__e_pre() { local p; [[ "$BASH_COMMAND" == __e_* || "$BASH_COMMAND" == PROMPT_COMMAND=* ]] && return; [[ "$BASH_COMMAND" == "$PROMPT_COMMAND" ]] && return; if [[ -n "${PROMPT_COMMAND:-}" ]]; then local IFS=\';\'; for p in $PROMPT_COMMAND; do p="${p#"${p%%[! ]*}"}"; [[ "$BASH_COMMAND" == "$p" ]] && return; done; fi; [[ "${__e_in:-0}" == "0" ]] && { __e_in=1; printf \'\\e]633;E;%s\\a\\e]633;C\\a\' "$(__e_esc "$BASH_COMMAND")"; }; }',
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
  // Register hooks by appending to the precmd/preexec hook arrays directly.
  // add-zsh-hook is an autoloadable shell function: on systems like NixOS
  // fpath may not include the standard functions directory, the autoload
  // fails silently (stderr is suppressed) and the hooks never run, breaking
  // path following. Appending to the arrays works on every zsh.
  return [
    'if [[ -o interactive ]] && [[ -z "${ELECTERM_SHELL_INTEGRATION:-}" ]]',
    'then export ELECTERM_SHELL_INTEGRATION=1',
    '__e_esc() { local v="$1"; v="${v//\\\\/\\\\\\\\}"; v="${v//;/\\\\x3b}"; builtin printf \'%s\' "$v"; }',
    '__e_preexec() { __e_cmd="$1"; builtin printf \'\\e]633;E;%s\\a\\e]633;C\\a\' "$(__e_esc "$1")"; }',
    '__e_precmd() { local c="$?"; [[ -n "$__e_cmd" ]] && builtin printf \'\\e]633;D;%s\\a\' "$c"; __e_cmd=""; builtin printf \'\\e]633;P;Cwd=%s\\a\\e]633;A\\a\' "$(__e_esc "$PWD")"; }',
    'precmd_functions+=(__e_precmd)',
    'preexec_functions+=(__e_preexec)',
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
    // sh/dash/ash re-evaluate $(...) inside PS1 every time the prompt is
    // shown, but only if the $() stays literal — so PS1 must be assigned
    // single-quoted. printf interprets \033/\a, unlike PS1 backslash
    // escapes which dash does not expand.
    //
    // The prompt is deliberately self-contained: it must never call a shell
    // function. On OpenWrt /etc/profile does `export PS1=...`, so PS1 is an
    // environment variable and every child shell inherits it — while shell
    // functions are not inherited. A `PS1='$(__e_ps1)'...` prompt therefore
    // dies with "ash: __e_ps1: not found" on every prompt of any nested shell
    // (ash, su, login, ...), and the exported ELECTERM_SHELL_INTEGRATION
    // guard stops the child from ever defining the missing function.
    // Inlining keeps it working there too, and printf is an ash builtin so
    // this is cheaper than the old function + sed pair.
    'PS1=\'$(printf "\\033]633;P;Cwd=%s\\a\\033]633;A\\a" "$PWD")\'"${PS1:-# }"',
    'fi'
  ].join('; ')
}

export function detectShellType (shellStr) {
  const shell = String(shellStr || '').trim().replace(/^"|"$/g, '')
  // PowerShell first: `pwsh` also contains no other shell name, but a path
  // such as `C:\Program Files\PowerShell\7\pwsh.exe` must not fall through to
  // the POSIX `sh` default.
  if (/(?:^|[/\\])(?:powershell|pwsh)(?:\.exe)?$/i.test(shell)) {
    return 'powershell'
  }
  if (/(?:^|[/\\])cmd(?:\.exe)?$/i.test(shell)) {
    return 'cmd'
  }
  if (shell.includes('bash')) {
    return 'bash'
  } else if (shell.includes('zsh')) {
    return 'zsh'
  } else if (shell.includes('fish')) {
    return 'fish'
  } else {
    return 'sh'
  }
}

/**
 * Turn the output of the remote `$SHELL` probe into a shell type.
 *
 * Only an absolute path counts as an answer. A network device or a restricted
 * account answers the probe with a CLI error banner (Huawei VRP: "Error:
 * Unrecognized command..."), and reading that as "some sh-compatible shell"
 * is what typed the integration script into a switch - the device echoed it,
 * the screen froze for the suppression window and the text stayed in the
 * scrollback (issue #4610). '' means "could not tell", and the caller must
 * not inject anything.
 *
 * @param {string} output - raw stdout of `printf "%s\n" "$SHELL"`
 * @returns {string} 'bash' | 'zsh' | 'fish' | 'sh' | ''
 */
export function parseRemoteShell (output) {
  const shell = String(output || '').trim().toLowerCase()
  if (!shell.startsWith('/')) {
    return ''
  }
  return detectShellType(shell)
}

/**
 * Get shell integration command based on detected shell type
 * @param {string} shellType - 'bash', 'zsh', 'fish', 'sh' or 'powershell'
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
    case 'powershell':
      return getPowerShellIntegrationScript()
    default:
      // Try bash as default for sh-compatible shells
      return getShInlineIntegration()
  }
}

/**
 * Shell types this module can produce an integration script for.
 * `cmd` is not one of them: its prompt cannot report a path as an escape
 * sequence, and typing the POSIX script there would only print an error.
 */
export const shellIntegrationTypes = new Set([
  'bash',
  'zsh',
  'fish',
  'sh',
  'powershell'
])

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
  if (shellType === 'fish') {
    // fish is not a Bourne shell: the eval '\''...'\'' wrapper of wrapSilent
    // is a parse error in fish (nested single quotes stay unbalanced), so
    // the whole injection silently fails. Send the script raw instead —
    // it is already valid fish syntax as-is.
    return ' ' + getInlineShellIntegration(shellType) + '\r'
  }
  if (shellType === 'powershell') {
    // Same reason: `eval '...'` is not PowerShell either. The leading space
    // keeps the line out of the PSReadLine history.
    return ' ' + getInlineShellIntegration(shellType) + '\r'
  }
  const cmd = getInlineShellIntegration(shellType)
  return wrapSilent(cmd, shellType)
}
