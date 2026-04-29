process.env.NODE_ENV = 'development'

const { describe, test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const { once } = require('node:events')
const findFreePort = require('find-free-port')
const FtpSrv = require('@electerm/ftp-srv')
const serialportModulePath = require.resolve('serialport')
const serialportExports = require(serialportModulePath)
const { MockBinding } = require('@serialport/binding-mock')

const globalState = require('../../src/app/server/global-state')
const { Ftp } = require('../../src/app/server/session-ftp')
const sessionSerial = require('../../src/app/server/session-serial')
const sessionTelnet = require('../../src/app/server/session-telnet')

const FTP_USERNAME = 'test'
const FTP_PASSWORD = 'test123'
const SERIAL_PATH = '/dev/electerm-test'
const TELNET_USERNAME = 'tester'
const TELNET_PASSWORD = 'electerm-test'

function makeTmpDir (prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

async function getFreePort (start = 30000, end = 39999) {
  const [port] = await findFreePort(start, end, '127.0.0.1')
  return port
}

async function startFtpServer () {
  const root = makeTmpDir('electerm-ftp-test-')
  const port = await getFreePort(31000, 31999)
  const server = new FtpSrv({
    url: `ftp://127.0.0.1:${port}`,
    anonymous: false,
    root
  })

  server.on('login', ({ username, password }, resolve, reject) => {
    if (username === FTP_USERNAME && password === FTP_PASSWORD) {
      return resolve({ root })
    }
    return reject(new Error('Invalid username or password'))
  })

  await server.listen()

  return {
    port,
    root,
    async close () {
      await server.close()
      fs.rmSync(root, { recursive: true, force: true })
    }
  }
}

async function startTelnetServer () {
  const port = await getFreePort(32000, 32999)
  const sockets = new Set()

  function waitForIdle (timeout = 5000) {
    if (sockets.size === 0) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timed out waiting for telnet sockets to close'))
      }, timeout)

      const interval = setInterval(() => {
        if (sockets.size === 0) {
          clearTimeout(timer)
          clearInterval(interval)
          resolve()
        }
      }, 25)
    })
  }

  const server = net.createServer((socket) => {
    sockets.add(socket)
    socket.setEncoding('utf8')

    let stage = 'username'
    let buffer = ''

    socket.write('login: ')

    socket.on('data', (chunk) => {
      buffer += chunk

      while (buffer.includes('\n')) {
        const endIndex = buffer.indexOf('\n')
        const line = buffer.slice(0, endIndex).replace(/\r$/, '')
        buffer = buffer.slice(endIndex + 1)

        if (stage === 'username') {
          if (line === TELNET_USERNAME) {
            stage = 'password'
            socket.write('Password: ')
          } else {
            socket.write('login incorrect\r\nlogin: ')
          }
          continue
        }

        if (stage === 'password') {
          if (line === TELNET_PASSWORD) {
            stage = 'shell'
            socket.write('Welcome to electerm\r\n$ ')
          } else {
            socket.write('Login failed\r\n')
            socket.end()
          }
          continue
        }

        socket.write(`echo:${line}\r\n$ `)
      }
    })

    socket.on('close', () => {
      sockets.delete(socket)
    })
  })

  server.listen(port, '127.0.0.1')
  await once(server, 'listening')

  return {
    port,
    waitForIdle,
    async close () {
      await waitForIdle().catch(() => {})
      for (const socket of sockets) {
        socket.destroy()
      }
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
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
      if (matcher(output, chunk)) {
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

describe('session-ftp transport flows', () => {
  let ftpServer
  let ftp

  beforeEach(async () => {
    ftpServer = await startFtpServer()
    ftp = new Ftp({
      uid: 'ftp-session-ci',
      host: '127.0.0.1',
      port: ftpServer.port,
      user: FTP_USERNAME,
      password: FTP_PASSWORD,
      readyTimeout: 5000
    })
    await ftp.connect(ftp.initOptions)
  })

  afterEach(async () => {
    if (ftp) {
      ftp.kill()
      ftp = null
    }
    if (ftpServer) {
      await ftpServer.close()
      ftpServer = null
    }
  })

  test('connects and performs core file operations against ftp-srv', async () => {
    assert.equal(globalState.getSession(ftp.pid), ftp)

    await ftp.mkdir('/docs')
    await ftp.writeFile('/docs/hello.txt', 'hello ftp')

    assert.equal(await ftp.readFile('/docs/hello.txt'), 'hello ftp')

    const stats = await ftp.stat('/docs/hello.txt')
    assert.equal(stats.isDirectory, false)
    assert.equal(stats.size, 'hello ftp'.length)

    await ftp.cp('/docs/hello.txt', '/docs-copy.txt')
    assert.equal(await ftp.readFile('/docs-copy.txt'), 'hello ftp')

    const list = await ftp.list('/docs')
    assert.deepEqual(list.map(item => item.name), ['hello.txt'])
  })

  test('copies directories recursively and removes them recursively', async () => {
    await ftp.mkdir('/source')
    await ftp.mkdir('/source/nested')
    await ftp.writeFile('/source/root.txt', 'root')
    await ftp.writeFile('/source/nested/child.txt', 'child-data')

    assert.equal(await ftp.cp('/source', '/copied'), 1)
    assert.equal(await ftp.readFile('/copied/root.txt'), 'root')
    assert.equal(await ftp.readFile('/copied/nested/child.txt'), 'child-data')

    const size = await ftp.getFolderSize('/copied')
    assert.deepEqual(size, {
      size: 'root'.length + 'child-data'.length,
      count: 2
    })

    assert.equal(await ftp.rmdir('/source'), 1)
    assert.equal(await ftp.tryStat('/source'), null)
  })
})

describe('session-serial transport flows', () => {
  let term

  beforeEach(() => {
    require.cache[serialportModulePath].exports = {
      ...serialportExports,
      SerialPort: serialportExports.SerialPortMock
    }
    MockBinding.reset()
    MockBinding.createPort(SERIAL_PATH, {
      echo: true,
      record: true
    })
  })

  afterEach(async () => {
    if (term && term.port) {
      const port = term.port
      const closePromise = once(port, 'close').catch(() => {})
      term.kill()
      await closePromise
      term = null
    } else if (term) {
      term.kill()
      term = null
    }
    require.cache[serialportModulePath].exports = serialportExports
    MockBinding.reset()
  })

  test('creates a serial session and echoes writes through the mock binding', async () => {
    term = await sessionSerial.session({
      uid: 'serial-session-ci',
      path: SERIAL_PATH,
      baudRate: 9600
    })

    assert.equal(globalState.getSession(term.pid), term)

    const dataPromise = once(term.port, 'data')
    term.write('ping')
    const [data] = await dataPromise

    assert.equal(data.toString(), 'ping')

    const port = term.port
    const closePromise = once(port, 'close')
    term.kill()
    await closePromise
    term = null

    assert.equal(globalState.getSession('serial-session-ci'), undefined)
  })

  test('reports serial connectivity through the exported test helper', async () => {
    assert.equal(await sessionSerial.test({
      path: SERIAL_PATH,
      baudRate: 9600
    }), true)
  })
})

describe('session-telnet transport flows', () => {
  let telnetServer
  let term

  beforeEach(async () => {
    telnetServer = await startTelnetServer()
  })

  afterEach(async () => {
    if (term) {
      term.kill()
      term = null
    }
    if (telnetServer) {
      await telnetServer.close()
      telnetServer = null
    }
  })

  test('connects, authenticates with regex prompts, and exchanges shell data', async () => {
    term = await sessionTelnet.session({
      uid: 'telnet-session-ci',
      host: '127.0.0.1',
      port: telnetServer.port,
      username: TELNET_USERNAME,
      password: TELNET_PASSWORD,
      loginPrompt: '/login[: ]*$/i',
      passwordPrompt: '/password[: ]*$/i',
      readyTimeout: 5000
    })
    term.channel.on('error', () => {})
    term.channel.socket.on('error', () => {})

    assert.equal(globalState.getSession(term.pid), term)

    const banner = await waitForText(term.port, (output) => {
      return output.includes('Welcome to electerm')
    })
    assert.match(banner, /welcome to electerm/i)

    const responsePromise = waitForText(term.port, (output) => {
      return output.includes('echo:status')
    })
    term.write('status\n')
    const response = await responsePromise

    assert.match(response, /echo:status/)

    term.resize(132, 43)
    assert.equal(term.channel.options.terminalWidth, 132)
    assert.equal(term.channel.options.terminalHeight, 43)

    term.kill()
    await telnetServer.waitForIdle()
    term = null

    assert.equal(globalState.getSession('telnet-session-ci'), undefined)
  })
})
