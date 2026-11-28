const { test } = require('node:test')
const assert = require('node:assert/strict')
const { registerHooks } = require('node:module')

global.window = {}
// Stub only the independent SSH exec channel. The renderer registry, xterm
// row/cursor checks and per-connection cache go through the production path.
const hook = registerHooks({
  resolve (specifier, context, nextResolve) {
    if (specifier === './terminal-apis.js') {
      return { url: 'data:text/javascript,export const execCmd = (...args) => window.probe(...args)', shortCircuit: true }
    }
    return nextResolve(specifier, context)
  }
})
const moduleReady = import('../../client/components/terminal/idle-shell.js').finally(() => hook.deregister())

function attach (shell, prompt, ssh = false) {
  const buffer = {
    row: prompt,
    type: 'normal',
    cursorX: prompt.length,
    cursorY: 1,
    baseY: 0,
    getLine () {
      return { translateToString: (trim, start, end) => this.row.slice(start, end).trimEnd() }
    }
  }
  const session = {
    pid: 'test',
    isLocal: () => !ssh,
    isSsh: () => ssh,
    attachAddon: {
      socket: { readyState: 1 },
      hasReceivedInitialData: true,
      _lineHasUnsubmittedInput: () => false,
      getLastOutputTime: () => 10
    },
    term: { buffer: { active: buffer } },
    startupQueue: { getLocalExec: () => ({ shell, args: [] }) }
  }
  window.refs.set('term-test', session)
  return session
}

test('uses the actual local executable and common empty shell prompts', async () => {
  const { getIdleShellType } = await moduleReady
  for (const [executable, prompt, shell] of [
    ['/bin/sh', '$ ', 'sh'],
    ['/bin/bash', 'user@host:~/dir$ ', 'bash'],
    ['/bin/bash', '[root@host dir]# ', 'bash'],
    ['/bin/zsh', 'user@host ~ % ', 'zsh'],
    ['/bin/zsh', 'host% ', 'zsh'],
    ['/bin/fish', 'user@host ~> ', 'fish'],
    ['/bin/bash', '用户@主机:~/项目$ ', 'bash'],
    ['/bin/zsh', '❯ ', 'zsh'],
    ['C:\\Windows\\system32\\cmd.exe', 'C:\\Users\\Test>', 'cmd'],
    ['powershell.exe', 'PS C:\\Program Files> ', 'powershell'],
    ['/usr/local/bin/pwsh', 'PS /home/test> ', 'pwsh']
  ]) {
    attach(executable, prompt)
    assert.equal(await getIdleShellType('test'), shell, prompt)
  }
  for (const prompt of ['>>> ', 'mysql> ', 'postgres=# ', 'router#', 'Password: ', '> ', 'user@host:~$ echo $']) {
    attach('/bin/bash', prompt)
    assert.equal(await getIdleShellType('test'), '', prompt)
  }
  attach('/usr/bin/custom', '$ ')
  assert.equal(await getIdleShellType('test'), '')
  const interrupted = attach('/bin/bash', '$ ')
  interrupted.startupQueue.getLocalExec = () => ({ shell: '/bin/bash', args: ['-c', 'some-script'] })
  assert.equal(await getIdleShellType('test'), '')
  interrupted.startupQueue.getLocalExec = () => ({ shell: '/bin/bash', args: ['/d'] })
  assert.equal(await getIdleShellType('test'), '')
})

test('requires a clean connected terminal and no text beyond the cursor', async () => {
  const { getIdleShellType } = await moduleReady
  const mutations = [
    t => { t.attachAddon._lineHasUnsubmittedInput = () => true },
    t => { t.attachAddon._pendingInputUnknown = true },
    t => { t.attachAddon._lastInputTime = 11 },
    t => { t.attachAddon.socket.readyState = 3 },
    t => { t.attachAddon.outputSuppressed = true },
    t => { t.startupQueue.running = true },
    t => { t.term.buffer.active.type = 'alternate' },
    t => { t.term.buffer.active.row += 'echo data' },
    t => { t.cmdAddon = { currentCommand: 'python' } },
    t => { t.state = { sessionStopped: true } },
    t => { t.isLocal = () => false }
  ]
  for (const mutate of mutations) {
    const session = attach('/bin/bash', '$ ')
    mutate(session)
    assert.equal(await getIdleShellType('test'), '', mutate.toString())
  }
})

test('uses a bounded SSH exec once per connection and checks the target again when it returns', async () => {
  const { getIdleShellType } = await moduleReady
  let calls = 0
  window.probe = (pid, command, timeout, options) => {
    calls++
    assert.equal(pid, 'test')
    assert.equal(command, 'printf "%s\\n" "$SHELL"')
    assert.ok(timeout > 0 && timeout < 5000)
    assert.equal(options.silent, true)
    return { exitCode: 0, stdout: '/bin/bash\n' }
  }
  attach('', '$ ', true)
  assert.deepEqual(await Promise.all([getIdleShellType('test'), getIdleShellType('test')]), ['bash', 'bash'])
  assert.equal(calls, 1)
  for (const result of [{ timedOut: true }, { exitCode: 1 }, { exitCode: 0, stdout: 'failed\n/bin/bash' }, { exitCode: 0, stdout: '/bin/cli' }]) {
    attach('', '# ', true)
    window.probe = () => result
    assert.equal(await getIdleShellType('test'), '')
  }
  attach('', '$ ', true)
  window.probe = async () => { throw new Error('exec refused') }
  assert.equal(await getIdleShellType('test'), '')

  for (const mutate of [
    t => { t.attachAddon._lineHasUnsubmittedInput = () => true },
    t => { t.attachAddon = { ...t.attachAddon } },
    t => { t.pid = 'reconnected' },
    () => { attach('', '$ ', true) }
  ]) {
    const session = attach('', '$ ', true)
    let finish
    window.probe = () => new Promise(resolve => { finish = resolve })
    const pending = getIdleShellType('test')
    mutate(session)
    finish({ exitCode: 0, stdout: '/bin/bash\n' })
    assert.equal(await pending, '')
  }
})

test('tracks a custom OSC prompt through xterm and invalidates it when input or the foreground program changes', async () => {
  const { Terminal } = require('@xterm/headless')
  const { CommandTrackerAddon } = await import('../../client/components/terminal/command-tracker-addon.js')
  const { getIdleShellType } = await moduleReady
  for (const shell of ['bash', 'zsh', 'fish']) {
    const session = attach(shell, '')
    const xterm = new Terminal({ allowProposedApi: true })
    session.term = xterm
    const tracker = new CommandTrackerAddon()
    xterm.loadAddon(tracker)
    session.cmdAddon = tracker
    const write = data => new Promise(resolve => {
      const event = xterm.onWriteParsed(() => { event.dispose(); resolve() })
      xterm.write(data)
    })
    try {
      await write('\x1b]633;A\x07⟦测试⟧ ➜ ')
      assert.equal(await getIdleShellType('test'), shell)
      await write('appended')
      assert.equal(await getIdleShellType('test'), '')
      await write('\r\n> ')
      assert.equal(await getIdleShellType('test'), '')
      await write('\r\n\x1b]633;A\x07⟦另一目录⟧ ➜ \x1b]633;B\x07')
      assert.equal(await getIdleShellType('test'), shell)
      await write('\x1b]633;C\x07\r\n$ ')
      assert.equal(await getIdleShellType('test'), '')
      await write('\x1b]633;E;python\x07\r\n>>> ')
      assert.equal(await getIdleShellType('test'), '')
    } finally {
      xterm.dispose()
    }
  }
})
