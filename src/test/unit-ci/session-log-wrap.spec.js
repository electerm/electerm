const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { TerminalBase } = require('../../app/server/session-base')

// Writes terminal output through the session log of a terminal that is
// `cols` wide and returns the lines that end up in the log file.
async function logLines (cols, output, addTimeStamp = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-log-wrap-'))
  const file = path.join(dir, 'session.log')
  const term = new TerminalBase({ cols, rows: 24, logName: 'wrap', sessionLogPath: dir })
  try {
    term.startTerminalLogFile(file, addTimeStamp)
    term.writeLog(output)
    // xterm parses writes asynchronously; an empty write calls back after them
    await new Promise(resolve => term._vtTerm.write('', resolve))
    await new Promise(resolve => term.sessionLogger.stream.end(resolve))
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
  } finally {
    term._vtTerm.dispose()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('logs a line wider than the terminal in full, not only its last row', async () => {
  // the mpstat output from #4496: 88 characters in an 80 column terminal
  const header = '00:01:41     CPU    %usr   %nice    %sys %iowait    %irq   %soft  %steal  %guest   %idle'
  const row = '00:01:42     all    0.00    0.00    0.00    0.00    0.00    0.00    0.00    0.00  100.00'
  const lines = await logLines(80, Buffer.from(`mpstat -P ALL 1\r\n${header}\r\n${row}\r\n`))
  assert.deepEqual(lines, ['mpstat -P ALL 1', header, row])
})

test('joins every row of a line that wraps more than once', async () => {
  const long = 'x'.repeat(250)
  assert.deepEqual(await logLines(80, `${long}\r\nnext\r\n`), [long, 'next'])
})

test('keeps a space at the wrap point and drops the gap left by a wide character', async () => {
  // the space is the last cell of the first row
  assert.deepEqual(await logLines(10, 'hello wor ld\r\n'), ['hello wor ld'])
  assert.deepEqual(await logLines(10, 'abcdefghi世界xyz\r\n'), ['abcdefghi世界xyz'])
})

test('writes one timestamp for a wrapped line', async () => {
  const long = 'y'.repeat(100)
  const lines = await logLines(40, `${long}\r\n`, true)
  assert.equal(lines.length, 1)
  assert.match(lines[0], new RegExp(`^\\[.+\\] ${long}$`))
})
