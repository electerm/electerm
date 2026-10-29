const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const { normalizeExitStatus } = require('../../app/common/exit-status.js')

describe('normalize exit status', () => {
  test('ssh2 and node-pty both report positional (code, signal)', () => {
    // ssh2: channel.on('exit', (code, signal, coreDumped, msg))
    assert.deepEqual(
      normalizeExitStatus(0, undefined, false, ''),
      { known: true, code: 0, signal: null }
    )
    // node-pty: term.on('exit', (code, signal))
    assert.deepEqual(
      normalizeExitStatus(130, 'SIGINT'),
      { known: true, code: 130, signal: 'SIGINT' }
    )
  })

  test('a missing status stays unknown instead of becoming 0', () => {
    // Network drop / server reboot: ssh2 closes the channel without an
    // exit-status, which must never be read as a clean exit (#4629).
    for (const args of [[], [null], [undefined, null], [null, 'SIGHUP']]) {
      const result = normalizeExitStatus(...args)
      assert.equal(result.known, false, `args: ${JSON.stringify(args)}`)
      assert.equal(result.code, null)
    }
    assert.deepEqual(normalizeExitStatus(null, 'SIGHUP'),
      { known: false, code: null, signal: 'SIGHUP' })
  })

  test('tolerates the object form', () => {
    assert.deepEqual(
      normalizeExitStatus({ exitCode: 0, signal: undefined }),
      { known: true, code: 0, signal: null }
    )
    assert.deepEqual(
      normalizeExitStatus({ exitCode: undefined, signal: 'SIGTERM' }),
      { known: false, code: null, signal: 'SIGTERM' }
    )
  })

  test('non-numeric codes are not a status', () => {
    assert.equal(normalizeExitStatus('0').known, false)
    assert.equal(normalizeExitStatus(NaN).known, false)
    assert.equal(normalizeExitStatus(Infinity).known, false)
  })
})
