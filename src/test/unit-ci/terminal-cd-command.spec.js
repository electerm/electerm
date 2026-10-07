const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/components/terminal/ssh-reload-state.js')

// `cd <dir>` for the file panel's "go to folder in terminal". The path is
// attacker-influenced (it can come out of an unpacked archive), so every branch
// has to quote with the target shell's own rules.
describe('terminal cd command', () => {
  test('uses PowerShell syntax for a local Windows session', async () => {
    const { createCdCommand } = await load()
    assert.equal(
      createCdCommand('C:\\work folder', { shell: 'System32/WindowsPowerShell/v1.0/powershell.exe' }),
      "Set-Location -LiteralPath 'C:\\work folder'"
    )
    // -LiteralPath keeps brackets from being read as a wildcard.
    assert.equal(
      createCdCommand('D:\\[work]', { shell: 'pwsh.exe' }),
      "Set-Location -LiteralPath 'D:\\[work]'"
    )
  })

  test('keeps CMD syntax for a local Windows session running cmd', async () => {
    const { createCdCommand } = await load()
    assert.equal(
      createCdCommand('D:\\work folder', { shell: 'System32/cmd.exe' }),
      'cd /d "D:\\work folder"'
    )
  })

  test('keeps CMD syntax for a remote tab, whose shell is unknown', async () => {
    const { createCdCommand } = await load()
    assert.equal(
      createCdCommand('C:\\work folder', { remote: true, shell: 'pwsh.exe' }),
      'cd /d "C:\\work folder"'
    )
  })

  test('single-quotes a POSIX path so the shell cannot expand it', async () => {
    const { createCdCommand } = await load()
    assert.equal(
      createCdCommand('/srv/work folder', { shell: '/bin/zsh' }),
      "cd '/srv/work folder'"
    )
    // A bare `cd "..."` would run these.
    assert.equal(
      createCdCommand('/tmp/$(touch nope)', {}),
      "cd '/tmp/$(touch nope)'"
    )
    assert.equal(
      createCdCommand('/tmp/`touch nope`', {}),
      "cd '/tmp/`touch nope`'"
    )
    // POSIX escape for an embedded single quote: close, escape, reopen.
    assert.equal(
      createCdCommand("/tmp/it's here", {}),
      "cd '/tmp/it'\"'\"'s here'"
    )
  })

  test('refuses a path it cannot quote safely', async () => {
    const { createCdCommand } = await load()
    for (const dir of ['', 'C:\\bad\npath', 'C:\\bad\rpath', 'C:\\bad\0path', 'x'.repeat(4097)]) {
      assert.equal(
        createCdCommand(dir, { shell: 'pwsh.exe' }),
        '',
        `refused ${JSON.stringify(dir.slice(0, 20))}`
      )
    }
  })
})
