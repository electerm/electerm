const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

global.window = global.window || {}
global.window.store = { triggerResize: () => {} }
global.window.initFolder = ''

const loadModule = () => import('../../client/components/terminal/startup-queue.js')

const tick = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms))

const makeAddon = ({ holdInitialData = false, autoEndSuppression = true } = {}) => {
  const sent = []
  const addon = {
    sent,
    disposed: false,
    outputSuppressed: false,
    pendingInitialData: null,
    _sendData: (d) => sent.push(d),
    onInitialData: (cb) => {
      if (holdInitialData) {
        addon.pendingInitialData = cb
        return
      }
      cb()
    },
    startOutputSuppression: (timeout, onEnd) => {
      addon.outputSuppressed = true
      addon.endSuppression = () => {
        addon.outputSuppressed = false
        if (onEnd) {
          onEnd()
        }
      }
      if (autoEndSuppression) {
        setTimeout(() => addon.endSuppression(), 0)
      }
    },
    stopOutputSuppression: () => {
      addon.outputSuppressed = false
    },
    waitForOutputIdle: () => Promise.resolve(true)
  }
  return addon
}

const makeHost = (addon, { runScripts = [], config = {}, sftpPathFollowSsh = false, isSsh = false } = {}) => {
  return {
    attachAddon: addon,
    cmdAddon: null,
    onClose: false,
    pid: 'pid-1',
    props: {
      tab: { runScripts },
      config: { execMac: '/bin/zsh', execLinux: '/bin/bash', ...config },
      sftpPathFollowSsh
    },
    isSsh: () => isSsh,
    isLocal: () => !isSsh
  }
}

const makeQueue = async (options) => {
  const { StartupQueue } = await loadModule()
  const addon = makeAddon(options)
  const host = makeHost(addon, options)
  return { queue: new StartupQueue(host), addon, host }
}

describe('startup queue', () => {
  test('runs every script once, in order', async () => {
    const { queue, addon } = await makeQueue({
      runScripts: [
        { script: 'one', delay: 0 },
        { script: 'two', delay: 0 },
        { script: 'three', delay: 0 }
      ]
    })

    queue.runInitScript()
    await tick()

    assert.deepEqual(addon.sent, ['one\r', 'two\r', 'three\r'])
  })

  test('a new generation replaces the pending one instead of mixing', async () => {
    const { queue, addon, host } = await makeQueue()
    // Hold every settle until `hold` is cleared, so the loop stays parked
    // inside item 1 while the queue is rebuilt underneath it.
    let hold = true
    const pending = []
    addon.waitForOutputIdle = () => hold
      ? new Promise(resolve => pending.push(resolve))
      : Promise.resolve(true)
    const unhold = () => {
      hold = false
      pending.splice(0).forEach(resolve => resolve(true))
    }

    host.props.tab.runScripts = [{ script: 'old-1', delay: 0 }, { script: 'old-2', delay: 0 }]
    queue.runInitScript()
    await tick(5)
    assert.deepEqual(addon.sent, ['old-1\r'])

    // reconnect / rebuild: the stale item must never be typed
    host.props.tab.runScripts = [{ script: 'new-1', delay: 0 }, { script: 'new-2', delay: 0 }]
    queue.runInitScript()

    unhold()
    await tick(30)

    assert.deepEqual(addon.sent, ['old-1\r', 'new-1\r', 'new-2\r'])
  })

  test('shell integration is injected before the scripts and only once', async () => {
    const { queue, addon } = await makeQueue({
      sftpPathFollowSsh: true,
      runScripts: [{ script: 'ls', delay: 0 }]
    })

    queue.runInitScript()
    await tick()

    assert.equal(addon.sent.length, 2)
    assert.match(addon.sent[0], /ELECTERM_SHELL_INTEGRATION/)
    assert.equal(addon.sent[1], 'ls\r')
    assert.equal(queue.shellInjected, true)

    // a second request is a no-op
    addon.sent.length = 0
    queue.enqueueShellIntegration(true)
    await tick()
    assert.deepEqual(addon.sent, ['\r'])
  })

  test('scripts still run when the injection never gets initial data', async () => {
    const { queue, addon } = await makeQueue({
      sftpPathFollowSsh: true,
      holdInitialData: true,
      runScripts: [{ script: 'ls', delay: 0 }]
    })

    queue.runInitScript()
    await tick()

    // nothing typed yet: the injection is waiting for the first output
    assert.deepEqual(addon.sent, [])

    // simulate the connection dying
    addon.disposed = true
    addon.pendingInitialData && addon.pendingInitialData()
    await tick()

    assert.deepEqual(addon.sent, ['ls\r'])
  })

  test('dispose stops a pending queue', async () => {
    const { queue, addon } = await makeQueue({
      runScripts: [{ script: 'one', delay: 0 }, { script: 'two', delay: 0 }]
    })
    let release = null
    addon.waitForOutputIdle = () => new Promise(resolve => {
      release = resolve
    })
    queue.runInitScript()

    await tick(5)
    assert.deepEqual(addon.sent, ['one\r'])

    queue.dispose()
    release(true)
    await tick(30)

    // 'two' must never be typed after dispose
    assert.deepEqual(addon.sent, ['one\r'])
    assert.equal(queue.running, false)
  })
})
