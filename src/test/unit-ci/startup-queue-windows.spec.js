const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

global.window = {
  et: { isWin: true, isMac: false },
  store: { triggerResize: () => {} },
  initFolder: ''
}

const loadCommands = () => import('../../client/components/terminal/ssh-reload-state.js')

const startupCommand = async ({ shell, resolvedShell, cwd, reloadCwd, remote = false }) => {
  const { StartupQueue } = await import('../../client/components/terminal/startup-queue.js')
  const sent = []
  const host = {
    attachAddon: { _sendData: data => sent.push(data) },
    props: {
      tab: { type: remote ? 'ssh' : 'local', startDirectory: cwd, _reloadState: { cwd: reloadCwd } },
      config: { execWindows: shell, restoreTerminalSessionOnReload: !!reloadCwd }
    },
    isLocal: () => !remote,
    isSsh: () => remote
  }
  const queue = new StartupQueue(host)
  queue.runInitScript(resolvedShell)
  queue.dispose()
  assert.equal(sent.length, 1)
  return sent[0]
}

describe('Windows startup directory', () => {
  test('uses PowerShell literal paths for the default Windows shell', async () => {
    assert.equal(
      await startupCommand({ shell: 'System32/WindowsPowerShell/v1.0/powershell.exe', cwd: 'C:\\work folder' }),
      "Set-Location -LiteralPath 'C:\\work folder'\r"
    )
  })

  test('restores the captured directory in pwsh instead of the configured start directory', async () => {
    assert.equal(
      await startupCommand({ shell: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', cwd: 'C:\\start', reloadCwd: "D:\\[work]\\it's $data`" }),
      "Set-Location -LiteralPath 'D:\\[work]\\it''s $data`'\r"
    )
  })

  test('recognizes PowerShell executable names without changing CMD commands', async () => {
    const { createWindowsRestoreCwdCommand } = await loadCommands()
    for (const shell of ['powershell', 'POWERSHELL.EXE', 'pwsh', 'pwsh.exe']) {
      assert.equal(createWindowsRestoreCwdCommand('D:\\work', shell), "Set-Location -LiteralPath 'D:\\work'")
    }
    for (const shell of ['', 'cmd.exe', 'C:\\Windows\\System32\\cmd.exe']) {
      assert.equal(createWindowsRestoreCwdCommand('D:\\work', shell), 'cd /d "D:\\work"')
    }
  })

  test('keeps CMD drive switching in the startup queue', async () => {
    assert.equal(
      await startupCommand({ shell: 'System32/cmd.exe', cwd: 'D:\\work folder' }),
      'cd /d "D:\\work folder"\r'
    )
  })

  test('uses the live session shell when a bookmark overrides the global shell', async () => {
    assert.equal(
      await startupCommand({ shell: 'powershell.exe', resolvedShell: 'cmd.exe', cwd: 'D:\\work' }),
      'cd /d "D:\\work"\r'
    )
    assert.equal(
      await startupCommand({ shell: 'cmd.exe', resolvedShell: 'pwsh.exe', cwd: 'D:\\work' }),
      "Set-Location -LiteralPath 'D:\\work'\r"
    )
  })

  test('honors the CLI initial directory with the default PowerShell', async () => {
    window.initFolder = 'C:\\initial directory'
    try {
      assert.equal(
        await startupCommand({ shell: 'powershell.exe' }),
        "Set-Location -LiteralPath 'C:\\initial directory'\r"
      )
    } finally {
      window.initFolder = ''
    }
  })

  test('keeps remote POSIX directory quoting on a Windows client', async () => {
    assert.equal(
      await startupCommand({ shell: 'powershell.exe', cwd: '/srv/work folder', remote: true }),
      "cd -- '/srv/work folder'\r"
    )
  })

  test('rejects empty and control-character paths for both Windows shells', async () => {
    const { createWindowsRestoreCwdCommand } = await loadCommands()
    for (const shell of ['powershell.exe', 'cmd.exe']) {
      for (const cwd of ['', 'C:\\bad\npath', 'C:\\bad\rpath', 'C:\\bad\0path']) {
        assert.equal(createWindowsRestoreCwdCommand(cwd, shell), '')
      }
    }
  })
})
