const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

global.window = {
  et: { isWin: true, isMac: false },
  store: { triggerResize: () => {} },
  initFolder: ''
}

const loadCommands = () => import('../../client/components/terminal/ssh-reload-state.js')

const tick = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms))

// A local Windows PowerShell session now gets shell integration injected first
// (it is what reports the live cwd, #4737), so the queue sends two things and
// the startup directory is the last one. The addon stub below completes every
// wait immediately, so `tick()` is enough for the whole queue to drain.
const makeAddon = (sent) => ({
  sent,
  disposed: false,
  outputSuppressed: false,
  _sendData: data => sent.push(data),
  getLastOutputTime: () => Date.now(),
  onInitialData: cb => cb(),
  startOutputSuppression: (timeout, onEnd) => {
    if (onEnd) {
      onEnd()
    }
  },
  stopOutputSuppression: () => {},
  waitForOutputIdle: () => Promise.resolve(true)
})

const runQueue = async ({
  shell,
  resolvedShell,
  cwd,
  localStart,
  reloadCwd,
  remote = false,
  localShell,
  args,
  tab: tabOverrides
}) => {
  const { StartupQueue } = await import('../../client/components/terminal/startup-queue.js')
  const sent = []
  const local = !remote
  // `cwd` is the far side's directory on a remote tab and the local one on a
  // local tab; a local tab only carries the remote field when a test asks for
  // it explicitly through `tab`, which is how "ignore it" is proven.
  const tab = {
    type: local ? 'local' : 'ssh',
    startDirectory: local ? undefined : cwd,
    startDirectoryLocal: local ? localStart ?? cwd : localStart,
    _reloadState: { cwd: reloadCwd },
    ...tabOverrides
  }
  const host = {
    attachAddon: makeAddon(sent),
    localShell,
    props: {
      tab,
      config: {
        execWindows: shell,
        execWindowsArgs: args || [],
        restoreTerminalSessionOnReload: !!reloadCwd
      }
    },
    isLocal: () => local,
    isSsh: () => remote
  }
  const queue = new StartupQueue(host)
  // The stub addon never emits anything, so the "is the shell listening yet?"
  // gate would hold the queue for its full timeout; what it guarantees is
  // covered in startup-queue-injection.spec.js.
  queue.waitForFirstPrompt = () => Promise.resolve(true)
  queue.runInitScript(resolvedShell)
  await tick()
  queue.dispose()
  return sent
}

const startupCommand = async (options) => {
  const sent = await runQueue(options)
  assert.ok(sent.length > 0, 'a startup directory command was typed')
  return sent[sent.length - 1]
}

describe('Windows startup directory', () => {
  test('uses PowerShell literal paths for the default Windows shell', async () => {
    assert.equal(
      await startupCommand({ shell: 'System32/WindowsPowerShell/v1.0/powershell.exe', cwd: 'C:\\work folder' }),
      "Set-Location -LiteralPath 'C:\\work folder'\r"
    )
  })

  // Reachability note: on a Windows *local* tab this precedence cannot occur in
  // production - `_reloadState.cwd` is only ever populated from OSC 633, and
  // canInjectShellIntegration() excludes `isLocal() && isWin`. What is under
  // test here is the queue's argument handling, not a live scenario.
  test('quotes a captured reload directory for pwsh', async () => {
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

  test('tolerates a quoted or padded PowerShell executable path', async () => {
    const { createWindowsRestoreCwdCommand } = await loadCommands()
    for (const shell of [
      '  pwsh.exe  ',
      '"C:\\Program Files\\PowerShell\\7\\pwsh.exe"',
      'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
    ]) {
      assert.equal(
        createWindowsRestoreCwdCommand('D:\\work', shell),
        "Set-Location -LiteralPath 'D:\\work'",
        `for ${JSON.stringify(shell)}`
      )
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

  // A quick-connect link / CLI --opts can set startDirectory. The sanitizer
  // rejects control characters, and the queue must not then fall back to
  // typing the raw value - balanced quotes plus a newline would run a second
  // command in the freshly opened shell.
  test('types no directory command when the start directory is unusable', async () => {
    const cdRe = /Set-Location|cd \/d/
    for (const cwd of ['C:\\ok"\ncalc\n"', 'C:\\bad\npath', 'C:\\bad\rpath']) {
      const sent = await runQueue({ shell: 'pwsh.exe', cwd })
      assert.deepEqual(
        sent.filter(d => cdRe.test(d)),
        [],
        `no command for ${JSON.stringify(cwd)}`
      )
    }
  })

  // #4737: the integration is a spawn argument now (`-NoExit -Command <script>`,
  // see powershell-spawn-integration.spec.js), so nothing of it is typed - the
  // typed form is what used to end up on screen.
  test('does not type the shell integration into local PowerShell', async () => {
    const sent = await runQueue({ shell: 'pwsh.exe', cwd: 'D:\\work' })
    assert.deepEqual(sent, ["Set-Location -LiteralPath 'D:\\work'\r"])
  })

  // ... unless the spawn was left alone. When the user's own arguments own
  // execution the server does not inject, and the renderer types the script as
  // before: both sides ask the same helper, so "injected" and "typed" can never
  // both happen.
  test('still types it when the user arguments own execution', async () => {
    const sent = await runQueue({
      shell: 'pwsh.exe',
      cwd: 'D:\\work',
      args: ['-NoProfile', '-File', 'C:\\setup.ps1']
    })
    assert.equal(sent.length, 2)
    assert.match(sent[0], /ELECTERM_SHELL_INTEGRATION/)
    assert.equal(sent[1], "Set-Location -LiteralPath 'D:\\work'\r")
  })

  // cmd cannot report a cwd from its prompt: injecting the PowerShell script
  // there would only print a parse error into the user's terminal.
  test('leaves cmd alone', async () => {
    const sent = await runQueue({ shell: 'cmd.exe', cwd: 'D:\\work' })
    assert.deepEqual(sent, ['cd /d "D:\\work"\r'])
  })

  // `startDirectory` is the far side's directory. A local tab must never move
  // the user's own shell there, even when a bookmark still carries the value
  // (an ssh bookmark switched to local keeps it in the saved object).
  test('ignores the remote start directory on a local tab', async () => {
    const sent = await runQueue({
      shell: 'cmd.exe',
      tab: { startDirectory: 'D:\\remote' }
    })
    assert.deepEqual(sent, [])
  })

  test('moves to the local start directory on a local tab', async () => {
    const sent = await runQueue({
      shell: 'cmd.exe',
      localStart: 'D:\\local',
      tab: { startDirectory: 'D:\\remote' }
    })
    assert.deepEqual(sent, ['cd /d "D:\\local"\r'])
  })
})
