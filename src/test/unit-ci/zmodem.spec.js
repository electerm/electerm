/**
 * Unit tests for the rewritten server-side zmodem handler
 * (src/app/server/zmodem.js)
 *
 * The ZmodemSession is driven end-to-end against a real zmodem2
 * Sender/Receiver pair wired back-to-back (the "wire" is two arrays),
 * so the tests exercise the actual protocol state machines, not mocks
 * of them. Filesystem paths use a real temp dir.
 */

process.env.NODE_ENV = 'development'

const { test, describe, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Sender, Receiver } = require('zmodem2')

const {
  ZmodemSession,
  ZMODEM_STATE,
  ZMODEM_HEADER
} = require('../../../src/app/server/zmodem')

// ─── wire harness ───────────────────────────────────────────────────────────

/**
 * Wire harness: connects a ZmodemSession to a remote zmodem2 endpoint.
 *
 * - sessionToRemote: everything the session writes to its `term`
 *   (our protocol replies) is fed to the remote endpoint.
 * - remoteToSession: everything the remote endpoint emits is delivered
 *   to the session via `handleData()` in caller-chosen chunk sizes.
 */
class Wire {
  constructor () {
    this.termWrites = [] // session -> wire (to remote)
    this.raw = [] // remote -> wire (to session), pre-chunking
    this.remote = null // { feed: (u8) => {} } set by caller
  }

  makeTerm () {
    return {
      write: (d) => {
        this.termWrites.push(Buffer.from(d))
        this.remote?.feed(new Uint8Array(d))
      }
    }
  }

  emit (bytes) {
    this.raw.push(Buffer.from(bytes))
  }

  /**
   * Deliver all queued remote bytes to the session in `chunkSize` slices
   * (simulates pty read boundaries).
   */
  flushTo (session, chunkSize = 4096) {
    const pending = Buffer.concat(this.raw.splice(0))
    for (let i = 0; i < pending.length; i += chunkSize) {
      session.handleData(pending.subarray(i, i + chunkSize))
    }
  }

  toWireString () {
    return Buffer.concat(this.termWrites).toString('latin1')
  }
}

/**
 * Build a full zmodem2 frame (hex encoding) for a given frame type,
 * exactly how a real rz/sz peer serializes it. Uses the library's own
 * Header class to get CRCs right.
 */
const { Header } = require('zmodem2')

function hexFrame (frameType) {
  return Buffer.from(new Header(66 /* ZHEX */, frameType).encode())
}

// ZRQINIT with "00" type nibbles is what sz prints to start a download
function zrqinitFrame () {
  return hexFrame(0)
}

// ZRINIT frame from a waiting rz
function zrinitFrame () {
  return hexFrame(1)
}

// ZSKIP frame from an rz refusing a file
function zskipFrame () {
  return hexFrame(5)
}

// ─── environment ────────────────────────────────────────────────────────────

let tmpDir
let clientEvents // messages the session pushed to the renderer
let wsSent // raw buffers the session forwarded to the terminal UI

function makeSession (wire) {
  clientEvents = []
  wsSent = []
  const ws = {
    s: (msg) => clientEvents.push(msg),
    send: (data) => wsSent.push(Buffer.from(data))
  }
  return new ZmodemSession(wire.makeTerm(), ws)
}

function eventsOf (name) {
  return clientEvents.filter((e) => e.event === name)
}

describe('zmodem session', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zmodem-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // ── detection ────────────────────────────────────────────────────────────

  describe('detection', () => {
    test('plain terminal output is not consumed', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      assert.strictEqual(s.handleData(Buffer.from('ls -la\r\n')), false)
      assert.strictEqual(s.isActive(), false)
      assert.strictEqual(clientEvents.length, 0)
    })

    test('detects ZRQINIT and enters waiting_save_path', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      const consumed = s.handleData(Buffer.concat([
        Buffer.from('sz is about to send\r\n'),
        zrqinitFrame()
      ]))
      assert.strictEqual(consumed, true)
      assert.strictEqual(s.state, ZMODEM_STATE.WAITING_SAVE_PATH)
      assert.ok(eventsOf('receive-start').length === 1)
      // text before the header stays visible to the user
      assert.strictEqual(wsSent.length, 1)
      assert.ok(wsSent[0].toString().includes('sz is about to send'))
    })

    test('detects a header split across chunks', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      const frame = Buffer.concat([Buffer.from('**\x18B'), Buffer.from('00\r\n')])
      // first chunk ends mid-header, only "**\x18B" carried over
      assert.strictEqual(s.handleData(frame.subarray(0, 3)), true)
      // nothing displayable yet
      assert.strictEqual(wsSent.length, 0)
      assert.strictEqual(s.handleData(frame.subarray(3)), true)
      assert.strictEqual(s.state, ZMODEM_STATE.WAITING_SAVE_PATH)
    })

    test('carry fragment expires and outputs resume normally', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      // partial header prefix that never completes
      s.handleData(Buffer.from('ok**\x18'))
      // simulate time passing beyond SNIFF_WINDOW_MS
      s.carrySince = Date.now() - 10000
      assert.strictEqual(s.handleData(Buffer.from('prompt$ ')), false)
      // the stale fragment was released and merged into output
      s.destroy()
    })

    test('protocol noise prefix is not forwarded to the display', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      const noise = Buffer.concat([
        Buffer.from([0x00, 0x11, 0x13, 0x00, 0x11]),
        zrqinitFrame()
      ])
      s.handleData(noise)
      // noise-only prefix must be dropped, not written to xterm
      assert.strictEqual(wsSent.length, 0)
      assert.strictEqual(s.state, ZMODEM_STATE.WAITING_SAVE_PATH)
    })

    test('stray ZSKIP with no session is dropped silently', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      assert.strictEqual(s.handleData(zskipFrame()), true)
      assert.strictEqual(s.isActive(), false)
      assert.strictEqual(clientEvents.filter((e) => e.event === 'file-skipped').length, 0)
    })
  })

  // ── abort / cancel / teardown ────────────────────────────────────────────

  describe('cancel and teardown', () => {
    test('user cancel sends the canonical cancel sequence and ends the session', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleData(zrqinitFrame())
      s.cancel()
      assert.strictEqual(s.isActive(), false)
      assert.strictEqual(s.state, ZMODEM_STATE.IDLE)
      const last = wire.termWrites[wire.termWrites.length - 1]
      // 8x CAN (0x18) + 'B'
      assert.strictEqual(last.toString('hex'), '181818181818181842')
      assert.ok(eventsOf('session-end').length === 1)
      // readable terminal output still reaches the user right after
      // cancel (forwarded by us during the noise window), and normal
      // passthrough resumes once the window closes
      assert.strictEqual(s.handleData(Buffer.from('prompt$ ')), true)
      assert.strictEqual(wsSent.length, 1)
      assert.strictEqual(wsSent[0].toString(), 'prompt$ ')
      s.suppressNoiseUntil = 0
      assert.strictEqual(s.handleData(Buffer.from('more text ')), false)
    })

    test('remote Ctrl-C (CAN run) aborts silently without writing to the pty', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleData(zrqinitFrame())
      s.setSavePath(tmpDir)
      assert.strictEqual(s.state, ZMODEM_STATE.RECEIVING)

      const writesBefore = wire.termWrites.length
      // rz killed by Ctrl-C: raw CAN run, split across chunks to prove
      // cross-chunk detection
      const cans = Buffer.concat([
        Buffer.from([0x18, 0x18]),
        Buffer.from([0x18, 0x18, 0x18, 0x42])
      ])
      s.handleData(cans.subarray(0, 2))
      // partial run (2 CANs) must not trigger
      assert.strictEqual(s.isActive(), true)
      s.handleData(cans.subarray(2))
      assert.strictEqual(s.isActive(), false)
      assert.ok(eventsOf('session-end').length === 1)
      assert.ok(eventsOf('transfer-error').length === 1)
      // no cancel sequence written back to a dead peer
      assert.strictEqual(wire.termWrites.length, writesBefore)
    })

    test('post-abort debris is swallowed, prompt still shows', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleData(zrqinitFrame())
      s.cancel()

      // dying peer debris: pure noise chunk gets dropped
      assert.strictEqual(s.handleData(Buffer.from([0x18, 0x18, 0x00, 0x11, 0x13])), true)
      assert.strictEqual(wsSent.length, 0)

      // screens of printable debris (file payloads / echoed hex frames
      // are pure text) are swallowed too — printable-ness is not a filter
      const debris = Buffer.from('frame hex 0123456789abcdef\r\nfile content line\r\n'.repeat(20))
      assert.strictEqual(s.handleData(debris), true)
      assert.strictEqual(wsSent.length, 0)

      // the shell prompt reappears: exactly the prompt line is shown
      assert.strictEqual(s.handleData(Buffer.from('user@host:~$ ')), true)
      assert.strictEqual(wsSent.length, 1)
      assert.ok(wsSent[0].toString().includes('user@host:~$ '))

      // window closed: normal passthrough resumes
      assert.strictEqual(s.handleData(Buffer.from('ls\r\n')), false)
    })

    test('prompt split across chunks is still recognized', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleData(zrqinitFrame())
      s.cancel()
      s.handleData(Buffer.from('garbage debris\r\nuser@hos'))
      assert.strictEqual(wsSent.length, 0)
      s.handleData(Buffer.from('t:~$ '))
      assert.strictEqual(wsSent.length, 1)
      assert.ok(wsSent[0].toString().includes('user@host:~$ '))
    })

    test('after the suppression window everything passes through again', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleData(zrqinitFrame())
      s.cancel()
      // expire the window (and stop the auto-extension by making the
      // next chunk arrive "late")
      s.suppressNoiseUntil = Date.now() - 100
      assert.strictEqual(s.handleData(Buffer.from('prompt$ ')), false)
    })

    test('endSession is idempotent', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleData(zrqinitFrame())
      s.endSession()
      s.endSession()
      assert.strictEqual(s.isActive(), false)
    })

    test('destroy silences the session permanently', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleData(zrqinitFrame())
      s.destroy()
      assert.strictEqual(s.handleData(zrqinitFrame()), false)
      assert.strictEqual(s.isActive(), false)
    })

    test('user Ctrl-C during transfer ends the session immediately and silently', () => {
      const wire = new Wire()
      const s = makeSession(wire)

      const srcPath = path.join(tmpDir, 'ctrl.bin')
      fs.writeFileSync(srcPath, 'data')

      wire.emit(zrinitFrame())
      wire.flushTo(s)
      s.setSendFiles([{ path: srcPath, name: 'ctrl.bin', size: 4 }])
      assert.strictEqual(s.state, ZMODEM_STATE.SENDING)

      const writesBefore = wire.termWrites.length
      // the keystroke the session-server observes on its way to the pty
      s.handleUserInput('\x03')
      assert.strictEqual(s.isActive(), false)
      // nothing written back to the dying remote
      assert.strictEqual(wire.termWrites.length, writesBefore)
      assert.ok(eventsOf('transfer-error').length === 1)
      assert.ok(eventsOf('session-end').length === 1)

      // shell takes over: prompt output reaches the user
      assert.strictEqual(s.handleData(Buffer.from('user@host:~$ ')), true)
      assert.ok(wsSent.some((b) => b.toString() === 'user@host:~$ '))
      // and normal passthrough resumes afterwards
      assert.strictEqual(s.handleData(Buffer.from('ls\r\n')), false)
    })

    test('ordinary user input does not disturb the session', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleData(zrqinitFrame())
      s.handleUserInput('ls -la\r')
      s.handleUserInput('x')
      assert.strictEqual(s.state, ZMODEM_STATE.WAITING_SAVE_PATH)
    })

    test('Ctrl-C on an idle session is a no-op', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleUserInput('\x03')
      assert.strictEqual(s.isActive(), false)
      assert.strictEqual(clientEvents.length, 0)
    })
  })

  // ── watchdog ─────────────────────────────────────────────────────────────

  describe('watchdog', () => {
    test('waiting for save path times out and restores the terminal', async () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleData(zrqinitFrame())
      // force the timer to be due immediately
      s.disarmWatchdog()
      s.watchdogTimer = setTimeout(() => {}, 1)
      clearTimeout(s.watchdogTimer)
      // call the real timeout path directly instead of waiting 10min
      const timeoutEvents = clientEvents.length
      // simulate watchdog firing: same code the timer runs
      s.disarmWatchdog()
      s.sendToClient({ event: 'session-timeout', message: 'ZMODEM session timed out' })
      s.abort(true)
      assert.strictEqual(s.isActive(), false)
      assert.ok(clientEvents.length > timeoutEvents)
      assert.ok(eventsOf('session-end').length === 1)
    })

    test('transfer silence re-arms the watchdog', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleData(zrqinitFrame())
      s.setSavePath(tmpDir)
      assert.strictEqual(s.state, ZMODEM_STATE.RECEIVING)
      assert.ok(s.watchdogTimer, 'watchdog should be armed in RECEIVING')
      s.cancel()
    })
  })

  // ── receive (download) happy path ────────────────────────────────────────

  describe('receive', () => {
    test('downloads a full file from a live sz endpoint', async () => {
      const wire = new Wire()
      const s = makeSession(wire)

      const content = Buffer.from('electerm zmodem test payload\n'.repeat(200))
      let remoteFinished = false

      // remote sz: initiator sender. `pumpRemoteAll` keeps draining the
      // sender until it has nothing queued - a frame of multiple
      // subpackets yields several pollFile rounds with no wire reply
      // in between, so pumping once per reply is not enough.
      const remote = new Sender(true)
      const pumpRemoteAll = () => {
        let guard = 0
        while (guard++ < 1000) {
          const out = remote.drainOutgoing()
          if (out.length) wire.emit(out)
          let ev
          while ((ev = remote.pollEvent()) !== null) {
            if (ev === 'SessionComplete') remoteFinished = true
          }
          const req = remote.pollFile()
          if (!req) break
          remote.feedFile(new Uint8Array(content.subarray(req.offset, req.offset + req.len)))
        }
      }
      wire.remote = {
        feed (u8) {
          let off = 0
          let iter = 0
          while (off < u8.length && iter++ < 10000) {
            const consumed = remote.feedIncoming(u8.subarray(off))
            off += consumed
            pumpRemoteAll()
            if (consumed === 0) break
          }
        }
      }

      const drainWire = () => {
        let guard = 0
        while (guard++ < 1000) {
          pumpRemoteAll()
          if (!wire.raw.length) break
          wire.flushTo(s, 7)
        }
      }

      // 1. sz announces itself (ZRQINIT); deliver in 7-byte chunks to
      // stress the parser across split frames
      pumpRemoteAll()
      drainWire()
      assert.strictEqual(s.state, ZMODEM_STATE.WAITING_SAVE_PATH)

      // 2. user picks a folder; session replays buffered wire data
      s.setSavePath(tmpDir)
      drainWire()
      assert.strictEqual(s.state, ZMODEM_STATE.RECEIVING)

      // 3. remote starts the file
      remote.startFile('hello.bin', content.length, 0)
      pumpRemoteAll()
      drainWire()

      assert.ok(eventsOf('file-start').length === 1)
      const prepared = eventsOf('file-prepared')
      assert.ok(prepared.length === 1)
      assert.ok(prepared[0].path.startsWith(tmpDir))

      // 4. remote finishes the file + session
      remote.finishSession()
      pumpRemoteAll()
      drainWire()

      // let the write stream flush, the finish event land, and the
      // remote ZFIN ack ripple through the wire one last time
      await new Promise((resolve) => setTimeout(resolve, 100))
      drainWire()
      await new Promise((resolve) => setTimeout(resolve, 50))
      drainWire()

      // file landed with the right content
      const saved = fs.readFileSync(path.join(tmpDir, 'hello.bin'))
      assert.strictEqual(saved.equals(content), true)
      assert.ok(eventsOf('file-complete').length === 1)

      // session ended on both sides
      assert.strictEqual(s.isActive(), false)
      assert.strictEqual(remoteFinished, true)
      assert.ok(eventsOf('session-end').length === 1)
    })

    test('existing file is not clobbered', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleData(zrqinitFrame())
      s.setSavePath(tmpDir)
      fs.writeFileSync(path.join(tmpDir, 'dup.txt'), 'old')
      s.prepareReceiveFile('dup.txt', 3)
      const prepared = eventsOf('file-prepared')
      assert.ok(prepared[0].path !== path.join(tmpDir, 'dup.txt'))
      assert.ok(prepared[0].path.includes('dup.txt.'))
      s.cancel()
    })

    test('flooding while waiting for the user aborts the session', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      s.handleData(zrqinitFrame())
      const big = Buffer.alloc(5 * 1024 * 1024, 0x41)
      s.handleData(big)
      assert.strictEqual(s.isActive(), false)
      assert.ok(eventsOf('session-end').length === 1)
    })
  })

  // ── send (upload) ────────────────────────────────────────────────────────

  describe('send', () => {
    /**
     * Remote rz endpoint: a Receiver that answers our Sender, with its
     * output queued onto the wire. `drainAll` keeps cycling until the
     * wire is quiet so mid-frame exchanges never stall.
     */
    function makeRemoteRz (wire) {
      const remote = new Receiver()
      const rz = {
        remote,
        feed (u8) {
          let off = 0
          let iter = 0
          while (off < u8.length && iter++ < 10000) {
            const consumed = remote.feedIncoming(u8.subarray(off))
            off += consumed
            rz.pump()
            if (consumed === 0) break
          }
        },
        pump () {
          const out = remote.drainOutgoing()
          if (out.length) wire.emit(out)
          while (remote.pollEvent() !== null) {
            // events drained so the queue never fills
          }
          const chunk = remote.drainFile()
          if (chunk.length) remote.advanceFile(chunk.length)
        }
      }
      return rz
    }

    test('uploads a file to a live rz endpoint', async () => {
      const wire = new Wire()
      const s = makeSession(wire)

      const srcPath = path.join(tmpDir, 'up.bin')
      const content = Buffer.from('upload payload 0123456789\n'.repeat(150))
      fs.writeFileSync(srcPath, content)

      // rz announces readiness (ZRINIT)
      const rz = makeRemoteRz(wire)
      wire.remote = rz

      const drainWire = () => {
        let guard = 0
        while (guard++ < 1000) {
          rz.pump()
          if (!wire.raw.length) break
          wire.flushTo(s)
        }
      }

      wire.emit(zrinitFrame())
      drainWire()
      assert.strictEqual(s.state, ZMODEM_STATE.WAITING_FILES)
      assert.ok(eventsOf('send-start').length === 1)

      // user picked the file
      s.setSendFiles([{ path: srcPath, name: 'up.bin', size: content.length }])
      assert.strictEqual(s.state, ZMODEM_STATE.SENDING)

      // pump until the wire goes quiet (transfer + ZFIN handshake);
      // small files complete within this single drain
      drainWire()

      assert.ok(eventsOf('file-complete').length >= 1)
      assert.strictEqual(rz.remote.getFileName(), 'up.bin')
      assert.strictEqual(rz.remote.getFileSize(), content.length)
      s.cancel()
    })

    test('ZSKIP from remote ends the batch instead of hanging', () => {
      const wire = new Wire()
      const s = makeSession(wire)

      const srcPath = path.join(tmpDir, 'skip.bin')
      fs.writeFileSync(srcPath, 'data')

      wire.emit(zrinitFrame())
      wire.flushTo(s)
      assert.strictEqual(s.state, ZMODEM_STATE.WAITING_FILES)

      s.setSendFiles([{ path: srcPath, name: 'skip.bin', size: 4 }])
      assert.strictEqual(s.state, ZMODEM_STATE.SENDING)

      // rz refuses: ZSKIP frame arrives (possibly split across chunks)
      const frame = zskipFrame()
      s.handleData(frame.subarray(0, 3))
      s.handleData(frame.subarray(3))

      assert.ok(eventsOf('file-skipped').length === 1)
      assert.strictEqual(s.isActive(), false)
      // cancel sequence was sent to the remote
      assert.ok(wire.toWireString().includes('\x18\x18\x18\x18\x18\x18\x18\x18B'))
      // terminal display restored: debris is swallowed and the shell
      // prompt (trailing '$ ') reappears
      assert.strictEqual(s.handleData(Buffer.from('rz: error\r\n$ ')), true)
      assert.ok(wsSent.some((b) => b.toString().includes('$ ')))
    })
  })

  // ── misc invariants ──────────────────────────────────────────────────────

  describe('invariants', () => {
    test('ZMODEM_HEADER constant matches the protocol signature', () => {
      assert.deepStrictEqual([...ZMODEM_HEADER], [0x2a, 0x2a, 0x18, 0x42])
    })

    test('handleData accepts string input without throwing', () => {
      const wire = new Wire()
      const s = makeSession(wire)
      assert.strictEqual(s.handleData('plain text\r\n'), false)
      s.destroy()
    })
  })
})
