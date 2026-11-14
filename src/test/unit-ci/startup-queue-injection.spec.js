const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

global.window = {
  et: { isWin: true, isMac: false },
  store: { triggerResize: () => {} },
  initFolder: ''
}

const tick = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms))

const loadQueue = () => import('../../client/components/terminal/startup-queue.js')

// A stub of the attach addon with the three pieces the injection uses: the
// idleness clock (`getLastOutputTime`, updated even while output is hidden),
// the suppression switch, and the data channel. `feed()` simulates the shell
// writing something.
const makeAddon = () => {
  const addon = {
    disposed: false,
    outputSuppressed: false,
    lastOutput: Date.now(),
    sent: [],
    stoppedWith: [],
    onEnd: null,
    getLastOutputTime: () => addon.lastOutput,
    feed: () => {
      addon.lastOutput = Date.now()
    },
    _sendData: data => addon.sent.push(data),
    onInitialData: cb => setTimeout(cb, 0),
    startOutputSuppression: (timeout, onEnd, discardOnTimeout) => {
      addon.outputSuppressed = true
      addon.onEnd = onEnd
      addon.discardOnTimeout = discardOnTimeout
      addon.timeout = timeout
    },
    stopOutputSuppression: (discard = true) => {
      if (!addon.outputSuppressed) {
        return
      }
      addon.outputSuppressed = false
      addon.stoppedWith.push(discard)
      const cb = addon.onEnd
      addon.onEnd = null
      cb?.()
    },
    waitForOutputIdle: () => Promise.resolve(true)
  }
  return addon
}

const makeQueue = async (addon, { setup, remote = false, localStart = '' } = {}) => {
  const { StartupQueue } = await loadQueue()
  const host = {
    attachAddon: addon,
    localShell: 'powershell.exe',
    props: {
      tab: remote
        ? { type: 'ssh' }
        : { type: 'local', startDirectoryLocal: localStart },
      // A remote probe needs something to ask for the integration.
      config: { execWindows: 'powershell.exe', showCmdSuggestions: remote }
    },
    isLocal: () => !remote,
    isSsh: () => remote
  }
  const queue = new StartupQueue(host, {
    detectRemoteShell: () => Promise.resolve('bash')
  })
  if (setup) {
    setup(queue)
  }
  queue.runInitScript('powershell.exe')
  return queue
}

// #4737: on Windows local PowerShell the integration is a spawn argument
// (`-NoExit -Command <script>`, see powershell-spawn-integration.spec.js), so
// the queue has nothing to type - the typed form is what used to end up on
// screen. What it still owns is the *wait*: nothing queued behind it may be
// typed into a shell that is still booting.
describe('local PowerShell startup', () => {
  test('never types the script, and opens no suppression window', async () => {
    const addon = makeAddon()
    const queue = await makeQueue(addon)
    await tick(50)
    addon.feed()
    await tick(queue.promptReadyQuietMs + 250)
    assert.deepEqual(addon.sent, [], 'the pty was spawned with the integration')
    assert.deepEqual(addon.stoppedWith, [], 'nothing to hide, so nothing was hidden')
    assert.equal(queue.shellInjected, true, 'the shell reports its cwd by itself')
    queue.dispose()
  })

  test('holds the start directory command until the shell has a prompt', async () => {
    const addon = makeAddon()
    const queue = await makeQueue(addon, { localStart: 'D:\\work' })
    await tick(50)
    assert.deepEqual(addon.sent, [], 'no keystroke into a shell that is still booting')

    // conpty's own init sequences are not a prompt: they arrive before it.
    addon.feed()
    await tick(100)
    assert.deepEqual(addon.sent, [], 'the pty talking is not the shell listening')

    // ... the prompt, and then silence.
    addon.feed()
    await tick(queue.promptReadyQuietMs + 250)
    assert.deepEqual(addon.sent, ["Set-Location -LiteralPath 'D:\\work'\r"])
    queue.dispose()
  })

  test('never types the script into a shell that never settles', async () => {
    const addon = makeAddon()
    const queue = await makeQueue(addon, {
      localStart: 'D:\\work',
      setup: q => {
        q.promptReadyTimeoutMs = 300
        q.promptReadyQuietMs = 100
      }
    })
    // A shell that never stops talking (a flooding MOTD, a loop in a profile).
    const flood = setInterval(() => addon.feed(), 50)
    await tick(700)
    clearInterval(flood)
    // The start directory is still sent - it is one short line, and dropping it
    // would lose a session restore - but nothing of the injection itself.
    assert.deepEqual(
      addon.sent.filter(data => /ELECTERM_SHELL_INTEGRATION/.test(data)),
      []
    )
    queue.dispose()
  })

  // A reconnect spawns a fresh pty, so "already injected" belongs to the old
  // one: the new shell has to be waited for again, or the start directory is
  // typed into a booting console.
  test('starts over on a new connection', async () => {
    const addon = makeAddon()
    const queue = await makeQueue(addon, { localStart: 'D:\\work' })
    await tick(50)
    addon.feed()
    await tick(queue.promptReadyQuietMs + 250)
    assert.equal(addon.sent.length, 1)

    addon.sent.length = 0
    queue.shellInjected = true
    queue.runInitScript('powershell.exe')
    await tick(50)
    assert.deepEqual(addon.sent, [], 'the new pty is waited for as well')

    addon.feed()
    await tick(queue.promptReadyQuietMs + 250)
    assert.equal(addon.sent.length, 1)
    queue.dispose()
  })
})

// A remote shell can not be spawned by us, so the script is still typed there -
// and the window that hides its echo still has to behave: nothing before the
// prompt, and on giving up the buffered echo is discarded, never flushed.
describe('remote shell integration window', () => {
  test('types nothing until the shell has drawn a prompt', async () => {
    const addon = makeAddon()
    const queue = await makeQueue(addon, { remote: true })
    await tick(50)
    assert.deepEqual(addon.sent, [], 'no keystroke into a shell that is still booting')
    assert.equal(addon.outputSuppressed, false, 'nothing to hide yet, so nothing is hidden')

    // The login banner is not the prompt.
    addon.feed()
    await tick(200)
    assert.deepEqual(addon.sent, [], 'a trickling banner is not a prompt')

    // ... the prompt, and then a quiet long enough for a network round trip.
    addon.feed()
    await tick(1500 + 300)
    assert.equal(addon.sent.length, 1, 'the script is typed at the prompt')
    assert.match(addon.sent[0], /ELECTERM_SHELL_INTEGRATION/)
    assert.equal(addon.outputSuppressed, true, 'and hidden while it echoes')
    queue.dispose()
  })

  test('skips the injection when the shell never settles', async () => {
    const addon = makeAddon()
    const queue = await makeQueue(addon, {
      remote: true,
      setup: q => {
        q.promptReadyTimeoutMs = 300
        q.promptReadyQuietMs = 100
      }
    })
    const flood = setInterval(() => addon.feed(), 50)
    await tick(700)
    clearInterval(flood)
    assert.deepEqual(addon.sent, [], 'never typed into a shell that never settles')
    assert.equal(queue.shellInjected, false)
    assert.deepEqual(addon.stoppedWith, [], 'no window was ever opened')
    queue.dispose()
  })

  test('keeps hiding while the shell is silent, and never flushes the echo', async () => {
    const addon = makeAddon()
    const queue = await makeQueue(addon, { remote: true })
    await tick(40)
    addon.feed()
    await tick(1500 + 300)
    assert.equal(addon.sent.length, 1)

    // The echo arrives but the prompt never confirms OSC 633 (a profile that
    // replaced `prompt` afterwards), so the window must end without writing
    // anything back to the screen.
    addon.feed()
    await tick(2700)
    assert.equal(addon.outputSuppressed, false, 'gave up on a silent shell')
    assert.deepEqual(addon.stoppedWith, [true], 'buffered echo is discarded, not flushed')
    assert.equal(queue.shellInjected, false, 'no confirmation, so not marked as injected')
    queue.dispose()
  })
})
