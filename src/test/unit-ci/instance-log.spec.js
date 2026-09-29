const { test } = require('node:test')
const assert = require('node:assert/strict')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')

const widgetLog = require('../../app/widgets/instance-log')

function tmpDir () {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-widget-log-'))
}

function read (file) {
  return fs.readFileSync(file, 'utf8')
}

function lines (file) {
  return read(file).split('\n').filter(Boolean)
}

test('writes log and connection entries to <dir>/<instanceId>.log', () => {
  const dir = tmpDir()
  try {
    widgetLog.setLogDir(dir)
    const file = widgetLog.logFilePath('inst-1')
    assert.equal(file, path.join(dir, 'inst-1.log'))

    const logger = widgetLog.loggerFor('inst-1')
    logger.log('info', 'server started')
    logger.log('error', 'boom', { code: 'EADDRINUSE' })
    logger.event({
      type: 'login',
      ok: true,
      from: '10.200.101.50',
      msg: 'user ftpuser accepted'
    })
    logger.event({
      type: 'login',
      ok: false,
      from: '10.200.101.50',
      msg: 'user bad rejected'
    })
    logger.event({ type: 'disconnect', msg: 'control connection closed' })

    const all = lines(file)
    assert.equal(all.length, 5)
    assert.match(all[0], /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\|log\|info\|server started$/)
    // extra arguments are joined, objects included
    assert.match(all[1], /\|log\|error\|boom \{"code":"EADDRINUSE"\}$/)
    assert.match(
      all[2],
      /\|conn\|ok\|login\|10\.200\.101\.50\|user ftpuser accepted$/
    )
    assert.match(
      all[3],
      /\|conn\|fail\|login\|10\.200\.101\.50\|user bad rejected$/
    )
    // unknown ok state reads as info, missing `from` as '-'
    assert.match(all[4], /\|conn\|info\|disconnect\|-\|control connection closed$/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('log(level, ...) and log(message) both work', () => {
  const dir = tmpDir()
  try {
    widgetLog.setLogDir(dir)
    const logger = widgetLog.loggerFor('levels')
    logger.log('warn', 'a')
    // a bare message is not a level, so it becomes a plain log line
    logger.log('just a message')
    logger.log('debug', 'verbose')
    const all = lines(widgetLog.logFilePath('levels'))
    assert.match(all[0], /\|log\|warn\|a$/)
    assert.match(all[1], /\|log\|log\|just a message$/)
    assert.match(all[2], /\|log\|debug\|verbose$/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('one entry stays one line, and messages may contain separators', async () => {
  const dir = tmpDir()
  try {
    widgetLog.setLogDir(dir)
    const logger = widgetLog.loggerFor('escaping')
    logger.log('error', 'line1\nline2')
    logger.log('log', 'a|b|c')
    logger.event({ type: 'req|uest', msg: 'x|y' })
    const file = widgetLog.logFilePath('escaping')
    const all = lines(file)
    assert.equal(all.length, 3)
    // the newline is escaped, so the entry stays one line
    assert.match(all[0], /\|log\|error\|line1\\nline2$/)
    // a separator in a structured field is neutralised...
    assert.match(all[2], /\|conn\|info\|req\/uest\|-\|x\|y$/)

    const { parseWidgetLog } = await import('../../client/common/parse-widget-log.js')
    const parsed = parseWidgetLog(read(file))
    assert.equal(parsed.logs.length, 2)
    assert.equal(parsed.logs[1].msg, 'a|b|c')
    assert.equal(parsed.events.length, 1)
    assert.equal(parsed.events[0].msg, 'x|y')
    assert.equal(parsed.events[0].ok, null)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('round trip: what the writer writes is what the reader reads', async () => {
  const dir = tmpDir()
  try {
    widgetLog.setLogDir(dir)
    const logger = widgetLog.loggerFor('round')
    logger.log('info', 'Starting Local FTP Server (local-ftp-server)')
    logger.event({
      type: 'connect',
      ok: true,
      from: '10.200.101.50',
      msg: 'control connection opened, 1 active'
    })
    logger.log('error', 'Failed to start: listen EADDRINUSE')
    logger.event({
      type: 'client-error',
      ok: false,
      from: '10.200.101.50',
      msg: 'commandSocket: read ECONNRESET'
    })

    const { parseWidgetLog } = await import('../../client/common/parse-widget-log.js')
    const { logs, events } = parseWidgetLog(read(widgetLog.logFilePath('round')))
    assert.deepEqual(logs.map(l => l.level), ['info', 'error'])
    assert.equal(logs[0].msg, 'Starting Local FTP Server (local-ftp-server)')
    assert.ok(logs.every(l => Number.isFinite(l.ts)))
    assert.deepEqual(events.map(e => e.type), ['connect', 'client-error'])
    assert.deepEqual(events.map(e => e.ok), [true, false])
    assert.equal(events[1].from, '10.200.101.50')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('the parser ignores junk instead of throwing', async () => {
  const { parseWidgetLog } = await import('../../client/common/parse-widget-log.js')
  const parsed = parseWidgetLog([
    '',
    'not a log line',
    'not-a-date|log|info|hello',
    '2026-09-28T09:00:00.000Z|log|info',
    '2026-09-28T09:00:00.000Z|conn|ok|login',
    '2026-09-28T09:00:00.000Z|log|info|real entry'
  ].join('\n'))
  assert.equal(parsed.logs.length, 1)
  assert.equal(parsed.logs[0].msg, 'real entry')
  assert.equal(parsed.events.length, 0)
})

test('a context logs before it knows its instance id', () => {
  const dir = tmpDir()
  try {
    widgetLog.setLogDir(dir)
    const ctx = widgetLog.createContext()
    ctx.log('info', 'logged before bind')
    ctx.event({ type: 'early', ok: true })
    // nothing has an id yet, so nothing may have been written anywhere
    assert.deepEqual(fs.readdirSync(dir), [])
    ctx.bind('ctx-1')
    const all = lines(widgetLog.logFilePath('ctx-1'))
    assert.equal(all.length, 2)
    assert.match(all[0], /\|log\|info\|logged before bind$/)
    assert.match(all[1], /\|conn\|ok\|early\|-\|$/)
    // and it keeps logging against the bound id
    ctx.log('warn', 'after bind')
    assert.equal(lines(widgetLog.logFilePath('ctx-1')).length, 3)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('an oversized log rotates instead of growing forever', () => {
  const dir = tmpDir()
  try {
    widgetLog.setLogDir(dir)
    const logger = widgetLog.loggerFor('big')
    // one message is capped, so it takes several to pass the 1MB threshold
    for (let i = 0; i < 300; i++) {
      logger.log('info', 'x'.repeat(4000))
    }
    logger.log('info', 'after rotation')
    const file = widgetLog.logFilePath('big')
    assert.ok(fs.existsSync(`${file}.1`))
    const kept = lines(file)
    assert.match(kept[kept.length - 1], /after rotation$/)
    assert.ok(kept.length < 300)
    assert.ok(fs.statSync(file).size <= 1024 * 1024)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('an over-long message is capped so one entry cannot swamp the log', () => {
  const dir = tmpDir()
  try {
    widgetLog.setLogDir(dir)
    widgetLog.loggerFor('cap').log('info', 'y'.repeat(10000))
    const all = lines(widgetLog.logFilePath('cap'))
    assert.equal(all.length, 1)
    assert.ok(all[0].length < 4100)
    assert.match(all[0], /y\.\.\.$/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('logs older than the retention window are pruned', () => {
  const dir = tmpDir()
  try {
    widgetLog.setLogDir(dir)
    const stale = path.join(dir, 'stale.log')
    const kept = path.join(dir, 'kept.log')
    fs.writeFileSync(stale, 'old\n')
    fs.writeFileSync(kept, 'new\n')
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    fs.utimesSync(stale, old, old)
    widgetLog.setLogDir(dir)
    assert.equal(fs.existsSync(stale), false)
    assert.equal(fs.existsSync(kept), true)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
