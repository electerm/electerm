/**
 * The .vv path a WINDOWS user takes: double-clicking console.vv while
 * electerm is already running.
 *
 * Windows has no 'open-file' event. The file association starts a second
 * process whose argv carries the path, and that process forwards it to the
 * running one. Which mechanism carries it depends on which single-instance
 * path won:
 *
 *   - socket based (src/app/lib/single-instance.js) -- used when
 *     allowMultiInstance is false, the default
 *   - Electron's own 'second-instance' event (src/app/lib/create-app.js)
 *
 * Both must forward the file. The second one used to only restore/focus the
 * window, so the .vv was silently dropped and the user saw the app come to
 * the front and do nothing -- reported as ".vv does not work" on Win11.
 *
 * These tests pin the argv handling itself plus the dispatch decision, so a
 * refactor of either branch cannot quietly drop the file again.
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')

function getVvFile () {
  return require(path.join(ROOT, 'src/app/common/vv-file.js'))
}

describe('second instance .vv dispatch', () => {
  it('finds the .vv in a Windows second-instance command line', () => {
    const { findVvFile } = getVvFile()
    // what electron hands to 'second-instance': argv of the NEW process
    assert.strictEqual(
      findVvFile(['C:\\Program Files\\electerm\\electerm.exe', 'C:\\tmp\\console.vv']),
      path.resolve('C:\\tmp\\console.vv')
    )
  })

  it('still returns null when the second instance carries no .vv', () => {
    const { findVvFile } = getVvFile()
    // an ordinary `electerm user@host` second instance must not be hijacked
    assert.strictEqual(findVvFile(['electerm.exe', 'root@example.com']), null)
  })

  it('create-app forwards a .vv from second-instance to the renderer', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/app/lib/create-app.js'),
      'utf8'
    )
    const body = src.slice(src.indexOf("app.on('second-instance'"))

    // the handler must consult findVvFile, not just focus the window
    assert.match(
      body,
      /findVvFile\(commandLine\)/,
      'second-instance must scan its command line for a .vv'
    )
    assert.match(
      body,
      /openVvFileFromOs\(/,
      'second-instance must hand the .vv to the renderer, not drop it'
    )
    // and it must import both, or the calls above cannot resolve
    assert.match(src, /require\('\.\/vv-file-open'\)/)
    assert.match(src, /require\('\.\.\/common\/vv-file'\)/)
  })

  it('the socket path and the event path both reach the same entry point', () => {
    const single = fs.readFileSync(
      path.join(ROOT, 'src/app/lib/single-instance.js'),
      'utf8'
    )
    // the socket branch already forwarded this; the event branch must match it
    assert.match(
      single,
      /add-tab-from-command-line/,
      'the socket single-instance path must forward the payload to the renderer'
    )
    const vvOpen = fs.readFileSync(
      path.join(ROOT, 'src/app/lib/vv-file-open.js'),
      'utf8'
    )
    assert.match(
      vvOpen,
      /add-tab-from-command-line/,
      'openVvFileFromOs must use the payload shape the renderer understands'
    )
  })
})
