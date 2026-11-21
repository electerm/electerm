/**
 * Unit tests for the server-side trzsz handler (src/app/server/trzsz.js)
 *
 * The TrzszSession is driven end-to-end against a real trzsz2 TrzszTransfer
 * acting as the remote peer, wired back-to-back over an in-memory "wire"
 * (the wire copies, exactly like a pty or a socket does). The peer speaks
 * the real protocol (ACT/CFG/NUM/NAME/SIZE/DATA/MD5), so the tests exercise
 * the actual state machines rather than mocks of them.
 *
 * The download tests exist because of a silent-corruption bug: in binary
 * mode (tsz -b) the remote announces `binary: true, escape_chars: []`, and
 * then the chain
 *
 *   TrzszBuffer.readBinary() -> view over the *reusable* this.arrBuf
 *   unescapeData(data, [])   -> returns that view unchanged
 *   FileWriter.writeFile()   -> hands the view to fs.WriteStream.write()
 *
 * means the very next protocol read (the next `#DATA:<len>\n` header, or the
 * trailing `#MD5:` line) writes into arrBuf offset 0 while the previous
 * chunk is still queued for disk, so the file on disk ends up with header
 * text spliced into it. The MD5 handshake still passes, because trzsz2 hashes
 * the view before the next read mutates it. Hence: "download says complete,
 * file is corrupt".
 */

process.env.NODE_ENV = 'development'

const { test, describe, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { TrzszTransfer } = require('trzsz2')

const { TrzszSession } = require('../../../src/app/server/trzsz')

// ─── wire harness ───────────────────────────────────────────────────────────

// ::TRZSZ:TRANSFER:<direction>:<version>:<unique id>:<port>
// 'S' (0x53) = receive, 'R' (0x52) = send
const TRZSZ_RECEIVE_MAGIC = Buffer.from('::TRZSZ:TRANSFER:S:1.1.7:testunique:34567\r\n')

/**
 * The wire copies bytes, like a pty read or a socket write does. That copy
 * is what makes the receiver-side aliasing bug reachable: the socket is not
 * the thing that pins the buffer, the pending fs write is.
 */
function toU8 (data) {
  if (typeof data === 'string') return Buffer.from(data, 'latin1')
  return Buffer.from(data)
}

/**
 * Connect a real TrzszSession (receiver role) to a real TrzszTransfer
 * (sender role) over an in-memory wire.
 *
 *   session.term.write  ->  peer.buffer   (our protocol replies)
 *   peer.writer         ->  session.handleData (remote protocol messages)
 */
function makePair () {
  const events = []
  const holder = { peer: null }
  const term = {
    write: (data) => holder.peer.addReceivedData(toU8(data))
  }
  const ws = {
    s: (msg) => events.push(msg),
    send: () => {}
  }
  const session = new TrzszSession(term, ws)
  const peer = new TrzszTransfer(
    (data) => session.handleData(toU8(data)),
    false
  )
  holder.peer = peer
  return { session, peer, events }
}

/**
 * A stand-in for the remote's file source. Allocates a fresh buffer on every
 * read on purpose: the peer must not alias its own source, otherwise a
 * sender-side aliasing bug would be confused with the receiver-side one
 * these tests are about.
 */
function makeRemoteReader (name, data) {
  let offset = 0
  return {
    getRelPath: () => [name],
    getPathId: () => 0,
    isDir: () => false,
    getSize: () => data.length,
    readFile: async (buffer) => {
      const size = Math.min(buffer.byteLength, data.length - offset)
      const out = new Uint8Array(size)
      out.set(data.subarray(offset, offset + size))
      offset += size
      return out
    },
    closeFile: async () => {}
  }
}

/**
 * Deterministic, printable payload (0x20..0x7e) so a failure diff is
 * readable and so stray control bytes never confuse the protocol framing.
 */
function makePattern (size) {
  const buf = Buffer.allocUnsafe(size)
  for (let i = 0; i < size; i++) {
    buf[i] = 0x20 + (i % 0x5f)
  }
  return buf
}

/** Wait until `cond()` is true, or fail loudly. */
async function waitFor (cond, label, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (cond()) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`timed out waiting for ${label}`)
}

/**
 * Byte comparison with a compact, useful failure message: how many bytes
 * differ, where the first one is, and what is actually on disk there.
 */
function assertByteExact (actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: size mismatch`)
  let count = 0
  let first = -1
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      if (first < 0) first = i
      count++
    }
  }
  if (first < 0) return
  const around = actual.subarray(first, first + 24).toString('latin1')
  assert.fail(
    `${label}: ${count} of ${actual.length} bytes differ; ` +
    `first at offset ${first}, got ${JSON.stringify(around)}`
  )
}

/**
 * Drive the remote sender: consume our ACT, announce the transfer config,
 * then push one file.
 */
async function runPeer (peer, reader, config) {
  await peer.recvAction()
  await peer.sendConfig(config, [], undefined, 0)
  return peer.sendFiles([reader])
}

/** Receive one file and return the bytes that landed on disk. */
async function receiveFile (session, peer, events, { name, src, config }) {
  const dest = path.join(tmpDir, name)
  session.setSavePath(tmpDir)
  const done = runPeer(peer, makeRemoteReader(name, src), config)
  session.handleData(TRZSZ_RECEIVE_MAGIC)
  await done
  // The real remote prints "Success" once it has saved the file; that text is
  // what makes the session deliver session-complete and tear itself down.
  await waitFor(() => session._pendingComplete !== null, 'pending completion')
  session.handleData(Buffer.from('Success'))
  assert.ok(events.some((e) => e.event === 'session-complete'), 'session-complete')
  return fs.readFileSync(dest)
}

// ─── environment ────────────────────────────────────────────────────────────

let tmpDir

describe('trzsz session', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trzsz-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('cancelling the save dialog ends the waiting receiver once', async () => {
    const { session, peer, events } = makePair()
    session.handleData(TRZSZ_RECEIVE_MAGIC)
    await peer.recvAction()
    await peer.sendConfig({}, [], undefined, 0)
    await waitFor(() => session._savePathResolve, 'save dialog')
    await session.cancel()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(session._savePathResolve, null)
    assert.equal(events.filter(e => e.event === 'session-end').length, 1)
    assert.ok(!events.some(e => e.event === 'session-error'))
    session.destroy()
  })

  test('uploads negotiated chunks including status-like binary payloads', async () => {
    const { session, peer } = makePair()
    const src = Buffer.concat([makePattern(4096), Buffer.from('Saved file')])
    const sourcePath = path.join(tmpDir, 'upload.bin')
    fs.writeFileSync(sourcePath, src)
    session.setSendFiles([sourcePath])
    for (const byte of Buffer.from('::TRZSZGO:TRANSFER:R:1.0.0:test\r\n')) {
      session.handleData(Buffer.from([byte]))
    }
    await peer.recvAction()
    await peer.sendConfig({ binary: true, bufsize: 1024, timeout: 1 }, [], undefined, 0)
    const chunks = []
    await peer.recvFiles(null, async () => ({
      getFileName: () => 'upload.bin',
      getLocalName: () => 'upload.bin',
      isDir: () => false,
      writeFile: async data => chunks.push(Buffer.from(data)),
      closeFile: () => {}
    }))
    await waitFor(() => session._pendingComplete, 'upload completion')
    session.handleData(Buffer.from('Success'))
    assert.deepEqual(chunks.map(chunk => chunk.length), [1024, 1024, 1024, 1024, 10])
    assert.deepEqual(Buffer.concat(chunks), src)
  })

  describe('download', () => {
    test('binary mode (tsz -b, empty escape_chars) writes a byte-exact file', async () => {
      const { session, peer, events } = makePair()
      // bufsize small so the sender's chunk size stops growing quickly, which
      // is the regime a real multi-MB download spends all its time in: the
      // sender reuses one buffer, and so does TrzszBuffer.arrBuf.
      const config = { binary: true, overwrite: true, bufsize: 4096, timeout: 5 }
      const src = makePattern(64 * 1024)
      const actual = await receiveFile(session, peer, events, {
        name: 'payload.bin',
        src,
        config
      })
      assertByteExact(actual, src, 'binary-mode download')
    })

    test('creates empty files and reports actual paths once for a batch', async () => {
      fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'existing')
      const { session, peer, events } = makePair()
      session.setSavePath(tmpDir)
      session.handleData(TRZSZ_RECEIVE_MAGIC)
      await peer.recvAction()
      await peer.sendConfig({ binary: true, timeout: 1 }, [], undefined, 0)
      await peer.sendFiles([
        makeRemoteReader('a.txt', Buffer.from('abc')),
        makeRemoteReader('empty', Buffer.alloc(0))
      ])
      await waitFor(() => session._pendingComplete, 'pending completion')
      session.handleData(Buffer.from('Saved file'))
      const summary = events.find(e => e.event === 'session-complete')
      assert.equal(summary.totalBytes, 3)
      assert.deepEqual(summary.files, ['a.1.txt', 'empty'].map(name => path.join(tmpDir, name)))
      assert.deepEqual(summary.completedFiles.map(f => f.path), summary.files)
      assert.equal(fs.readFileSync(summary.files[0], 'utf8'), 'abc')
      assert.equal(fs.statSync(summary.files[1]).size, 0)
      assert.equal(fs.readFileSync(path.join(tmpDir, 'a.txt'), 'utf8'), 'existing')
      for (const event of ['file-start', 'file-complete']) {
        assert.deepEqual(events.filter(e => e.event === event).map(e => e.name), ['a.txt', 'empty'])
      }
    })

    test('base64 mode writes a byte-exact file', async () => {
      const { session, peer, events } = makePair()
      const config = { overwrite: true, bufsize: 4096, timeout: 5 }
      const src = makePattern(64 * 1024)
      const actual = await receiveFile(session, peer, events, {
        name: 'payload.txt',
        src,
        config
      })
      assertByteExact(actual, src, 'base64-mode download')
    })

    test('binary mode survives a payload full of protocol-looking bytes', async () => {
      const { session, peer, events } = makePair()
      const config = { binary: true, overwrite: true, bufsize: 4096, timeout: 5 }
      // '#DATA:2048\n' repeated: in binary mode with no escape chars this is
      // just payload, and it must come out the other end untouched.
      const src = Buffer.from('#DATA:2048\n'.repeat(6000))
      const actual = await receiveFile(session, peer, events, {
        name: 'tricky.bin',
        src,
        config
      })
      assertByteExact(actual, src, 'binary-mode download (protocol-like payload)')
    })
  })
})
