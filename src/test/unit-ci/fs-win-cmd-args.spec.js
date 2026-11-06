// runtime-constants (via ../common/log) can only load its package.json with the
// dev flag outside a packaged app -- see log-debug-level.spec.js
process.env.NODE_ENV = 'development'

const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const { buildWinCmdArgs } = require('../../app/lib/fs')

// GHSA-ph25-cg2g-62cf: the local folder-size script used to be handed to
// child_process.exec as `powershell.exe -Command "<script>"`, which on Windows
// runs through cmd.exe. `escapePowerShellArg` only doubles the single quote, so
// a folder name containing `"` closed that wrapper early and the `&` after it
// was parsed by cmd.exe as a command separator (WSL / SMB / extracted archives
// all allow `"` in a name).
//
// The fix spawns powershell.exe directly and passes the script as one base64
// `-EncodedCommand` argv entry: there is no quoting layer left to escape out
// of. These tests pin that shape, like session-sftp-remote-command.spec.js
// does for the remote path.
const decode = (arg) => Buffer.from(arg, 'base64').toString('utf16le')

// mirrors getFolderSizeWin in src/app/lib/fs.js
const getFolderSizeScript = (folderPath) => {
  const safePath = String(folderPath).replace(/'/g, "''")
  return `Get-ChildItem -Path '${safePath}' -Recurse | Where-Object { ! $_.PSIsContainer } | Measure-Object -Property Length -Sum`
}

// both delivery techniques from the advisories, plus generic cmd.exe soup
const hostileNames = [
  'project" & calc & rem \'',
  'test%CMDCMDLINE%end & calc & rem',
  'a & calc & "',
  'x" | calc',
  '$(calc)'
]

describe('buildWinCmdArgs', () => {
  test('passes the script as a single base64 argv entry', () => {
    const script = getFolderSizeScript('C:\\Users\\zx\\dev')
    const args = buildWinCmdArgs(script)
    assert.deepEqual(
      args.slice(0, 4),
      ['-NoLogo', '-NonInteractive', '-NoProfile', '-EncodedCommand']
    )
    assert.equal(args.length, 5)
    assert.equal(decode(args[4]), script)
  })

  test('no argv entry carries a cmd.exe or shell metacharacter', () => {
    for (const name of hostileNames) {
      const args = buildWinCmdArgs(getFolderSizeScript(name))
      for (const arg of args) {
        assert.doesNotMatch(arg, /["&|<>^%'`$;]/, `metacharacter leaked for ${name}`)
      }
    }
  })

  test('hostile folder name stays inside the PowerShell string literal', () => {
    const name = hostileNames[0]
    const args = buildWinCmdArgs(getFolderSizeScript(name))
    const script = decode(args[4])
    // the double quote is no longer special (nothing wraps the script), and the
    // single quote is still escaped for the PowerShell parser
    assert.ok(script.includes(`'${name.replace(/'/g, "''")}'`))
    assert.ok(script.startsWith('Get-ChildItem -Path \'project" & calc & rem \'\''))
  })
})
