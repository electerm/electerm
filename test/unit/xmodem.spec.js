// xmodem.spec.js
// Unit tests for XmodemSession – verifies that the session resets properly
// after a successful send so that normal serial-port I/O resumes.
process.env.NODE_ENV = 'development'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { XmodemSession, XMODEM_STATE } = require('../../src/app/server/xmodem')

// XMODEM control bytes
const SOH = 0x01
const EOT = 0x04
const ACK = 0x06
const CRC = 0x43 // 'C'

/**
 * Helper: create a minimal XmodemSession with mock terminal and websocket.
 * The mock terminal records all writes; the mock websocket records all
 * JSON messages sent to the client.
 */
function createMockSession () {
  const written = []
  const clientMessages = []

  const term = {
    writeRaw: (data) => written.push(Buffer.from(data)),
    write: (data) => written.push(Buffer.from(data))
  }

  const ws = {
    s: (msg) => clientMessages.push(msg)
  }

  const session = new XmodemSession(term, ws)
  return { session, written, clientMessages, term, ws }
}

/**
 * CRC-16/XMODEM calculation (mirrors the one in xmodem.js)
 */
function crc16Xmodem (data) {
  let crc = 0
  for (let i = 0; i < data.length; i++) {
    crc = crc ^ (data[i] << 8)
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc = crc << 1
      }
    }
    crc = crc & 0xFFFF
  }
  return crc
}

describe('XmodemSession send lifecycle', () => {
  it('isActive returns false after send completes (session-end)', async () => {
    const { session, clientMessages } = createMockSession()

    // Start send
    session.startSend()
    assert.equal(session.isActive(), true)

    // Set up a temp file to send (one 128-byte packet)
    const tmpFile = path.join(os.tmpdir(), `xmodem-test-${Date.now()}.bin`)
    const fileData = Buffer.alloc(128, 0xAA)
    fs.writeFileSync(tmpFile, fileData)

    session.setSendFiles([{
      name: 'test.bin',
      path: tmpFile,
      size: 128
    }])

    // Simulate remote requesting CRC mode
    session.handleData(Buffer.from([CRC]))
    assert.equal(session.state, XMODEM_STATE.SENDING)

    // Simulate remote ACKing the data packet
    session.handleData(Buffer.from([ACK]))

    // After ACK, sendNextPacket sees file is done → sendEot fires.
    // sendEot sends EOT, fires session-end, and calls resetState.
    // The state should now be IDLE.
    assert.equal(session.state, XMODEM_STATE.IDLE)
    assert.equal(session.isActive(), false)

    // Verify session-end was sent to client
    const sessionEndMsg = clientMessages.find(m => m.event === 'session-end')
    assert.ok(sessionEndMsg, 'session-end message should be sent')

    // Verify file-complete was sent to client
    const fileCompleteMsg = clientMessages.find(m => m.event === 'file-complete')
    assert.ok(fileCompleteMsg, 'file-complete message should be sent')

    // Cleanup
    try { fs.unlinkSync(tmpFile) } catch (e) {}
  })

  it('sendEot does not loop when called multiple times (stale ACK)', async () => {
    const { session, written } = createMockSession()

    session.startSend()

    const tmpFile = path.join(os.tmpdir(), `xmodem-test-loop-${Date.now()}.bin`)
    fs.writeFileSync(tmpFile, Buffer.alloc(128, 0xBB))

    session.setSendFiles([{
      name: 'test.bin',
      path: tmpFile,
      size: 128
    }])

    // Remote requests CRC mode
    session.handleData(Buffer.from([CRC]))

    // Remote ACKs the data packet → triggers sendEot internally
    session.handleData(Buffer.from([ACK]))
    assert.equal(session.state, XMODEM_STATE.IDLE)

    // Now simulate a stale ACK arriving after the session is already IDLE.
    // Before the fix this would cause sendEot → sendNextPacket → sendEot loop.
    const eotCountBefore = written.filter(b => b.length === 1 && b[0] === EOT).length
    session.handleData(Buffer.from([ACK]))
    const eotCountAfter = written.filter(b => b.length === 1 && b[0] === EOT).length

    // No additional EOT should have been sent
    assert.equal(eotCountAfter, eotCountBefore, 'no extra EOT on stale ACK')

    // State should still be IDLE
    assert.equal(session.state, XMODEM_STATE.IDLE)

    try { fs.unlinkSync(tmpFile) } catch (e) {}
  })

  it('resetState clears timeouts', async () => {
    const { session } = createMockSession()

    session.startSend()
    // startSend sets a receive timeout
    assert.ok(session.receiveTimeout, 'receiveTimeout should be set after startSend')

    session.resetState()

    // After reset, timeouts should be nulled and state should be IDLE
    assert.equal(session.receiveTimeout, null)
    assert.equal(session.sendTimeout, null)
    assert.equal(session.state, XMODEM_STATE.IDLE)
  })

  it('handleData returns false when session is IDLE (data passes through)', async () => {
    const { session } = createMockSession()

    // Session starts as IDLE
    assert.equal(session.state, XMODEM_STATE.IDLE)

    // Regular terminal data should NOT be consumed by xmodem
    const consumed = session.handleData(Buffer.from('hello'))
    assert.equal(consumed, false)
  })

  it('handleData returns false for non-protocol data when session is IDLE after send', async () => {
    const { session } = createMockSession()

    // Full send cycle: start → send files → remote ACKs → EOT → reset
    session.startSend()
    const fs = require('fs')
    const tmpFile = path.join(os.tmpdir(), `xmodem-test-idle-${Date.now()}.bin`)
    fs.writeFileSync(tmpFile, Buffer.alloc(128, 0xDD))

    session.setSendFiles([{ name: 'test.bin', path: tmpFile, size: 128 }])
    session.handleData(Buffer.from([CRC])) // remote requests CRC
    session.handleData(Buffer.from([ACK])) // remote ACKs packet → sendEot → resetState

    // Session should be IDLE
    assert.equal(session.state, XMODEM_STATE.IDLE)

    // Normal terminal text should NOT be consumed (falls through to ws.send)
    assert.equal(session.handleData(Buffer.from('hello\n')), false)
    assert.equal(session.handleData(Buffer.from([0x0D])), false) // Enter key

    try { fs.unlinkSync(tmpFile) } catch (e) {}
  })

  it('receive path resets state after EOT completion', async () => {
    const { session, written, clientMessages } = createMockSession()

    // Set up save path
    session.setSavePath(os.tmpdir())

    // Build a valid XMODEM-128 CRC packet: SOH + block 1 + ~block1 + 128 data + CRC16
    const blockNum = 1
    const data = Buffer.alloc(128, 0xCC)
    const crc = crc16Xmodem(data)

    const packet = Buffer.alloc(3 + 128 + 2)
    packet[0] = SOH
    packet[1] = blockNum
    packet[2] = blockNum ^ 0xFF
    data.copy(packet, 3)
    packet[3 + 128] = (crc >> 8) & 0xFF
    packet[3 + 128 + 1] = crc & 0xFF

    // Send the data packet
    session.handleData(packet)
    assert.equal(session.state, XMODEM_STATE.RECEIVING)

    // Send EOT (end of transmission)
    session.handleData(Buffer.from([EOT]))

    // After EOT, receive path should have reset state to IDLE
    assert.equal(session.state, XMODEM_STATE.IDLE)
    assert.equal(session.isActive(), false)

    // Verify ACK was sent for EOT
    const ackWritten = written.find(b => b.length === 1 && b[0] === ACK)
    assert.ok(ackWritten, 'ACK should be sent for EOT')

    // Verify session-end was sent to client
    const sessionEndMsg = clientMessages.find(m => m.event === 'session-end')
    assert.ok(sessionEndMsg, 'session-end should be sent after receive complete')
  })
})
