const { describe, test } = require('node:test')
const assert = require('node:assert/strict')
const {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync
} = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

const SessionLog = require('../../app/server/session-log.js')

function tmpDir () {
  return mkdtempSync(join(tmpdir(), 'electerm-session-log-'))
}

// Stream writes land on the next ticks; polling keeps the assertions about the
// file itself instead of about the stream internals.
async function waitFor (fn, timeout = 1000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = fn()
    if (value) {
      return value
    }
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  return fn()
}

describe('session log', () => {
  test('creates a nested log dir and writes to it', async () => {
    const root = tmpDir()
    // the parent chain does not exist: a path carried over from another
    // computer looks like this (#4688)
    const logDir = join(root, 'a', 'b', 'electerm')
    const logger = new SessionLog({ logDir, fileName: 't.log' })
    try {
      assert.equal(logger.ready, true)
      assert.equal(logger.error, null)
      logger.write('hello\n')
      const content = await waitFor(() => {
        const file = join(logDir, 't.log')
        return existsSync(file) ? readFileSync(file, 'utf8') : ''
      })
      assert.equal(content, 'hello\n')
    } finally {
      logger.destroy()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('an unusable log path keeps the session alive', async () => {
    const root = tmpDir()
    // logDir points *inside* a regular file, so neither mkdir nor open can work
    const blocked = join(root, 'blocked')
    writeFileSync(blocked, '')
    const logDir = join(blocked, 'electerm')
    let thrown = null
    const onUncaught = (e) => {
      thrown = e
    }
    process.on('uncaughtException', onUncaught)
    try {
      const logger = new SessionLog({ logDir, fileName: 't.log' })
      assert.equal(logger.ready, false)
      assert.ok(logger.error)
      // must not throw, and must not let the stream's 'error' escape: the
      // session server treats an uncaught exception as fatal to the session
      assert.doesNotThrow(() => logger.write('hello\n'))
      logger.destroy()
      assert.doesNotThrow(() => logger.destroy())
      await new Promise(resolve => setTimeout(resolve, 100))
      assert.equal(thrown, null)
    } finally {
      process.off('uncaughtException', onUncaught)
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('writes keep appending across a reopen', async () => {
    const root = tmpDir()
    const file = 't.log'
    const first = new SessionLog({ logDir: root, fileName: file })
    first.write('one\n')
    assert.equal(
      await waitFor(() => existsSync(join(root, file)) && readFileSync(join(root, file), 'utf8')),
      'one\n'
    )
    first.destroy()
    const second = new SessionLog({ logDir: root, fileName: file })
    second.write('two\n')
    try {
      const content = await waitFor(() => {
        const text = readFileSync(join(root, file), 'utf8')
        return text.endsWith('two\n') ? text : ''
      })
      assert.equal(content, 'one\ntwo\n')
    } finally {
      second.destroy()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
