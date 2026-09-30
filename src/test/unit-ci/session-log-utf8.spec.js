const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { TerminalBase } = require('../../app/server/session-base')

// Writes each chunk through the session log and returns the lines that end
// up in the log file. session-server.js hands the log a Buffer per flush.
async function logLines (chunks, addTimeStamp = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-log-utf8-'))
  const file = path.join(dir, 'session.log')
  const term = new TerminalBase({ cols: 80, rows: 24, logName: 'utf8', sessionLogPath: dir })
  try {
    term.startTerminalLogFile(file, addTimeStamp)
    for (const chunk of chunks) {
      term.writeLog(chunk)
    }
    // xterm parses writes asynchronously; an empty write calls back after them
    await new Promise(resolve => term._vtTerm.write('', resolve))
    await new Promise(resolve => term.sessionLogger.stream.end(resolve))
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
  } finally {
    term._vtTerm.dispose()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('logs non-ASCII output that arrives as a Buffer', async () => {
  const output = Buffer.from('中文 ok\r\ncafé naïve\r\nこんにちは ✓\r\n')
  assert.deepEqual(await logLines([output]), ['中文 ok', 'café naïve', 'こんにちは ✓'])
})

test('logs a character whose bytes are split across two Buffers', async () => {
  const output = Buffer.from('中文 ok\r\n')
  // 4 is inside the three bytes of 文
  assert.deepEqual(
    await logLines([output.subarray(0, 4), output.subarray(4)]),
    ['中文 ok']
  )
})

test('still ends a line at a bare carriage return in Buffer output', async () => {
  const lines = await logLines([Buffer.from('boot ok\rlink up\r')], true)
  assert.equal(lines.length, 2)
  assert.match(lines[0], /^\[.+\] boot ok$/)
  assert.match(lines[1], /^\[.+\] link up$/)
})
