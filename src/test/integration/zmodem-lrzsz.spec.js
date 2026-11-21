// Linux integration test. Install lrzsz and run with node --test.
process.env.NODE_ENV = 'development'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const { session } = require('../../app/server/session-local')
const { ZmodemSession } = require('../../app/server/zmodem')

for (const direction of ['download', 'upload']) {
  test(`lrzsz ${direction} over the local PTY with an 8 MiB mixed batch`, {
    skip: process.platform !== 'linux',
    timeout: 60000
  }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zmodem-pty-'))
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))
    const dest = path.join(root, 'out')
    fs.mkdirSync(dest)
    const files = ['empty', 'data.bin', 'last-empty'].map(name => {
      const content = name === 'data.bin' ? randomBytes(8 * 1024 * 1024) : Buffer.alloc(0)
      const source = path.join(root, name)
      fs.writeFileSync(source, content)
      return { name, path: source, size: content.length }
    })
    const download = direction === 'download'
    const term = await session({
      execLinux: '/bin/sh',
      execLinuxArgs: ['-c', download ? 'exec sz -b empty data.bin last-empty 2>peer.log' : 'exec rz -b 2>peer.log'],
      startDirectoryLocal: download ? root : dest
    })
    const pause = t.mock.method(term.term, 'pause')
    const resume = t.mock.method(term.term, 'resume')
    const events = []
    const transfer = new ZmodemSession(term, {
      s (msg) {
        events.push(msg)
        if (msg.event === 'receive-start') setImmediate(() => transfer.setSavePath(dest))
        if (msg.event === 'send-start') setImmediate(() => transfer.setSendFiles(files))
      }
    })
    t.after(() => {
      transfer.destroy()
      term.kill()
    })
    const exit = new Promise(resolve => term.on('exit', resolve))
    term.on('data', data => transfer.handleData(data))
    assert.equal(await exit, 0, JSON.stringify(events))
    assert.equal(events.at(-1)?.event, 'session-end')
    assert.deepEqual(events.filter(e => e.event === 'file-complete').map(e => e.name), files.map(f => f.name))
    if (download) {
      assert.ok(pause.mock.callCount() > 0)
      assert.equal(resume.mock.callCount(), pause.mock.callCount())
    }
    for (const file of files) {
      assert.ok(fs.readFileSync(file.path).equals(fs.readFileSync(path.join(dest, file.name))), file.name)
    }
  })
}
