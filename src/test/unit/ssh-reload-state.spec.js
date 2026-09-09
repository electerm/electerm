const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const loadModule = () => import('../../client/components/terminal/ssh-reload-state.js')

describe('SSH reload state', () => {
  test('is enabled only for SSH tabs when the setting is on', async () => {
    const { shouldCaptureSshReloadState } = await loadModule()
    const enabled = { restoreTerminalSessionOnReload: true }

    assert.equal(shouldCaptureSshReloadState({ host: 'server', type: 'ssh' }, enabled), true)
    assert.equal(shouldCaptureSshReloadState({ host: 'server' }, enabled), true)
    assert.equal(shouldCaptureSshReloadState({ type: 'local' }, enabled), false)
    assert.equal(shouldCaptureSshReloadState({ host: 'server', type: 'telnet' }, enabled), false)
    assert.equal(shouldCaptureSshReloadState({ host: 'server', type: 'ssh' }, {}), false)
  })

  test('quotes remote directories without allowing command injection', async () => {
    const { createRestoreCwdCommand } = await loadModule()

    assert.equal(
      createRestoreCwdCommand("/tmp/a b/'quoted';$(touch nope)"),
      "cd -- '/tmp/a b/'\"'\"'quoted'\"'\"';$(touch nope)'"
    )
    assert.equal(createRestoreCwdCommand('/tmp/bad\nwhoami'), '')
    assert.equal(createRestoreCwdCommand(''), '')
  })

  test('keeps CWD and serialized screen together as one-shot state', async () => {
    const { createSshReloadState } = await loadModule()
    const state = createSshReloadState({
      cwd: '/srv/app',
      screen: '\u001b[31merror\u001b[0m'
    })

    assert.deepEqual(state, {
      cwd: '/srv/app',
      screen: '\u001b[31merror\u001b[0m'
    })
    assert.equal(createSshReloadState(), undefined)
  })

  test('xterm serialized screen can be restored into a new terminal', async () => {
    const { Terminal } = (await import('@xterm/headless')).default
    const { SerializeAddon } = await import('@xterm/addon-serialize')
    const source = new Terminal({ cols: 40, rows: 5, scrollback: 20 })
    const serializer = new SerializeAddon()
    source.loadAddon(serializer)
    await new Promise(resolve => source.write('\u001b[31mred output\u001b[0m\r\nlast line', resolve))

    const screen = serializer.serialize({
      scrollback: 20,
      excludeAltBuffer: true,
      excludeModes: true
    })
    const restored = new Terminal({ cols: 40, rows: 5, scrollback: 20 })
    await new Promise(resolve => restored.write(screen, resolve))

    assert.equal(restored.buffer.active.getLine(0).translateToString(true), 'red output')
    assert.equal(restored.buffer.active.getLine(1).translateToString(true), 'last line')
    source.dispose()
    restored.dispose()
  })

  test('captures visible alternate-buffer text without restoring its modes', async () => {
    const { getAlternateBufferSnapshot } = await loadModule()
    const { Terminal } = (await import('@xterm/headless')).default
    const terminal = new Terminal({ cols: 40, rows: 5 })
    await new Promise(resolve => terminal.write(
      '\u001b[?1049hfull-screen content',
      resolve
    ))

    assert.equal(
      getAlternateBufferSnapshot(terminal.buffer.active),
      'full-screen content'
    )
    terminal.dispose()
  })
})
