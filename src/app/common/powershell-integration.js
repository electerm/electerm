/**
 * PowerShell shell integration, applied when the local pty is spawned (#4737).
 *
 * This used to be typed into the shell right after connect. On Windows that is
 * a bad deal: PSReadLine re-renders the whole line after every keystroke it
 * reads, so a few hundred characters of script produce kilobytes of echo, and
 * the shell is often not listening yet (conpty startup plus profile load take
 * seconds) - the console buffers the keystrokes and the line editor draws them
 * whenever it finally starts, long after any output-suppression window is gone.
 * The result was the script sitting on screen in every new tab.
 *
 * Handing the script over as `-NoExit -Command <script>` removes the problem at
 * the root: nothing is typed, so there is nothing to echo, and there is no
 * window in which the shell can be "not ready yet".
 *
 * The renderer has to know whether this happened - typing the same script on
 * top of an injected one is exactly the failure above - so the predicate and
 * the script live here and are mirrored, verbatim, in
 * src/client/common/powershell-integration.js. A unit test keeps the two from
 * drifting, the same way dangerous-session-fields.js is kept in sync.
 */

/**
 * Switches that decide what the shell runs. `-Command` appended next to one of
 * them is either ignored or breaks the command the user asked for, so injection
 * is skipped instead of guessed at.
 */
const executionSwitches = ['command', 'encodedcommand', 'file', 'noninteractive']

/**
 * The OSC 633 wrapper we install on `prompt`.
 *
 * - `$?` is left alone: the user's own prompt is called first, because
 *   oh-my-posh and friends read `$?` as their first statement and any call
 *   before them (`[Console]::Write` sets `$?` to true) would erase the "last
 *   command failed" indicator.
 * - `[char]27` instead of `` `e ``: PowerShell 5.1, the Windows default, has no
 *   `` `e `` escape.
 * - backslashes are doubled and `;` becomes `\x3b`, the same escaping the POSIX
 *   scripts use, so a path survives the OSC payload intact.
 * - a non-filesystem location (Registry:, Cert:) reports nothing rather than a
 *   provider path that is not a real directory.
 * - the whole emission is in try/catch: an error inside `prompt` would print on
 *   every single prompt, which is far worse than a missing cwd.
 * - no double quotes anywhere: the string is passed as one command-line
 *   argument and PowerShell re-parses it, so quotes only add failure modes.
 */
const integrationScript = [
  'if(-not $env:ELECTERM_SHELL_INTEGRATION){',
  "$env:ELECTERM_SHELL_INTEGRATION='1';",
  '$global:__e_prompt=$function:prompt;',
  'function global:prompt{',
  "$x=if($global:__e_prompt){& $global:__e_prompt}else{'PS '+$PWD+'> '};",
  'try{',
  "if($PWD.Provider.Name -eq 'FileSystem'){",
  String.raw`$p=$PWD.ProviderPath.Replace('\','\\').Replace(';','\x3b');`,
  String.raw`[Console]::Write([string][char]27+']633;P;Cwd='+$p+[string][char]7+[string][char]27+']633;A'+[string][char]7)`,
  '}',
  '}catch{};',
  '$x',
  '}',
  '}'
].join('')

/**
 * Is this executable PowerShell? `powershell.exe`, `pwsh`, an absolute path to
 * either - but not `pwsh-preview`'s neighbours, which do not exist.
 *
 * @param {string} shellPath
 * @returns {boolean}
 */
const isPowerShellPath = (shellPath) => {
  const shell = String(shellPath || '').trim().replace(/^"|"$/g, '')
  if (!shell) {
    return false
  }
  return /(?:^|[/\\])(?:powershell|pwsh)(?:\.exe)?$/i.test(shell)
}

/**
 * The parameter name an argument selects, e.g. `-NoProfile` -> `noprofile`,
 * `-Command:foo` -> `command`. PowerShell matches parameter names by prefix,
 * so callers compare prefixes rather than whole words.
 *
 * @param {string} arg
 * @returns {string}
 */
const parameterName = (arg) => String(arg || '')
  .trim()
  .replace(/^[-/]+/, '')
  .split(':')[0]
  .toLowerCase()

/**
 * Work out the argument list for a local PowerShell pty.
 *
 * Returns `null` when nothing should be injected - not PowerShell, or the user
 * asked for something that owns execution (`-Command`, `-File`, ...). Both the
 * server and the renderer call this, and the renderer only skips its own typing
 * when the answer is non-null, so "injected" and "should not type" can never
 * disagree.
 *
 * @param {string} shellPath - configured executable (`execWindows`)
 * @param {string[]} [userArgs] - configured arguments (`execWindowsArgs`)
 * @returns {string[]|null}
 */
const getPowerShellSpawnArgs = (shellPath, userArgs) => {
  if (!isPowerShellPath(shellPath)) {
    return null
  }
  const args = Array.isArray(userArgs)
    ? userArgs.filter(arg => typeof arg === 'string')
    : []
  if (args.some(arg => {
    const name = parameterName(arg)
    return !!name && executionSwitches.some(item => item.startsWith(name))
  })) {
    return null
  }
  const appended = args.some(arg => parameterName(arg) === 'noexit')
    ? []
    : ['-NoExit']
  return [...args, ...appended, '-Command', integrationScript]
}

/**
 * @returns {string} the script the pty is spawned with
 */
const getPowerShellIntegrationScript = () => integrationScript

module.exports = {
  getPowerShellIntegrationScript,
  getPowerShellSpawnArgs,
  isPowerShellPath
}
