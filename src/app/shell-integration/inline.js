/**
 * Inline Shell Integration Commands
 *
 * These are minimal shell integration commands that can be sent directly
 * to a remote shell without needing to install files on the server.
 * They enable OSC 633 command tracking in SSH sessions.
 */

/* eslint-disable no-template-curly-in-string, no-useless-escape */

/**
 * Get inline shell integration command for bash
 * This is a minified version that can be safely sent to a remote shell
 */
function getBashInlineIntegration () {
  return [
    '# Electerm shell integration (inline)',
    'if [[ $- == *i* ]] && [[ -z "${ELECTERM_SHELL_INTEGRATION:-}" ]]; then',
    '  export ELECTERM_SHELL_INTEGRATION=1',
    '  __e_esc() { local v="$1"; v="${v//\\\\/\\\\\\\\}"; v="${v//;/\\\\x3b}"; printf \'%s\' "$v"; }',
    '  __e_pre() { [[ "$BASH_COMMAND" == "$PROMPT_COMMAND" ]] && return; [[ "$BASH_COMMAND" == "__e_"* ]] && return; [[ "${__e_in:-0}" == "0" ]] && { __e_in=1; printf \'\\\\e]633;E;%s\\\\a\\\\e]633;C\\\\a\' "$(__e_esc "$BASH_COMMAND")"; }; }',
    '  __e_cmd() { local c="$?"; [[ "${__e_in:-0}" == "1" ]] && { printf \'\\\\e]633;D;%s\\\\a\' "$c"; __e_in=0; }; printf \'\\\\e]633;P;Cwd=%s\\\\a\\\\e]633;A\\\\a\' "$(__e_esc "$PWD")"; return "$c"; }',
    '  trap \'__e_pre\' DEBUG',
    '  PROMPT_COMMAND="__e_cmd${PROMPT_COMMAND:+; $PROMPT_COMMAND}"',
    'fi'
  ].join('\n')
}

/**
 * Get inline shell integration command for zsh
 */
function getZshInlineIntegration () {
  return `
# Electerm shell integration (inline)
if [[ -o interactive ]] && [[ -z "\${ELECTERM_SHELL_INTEGRATION:-}" ]]; then
  export ELECTERM_SHELL_INTEGRATION=1
  __e_esc() { local v="$1"; v="\${v//\\\\/\\\\\\\\}"; v="\${v//;/\\\\x3b}"; builtin printf '%s' "$v"; }
  __e_preexec() { __e_cmd="$1"; builtin printf '\\e]633;E;%s\\a\\e]633;C\\a' "$(__e_esc "$1")"; }
  __e_precmd() { local c="$?"; [[ -n "\$__e_cmd" ]] && builtin printf '\\e]633;D;%s\\a' "$c"; __e_cmd=""; builtin printf '\\e]633;P;Cwd=%s\\a\\e]633;A\\a' "$(__e_esc "$PWD")"; }
  autoload -Uz add-zsh-hook
  add-zsh-hook precmd __e_precmd
  add-zsh-hook preexec __e_preexec
fi
`
}

/**
 * Get inline shell integration command for fish
 */
function getFishInlineIntegration () {
  return `
# Electerm shell integration (inline)
if status is-interactive; and not set -q ELECTERM_SHELL_INTEGRATION
  set -g ELECTERM_SHELL_INTEGRATION 1
  function __e_esc; echo $argv | string replace -a '\\\\' '\\\\\\\\' | string replace -a ';' '\\\\x3b'; end
  function __e_prompt --on-event fish_prompt; printf '\\e]633;A\\a\\e]633;P;Cwd=%s\\a' (__e_esc "$PWD"); end
  function __e_preexec --on-event fish_preexec; printf '\\e]633;E;%s\\a\\e]633;C\\a' (__e_esc "$argv"); end
  function __e_postexec --on-event fish_postexec; printf '\\e]633;D;%s\\a' $status; end
end
`
}

/**
 * Get shell integration command based on detected shell
 * @param {string} shellType - 'bash', 'zsh', or 'fish'
 * @returns {string} Shell integration command to send
 */
function getInlineShellIntegration (shellType) {
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
 * Wrap shell integration in a silent execution
 * This prevents the integration code from appearing in the terminal
 * @param {string} cmd - Shell integration command
 * @param {string} shellType - Shell type
 * @returns {string} Wrapped command
 */
function wrapSilent (cmd, shellType) {
  // Remove newlines and compress for sending
  const compressed = cmd
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .join('; ')

  if (shellType === 'fish') {
    return `eval '${compressed.replace(/'/g, "\\'")}'\n`
  }
  // For bash/zsh, wrap in eval and suppress output
  return `eval '${compressed.replace(/'/g, "\\'")}' 2>/dev/null\n`
}

module.exports = {
  getBashInlineIntegration,
  getZshInlineIntegration,
  getFishInlineIntegration,
  getInlineShellIntegration,
  wrapSilent
}
