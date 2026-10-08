process.env.NODE_ENV = 'development'

const { describe, test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const net = require('node:net')
const { once } = require('node:events')
const findFreePort = require('find-free-port')

const sessionTelnet = require('../../../src/app/server/session-telnet')

const IAC = 0xff
const SB = 0xfa
const WILL = 0xfb
const DO = 0xfd
const SE = 0xf0
const ECHO = 0x01
const SUPPRESS_GO_AHEAD = 0x03
const TERMINAL_TYPE = 0x18
const NEGO_WINDOW_SIZE = 0x1f

const USERNAME = 'admin'
const PASSWORD = 'zte-test'

const bytes = (...list) => Buffer.from(list)
const command = (cmd, option) => bytes(IAC, cmd, option)
const suboption = (option, payload) =>
  Buffer.concat([bytes(IAC, SB, option), Buffer.from(payload), bytes(IAC, SE)])

// A stand-in for the kind of device in #4575 (ZTE ZXR10 and other boxes that
// only implement a subset of the telnet options): it prints its banner and
// login prompt, optionally negotiates a couple of options, and records every
// byte the client sends so a test can look at the client's own traffic.
async function startDevice ({ negotiation = [] } = {}) {
  const port = await new Promise((resolve, reject) => {
    findFreePort(33000, 33999, '127.0.0.1')
      .then(([p]) => resolve(p))
      .catch(reject)
  })

  const received = []
  const sockets = new Set()

  const server = net.createServer((socket) => {
    sockets.add(socket)

    let stage = 'username'
    let buffer = ''

    // Record raw bytes - telnet negotiation is binary, so it must not go
    // through a utf8 decoder. Line parsing is done on a latin1 view, which is
    // byte transparent for the ASCII lines the device cares about.
    socket.on('data', (chunk) => {
      received.push(Buffer.from(chunk))
      buffer += chunk.toString('latin1')

      while (buffer.includes('\n')) {
        const end = buffer.indexOf('\n')
        const line = buffer.slice(0, end).replace(/\r$/, '')
        buffer = buffer.slice(end + 1)
        if (stage === 'username') {
          stage = 'password'
          socket.write('password: ')
          continue
        }
        if (stage === 'password') {
          stage = 'shell'
          socket.write(line === PASSWORD ? 'ZXR10# ' : '% Local login-authentication failure!\r\nlogin: ')
          continue
        }
        socket.write(`ZXR10# ${line}\r\nZXR10# `)
      }
    })

    socket.write(Buffer.concat([
      Buffer.from(
        '****\r\n' +
        'Welcome to ZXR10 5250-28TC Switch of ZTE Corporation\r\n' +
        '****\r\n\r\n' +
        'login: '
      ),
      Buffer.from(negotiation)
    ]))

    socket.on('close', () => sockets.delete(socket))
  })

  server.listen(port, '127.0.0.1')
  await once(server, 'listening')

  return {
    port,
    received,
    // everything the client sent, as one buffer
    clientBytes: () => Buffer.concat(received),
    async close () {
      for (const socket of sockets) {
        socket.destroy()
      }
      await new Promise(resolve => server.close(resolve))
    }
  }
}

function waitForText (emitter, matcher, timeout = 5000) {
  return new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for text. Received: ${output}`))
    }, timeout)
    const onData = (chunk) => {
      output += chunk.toString()
      if (matcher(output)) {
        cleanup()
        resolve(output)
      }
    }
    const onClose = () => {
      cleanup()
      reject(new Error(`Stream closed before matcher succeeded. Received: ${output}`))
    }
    const cleanup = () => {
      clearTimeout(timer)
      emitter.off('data', onData)
      emitter.off('close', onClose)
      emitter.off('end', onClose)
    }
    emitter.on('data', onData)
    emitter.on('close', onClose)
    emitter.on('end', onClose)
  })
}

// Poll until the predicate holds - writes made by the client still have to
// travel over the socket before the fake device can see them.
async function waitFor (predicate, timeout = 2000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (predicate()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  return predicate()
}

async function connect (device) {
  const term = await sessionTelnet.session({
    uid: `telnet-negotiation-${device.port}`,
    host: '127.0.0.1',
    port: device.port,
    username: USERNAME,
    password: PASSWORD,
    readyTimeout: 5000
  })
  term.channel.on('error', () => {})
  term.channel.socket.on('error', () => {})
  return term
}

describe('telnet option negotiation', () => {
  let device
  let term

  afterEach(async () => {
    if (term) {
      term.kill()
      term = null
    }
    if (device) {
      await device.close()
      device = null
    }
  })

  // The regression from #4575: the client used to push `IAC DO SGA`,
  // `IAC WILL TERMINAL_TYPE` and `IAC WILL NAWS` as soon as it saw the first
  // IAC byte. On devices that do not implement those options the commands leak
  // into the login tty and get echoed as junk in front of the auto typed
  // username (`login:+"admin`), which makes the login fail.
  test('does not send option commands the server never asked for', async () => {
    device = await startDevice({
      // the only thing this device asks for is remote echo
      negotiation: command(WILL, ECHO)
    })
    term = await connect(device)

    await waitForText(term.port, output => output.includes('ZXR10# '))

    const sent = device.clientBytes()

    // asked for -> answered
    assert.ok(
      sent.includes(command(DO, ECHO)),
      'expected the client to answer IAC WILL ECHO with IAC DO ECHO'
    )

    // never asked for -> must not be sent
    assert.ok(
      !sent.includes(command(DO, SUPPRESS_GO_AHEAD)),
      'client must not send IAC DO SGA unsolicited'
    )
    assert.ok(
      !sent.includes(command(WILL, TERMINAL_TYPE)),
      'client must not send IAC WILL TERMINAL_TYPE unsolicited'
    )
    assert.ok(
      !sent.includes(command(WILL, NEGO_WINDOW_SIZE)),
      'client must not send IAC WILL NAWS unsolicited'
    )
    assert.ok(
      !sent.includes(bytes(IAC, SB, NEGO_WINDOW_SIZE)),
      'client must not send a NAWS suboption before NAWS was agreed'
    )

    // and the auto login still worked
    assert.ok(sent.includes(Buffer.from(USERNAME)), 'username should be sent')
    assert.ok(sent.includes(Buffer.from(PASSWORD)), 'password should be sent')
  })

  test('sends no telnet bytes at all when the device never negotiates', async () => {
    device = await startDevice()
    term = await connect(device)

    await waitForText(term.port, output => output.includes('ZXR10# '))

    const sent = device.clientBytes()
    assert.equal(
      sent.includes(bytes(IAC)),
      false,
      'a device that never negotiates must not receive telnet command bytes'
    )
    assert.ok(sent.includes(Buffer.from(USERNAME)))
  })

  test('reports the window size once the server agrees to NAWS', async () => {
    device = await startDevice({ negotiation: command(DO, NEGO_WINDOW_SIZE) })
    term = await connect(device)

    await waitForText(term.port, output => output.includes('ZXR10# '))

    const sent = device.clientBytes()
    assert.ok(
      sent.includes(command(WILL, NEGO_WINDOW_SIZE)),
      'expected IAC WILL NAWS as the answer to IAC DO NAWS'
    )
    assert.ok(
      sent.includes(suboption(NEGO_WINDOW_SIZE, [0, 80, 0, 24])),
      'expected the default 80x24 window size suboption'
    )

    // resize keeps reporting the new size
    term.resize(132, 43)
    assert.ok(
      await waitFor(() => device.clientBytes().includes(suboption(NEGO_WINDOW_SIZE, [0, 132, 0, 43]))),
      'expected the resized window to be reported'
    )
  })
})
