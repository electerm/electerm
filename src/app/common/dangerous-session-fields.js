/**
 * Session fields that must never be settable from untrusted input: a deep link
 * URL, CLI `--opts`, an MCP/AI tool call, or a shortcut file.
 *
 * Every entry reaches one of: child_process.spawn(), a shell, the process
 * environment, or the terminal input stream.
 *
 * Why this is a shared module and not a local array: `proxyCommand` was added
 * by a later feature and reached spawn() from a single clicked link because the
 * denylists of the time were five separate copies and none of them was updated
 * (follow-up to GHSA-mpm8-cx2p-626q). One list, imported everywhere, is what
 * makes the guard maintainable.
 *
 * Why a denylist and not an allowlist: a quick connect string may legitimately
 * carry any session option (encode, term, authType, agentForward, sshTunnels,
 * startDirectoryRemote, ...). An allowlist would silently break every field it
 * does not know about, which is a worse failure than the one it prevents. The
 * cost of that choice is that a future exec-capable option must be added here.
 *
 * Keep in sync with the copy of this file in the other bundle - there is a unit
 * test that fails when the two copies drift.
 */
module.exports = [
  // spawns an external process (before any SSH authentication)
  'proxyCommand',
  // run scripts after connect / override the shell binary
  'runScripts',
  'execLinux',
  'execMac',
  'execWindows',
  'execLinuxArgs',
  'execMacArgs',
  'execWindowsArgs',
  // injects environment variables into the session
  'setEnv',
  // injects interactive prompts / auto-answers terminal output
  'interactiveValues',
  'triggers'
]
