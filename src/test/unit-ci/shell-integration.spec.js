const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/components/terminal/shell.js')
const loadTracker = () => import('../../client/components/terminal/command-tracker-addon.js')

// Issue #4610: telnet to a Huawei VRP switch. The remote `$SHELL` probe was
// answered with a CLI error banner, which was read as "some sh-compatible
// shell", so the PS1 integration script was typed into a device that cannot
// run `eval`. The device echoed it, the screen stayed frozen for the whole
// suppression window and the text ended up in the scrollback.
describe('remote shell probe parsing', () => {
  test('reads a normal shell path', async () => {
    const { parseRemoteShell } = await load()
    assert.equal(parseRemoteShell('/bin/bash\n'), 'bash')
    assert.equal(parseRemoteShell('/usr/local/bin/zsh'), 'zsh')
    assert.equal(parseRemoteShell('/usr/bin/fish\n'), 'fish')
    assert.equal(parseRemoteShell('/bin/dash\n'), 'sh')
  })

  test('is not fooled by an error banner or a prompt', async () => {
    const { parseRemoteShell } = await load()
    // Huawei VRP answers an unknown command like this
    assert.equal(parseRemoteShell('Error: Unrecognized command found at \'^\' position.\n'), '')
    assert.equal(parseRemoteShell('<HUAWEI>'), '')
    assert.equal(parseRemoteShell('% Invalid input detected\n'), '')
    // empty answer: $SHELL unset, or the command was swallowed
    assert.equal(parseRemoteShell(''), '')
    assert.equal(parseRemoteShell('   \r\n'), '')
    assert.equal(parseRemoteShell(undefined), '')
  })
})

describe('shell detection', () => {
  test('recognizes PowerShell, including a full path and pwsh', async () => {
    const { detectShellType } = await load()
    for (const shell of [
      'powershell',
      'powershell.exe',
      'pwsh',
      'pwsh.exe',
      'System32/WindowsPowerShell/v1.0/powershell.exe',
      'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      '"C:\\Program Files\\PowerShell\\7\\pwsh.exe"'
    ]) {
      assert.equal(detectShellType(shell), 'powershell', shell)
    }
  })

  // cmd is detected only so that nothing is injected into it: it cannot run any
  // script we have, and the POSIX `sh` default used to be the wrong answer.
  test('detects cmd without falling back to sh', async () => {
    const { detectShellType, shellIntegrationTypes } = await load()
    assert.equal(detectShellType('System32/cmd.exe'), 'cmd')
    assert.equal(detectShellType('C:\\Windows\\System32\\cmd.exe'), 'cmd')
    assert.equal(shellIntegrationTypes.has('cmd'), false)
  })

  test('leaves the POSIX detection alone', async () => {
    const { detectShellType } = await load()
    assert.equal(detectShellType('/bin/bash'), 'bash')
    assert.equal(detectShellType('/bin/zsh'), 'zsh')
    assert.equal(detectShellType('/usr/bin/fish'), 'fish')
    assert.equal(detectShellType('/bin/dash'), 'sh')
    assert.equal(detectShellType(''), 'sh')
    assert.equal(detectShellType(undefined), 'sh')
  })
})

// #4737: PowerShell has no PROMPT_COMMAND, so the prompt function is wrapped.
// It is what tells the app the live cwd a ctrl+clicked relative path is
// resolved against. A Windows local pty gets the script as a spawn argument
// (see powershell-spawn-integration.spec.js); typing it is only left for `pwsh`
// used as a local shell on macOS/Linux.
describe('PowerShell shell integration', () => {
  test('is sent raw and reports the cwd from the prompt', async () => {
    const { getShellIntegrationCommand } = await load()
    const cmd = getShellIntegrationCommand('powershell')
    // `eval '...'` is bash syntax, not PowerShell
    assert.equal(cmd.includes("eval '"), false)
    assert.equal(cmd.endsWith('\r'), true)
    assert.match(cmd, /ELECTERM_SHELL_INTEGRATION/)
    assert.match(cmd, /633;P;Cwd=/)
    assert.match(cmd, /633;A/)
    // the path is escaped the way OSC 633 expects (`\` -> `\\`, `;` -> `\x3b`)
    assert.ok(cmd.includes(String.raw`.Replace('\','\\')`), 'doubles the backslashes')
    assert.ok(cmd.includes(String.raw`.Replace(';','\x3b')`), 'escapes the semicolons')
    // and the user's own prompt still has to be drawn, before anything is
    // written: oh-my-posh reads `$?` first, and [Console]::Write resets it
    assert.ok(
      cmd.includes('$x=if($global:__e_prompt){& $global:__e_prompt}else{'),
      'calls the original prompt first'
    )
    // the same string travels as one command line argument to powershell.exe
    assert.equal(cmd.includes('"'), false, 'no double quotes')
  })
})

describe('OSC 633 value unescaping', () => {
  const deserialize = async (value) => {
    const { CommandTrackerAddon } = await loadTracker()
    return new CommandTrackerAddon()._deserializeOscValue(value)
  }

  test('collapses escaped backslashes', async () => {
    assert.equal(await deserialize('D:\\\\work\\\\project'), 'D:\\work\\project')
  })

  test('decodes escaped semicolons', async () => {
    assert.equal(await deserialize('E:\\\\a\\x3bb'), 'E:\\a;b')
  })

  // A Windows path may contain the characters `\x` followed by hex digits. The
  // old two-pass version decoded `\x..` *before* collapsing `\\`, so `D:\\x86`
  // came back as `D:V`: every path with a directory starting with `x`+hex broke.
  test('does not read a real backslash as the start of an escape', async () => {
    assert.equal(await deserialize('D:\\\\x86\\\\build'), 'D:\\x86\\build')
    assert.equal(await deserialize('C:\\\\x41bc'), 'C:\\x41bc')
  })

  test('keeps a lone backslash and unknown escapes as they are', async () => {
    assert.equal(await deserialize('C:\\work\\z'), 'C:\\work\\z')
    assert.equal(await deserialize('a\\qb'), 'a\\qb')
    assert.equal(await deserialize(''), '')
  })

  test('round-trips a path containing a semicolon', async () => {
    const { CommandTrackerAddon } = await loadTracker()
    const path = 'D:\\work;x\\[a]\\b'
    const escaped = path.replace(/\\/g, '\\\\').replace(/;/g, '\\x3b')
    assert.equal(new CommandTrackerAddon()._deserializeOscValue(escaped), path)
  })
})
