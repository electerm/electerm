const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { TerminalBase } = require('../../app/server/session-base')

// Writes each chunk through the session log and returns the log file as it
// is, blank lines included. session-server.js hands the log whatever arrived
// in one flush, so a line ending can be split between two chunks.
async function logText (chunks, addTimeStamp = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-log-crlf-'))
  const file = path.join(dir, 'session.log')
  const term = new TerminalBase({ cols: 80, rows: 24, logName: 'crlf', sessionLogPath: dir })
  try {
    term.startTerminalLogFile(file, addTimeStamp)
    for (const chunk of chunks) {
      term.writeLog(chunk)
    }
    // xterm parses writes asynchronously; an empty write calls back after them
    await new Promise(resolve => term._vtTerm.write('', resolve))
    await new Promise(resolve => term.sessionLogger.stream.end(resolve))
    return fs.readFileSync(file, 'utf8')
  } finally {
    term._vtTerm.dispose()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('logs one line end for a \\r\\n split between two chunks', async () => {
  assert.equal(await logText([Buffer.from('a\r'), Buffer.from('\nb\r\n')]), 'a\nb\n')
  assert.equal(await logText(['a\r', '\nb\r\n']), 'a\nb\n')
})

test('logs one line end for \\r\\r\\n', async () => {
  // a program that writes \r\n to a tty with onlcr set
  assert.equal(await logText([Buffer.from('a\r\r\nb\r\r\n')]), 'a\nb\n')
  assert.equal(await logText([Buffer.from('a\r'), Buffer.from('\r\nb\r\n')]), 'a\nb\n')
  assert.equal(
    await logText([Buffer.from('a\r'), Buffer.from('\r'), Buffer.from('\nb\r\n')]),
    'a\nb\n'
  )
})

test('keeps a blank line that is in the output', async () => {
  assert.equal(await logText([Buffer.from('a\r\n\r\nb\r\n')]), 'a\n\nb\n')
  assert.equal(await logText([Buffer.from('a\r'), Buffer.from('\n\r\nb\r\n')]), 'a\n\nb\n')
  assert.equal(
    await logText([Buffer.from('a\r'), Buffer.from('\n'), Buffer.from('\nb\r\n')]),
    'a\n\nb\n'
  )
})

test('logs a line ended by a bare \\r without waiting for the next chunk', async () => {
  assert.equal(await logText([Buffer.from('boot ok\r')]), 'boot ok\n')
})

test('writes no timestamp-only line for a split \\r\\n', async () => {
  const lines = (await logText([Buffer.from('a\r'), Buffer.from('\nb\r\n')], true))
    .split('\n')
  assert.equal(lines.length, 3)
  assert.match(lines[0], /^\[.+\] a$/)
  assert.match(lines[1], /^\[.+\] b$/)
  assert.equal(lines[2], '')
})
