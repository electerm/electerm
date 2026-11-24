const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { EventEmitter } = require('node:events')

test('a disconnected shell retains scrollback without enabling history replay for ordinary duplicate tabs', async () => {
  const { shouldCaptureTerminalReloadState } = await import('../../client/components/terminal/ssh-reload-state.js')
  const config = { restoreTerminalSessionOnReload: false }
  for (const type of ['local', 'ssh']) {
    assert.equal(shouldCaptureTerminalReloadState({ type }, config, true), true)
    assert.equal(shouldCaptureTerminalReloadState({ type }, config), false)
  }
  assert.equal(shouldCaptureTerminalReloadState({ type: 'sftp' }, config, true), false)
})

test('portable SSH host trust stays inside the selected data directory', () => {
  const { getKnownHostsPath } = require('../../app/server/ssh-known-hosts')
  const original = process.env.DATA_PATH
  try {
    process.env.DATA_PATH = path.join(__dirname, 'portable-data')
    assert.equal(getKnownHostsPath(), path.join(process.env.DATA_PATH, '.ssh', 'known_hosts'))
  } finally {
    if (original === undefined) delete process.env.DATA_PATH
    else process.env.DATA_PATH = original
  }
})

test('a replaced session exiting cannot unregister the new session', async () => {
  const children = []
  const exports = {}
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../app/server/session-process.js'), 'utf8'), {
    exports,
    __dirname,
    console,
    setTimeout,
    clearTimeout,
    process: { env: {}, cwd: () => __dirname, on: () => {} },
    require: name => {
      if (name === 'path') return path
      if (name === '../common/log') return { warn: () => {} }
      if (name === '../lib/free-port') return { getFreePort: async ({ from }) => from }
      if (name === 'child_process') {
        return {
          fork: () => {
            const child = new EventEmitter()
            child.connected = true
            child.kill = () => {}
            child.send = ({ data }) => queueMicrotask(() => child.emit('message', { id: data.id, data: 'ok' }))
            children.push(child)
            queueMicrotask(() => child.emit('message', { serverInited: true }))
            return child
          }
        }
      }
      throw new Error(name)
    }
  })
  const opts = { uid: 'same-tab', type: 'local' }
  await exports.terminal(opts, {}, 'first')
  await exports.terminal(opts, {}, 'replacement')
  children[0].emit('exit', 0)
  const proxy = exports.terminals('same-tab')
  assert.equal(await proxy.runCmd('pwd', 'request'), 'ok')
  children[1].emit('exit', 0)
  await assert.rejects(() => proxy.runCmd('pwd', 'missing'), /not found/)
})

test('directory tracking accepts an initial prompt received before waiting', async () => {
  global.window = { et: {}, store: {} }
  const { StartupQueue } = await import('../../client/components/terminal/startup-queue.js')
  const lastOutput = Date.now() - 2000
  const addon = {
    hasReceivedInitialData: true,
    getLastOutputTime: () => lastOutput
  }
  const queue = new StartupQueue({ attachAddon: addon })
  assert.equal(await queue.waitForFirstPrompt(addon, { quietMs: 20, timeoutMs: 400 }), true)
  addon.hasReceivedInitialData = false
  assert.equal(await queue.waitForFirstPrompt(addon, { quietMs: 20, timeoutMs: 200 }), false)
  queue.dispose()
})
