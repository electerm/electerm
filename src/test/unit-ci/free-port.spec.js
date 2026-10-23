/**
 * Port selection used to be `find-free-port`, which probes with
 * net.createConnection() and treats "cannot connect" as "free". On Windows a
 * port inside a reserved/excluded range (Hyper-V, WinNAT, WSL2, Docker
 * Desktop, some VPN/AV) refuses the connection, so it looked free, and the
 * later listen() died with EACCES -- not EADDRINUSE, so nothing ever fell
 * through to the next port. The app then waited for `serverInited` forever:
 * no window, no message.
 *
 * These tests pin the two properties that matter: a port we cannot bind is
 * skipped (whatever the error code), and a port we can bind is reported
 * correctly, including port 0.
 */

const { test } = require('node:test')
const assert = require('node:assert/strict')
const net = require('net')

const { getFreePort, tryBind } = require('../../app/lib/free-port')

function holdPort (port = 0, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(port, host, () => resolve(server))
  })
}

function closeServer (server) {
  return new Promise(resolve => server.close(resolve))
}

test('tryBind reports the port it bound, also for port 0', async () => {
  const port = await tryBind(0, '127.0.0.1')
  assert.ok(port > 0)
  // released again, so the same port can be bound right away
  assert.equal(await tryBind(port, '127.0.0.1'), port)
})

test('tryBind rejects for a port that is already taken', async () => {
  const server = await holdPort()
  const { port } = server.address()
  await assert.rejects(tryBind(port, '127.0.0.1'), err => err.code === 'EADDRINUSE')
  await closeServer(server)
})

test('skips a taken port and returns the next one', async () => {
  const server = await holdPort()
  const { port } = server.address()
  try {
    const free = await getFreePort({ from: port, host: '127.0.0.1', tries: 20 })
    assert.ok(free > port, `${free} should be past the taken ${port}`)
  } finally {
    await closeServer(server)
  }
})

test('skips ports that refuse to bind, e.g. a Windows reserved range (EACCES)', async () => {
  // a Windows reserved port accepts no connection *and* refuses to bind, so the
  // bind probe is the only thing that can tell it apart from a free port
  const seen = []
  const probe = async (port) => {
    seen.push(port)
    if (port < 30980) {
      const err = new Error('listen EACCES: permission denied 127.0.0.1:' + port)
      err.code = 'EACCES'
      throw err
    }
    return port
  }
  const free = await getFreePort({ from: 30975, host: '127.0.0.1', probe })
  assert.equal(free, 30980)
  assert.deepEqual(seen, [30975, 30976, 30977, 30978, 30979, 30980])
})

test('gives up with a clear error when nothing can be bound', async () => {
  const probe = async () => {
    const err = new Error('EACCES')
    err.code = 'EACCES'
    throw err
  }
  await assert.rejects(
    getFreePort({ from: 30975, tries: 3, probe }),
    /no free port found from 30975 \(tried 3\)/
  )
})

test('never walks past 65535', async () => {
  const probe = async (port) => {
    const err = new Error('EACCES')
    err.code = 'EACCES'
    throw err
  }
  await assert.rejects(
    getFreePort({ from: 65533, tries: 10, probe }),
    /no free port found/
  )
})
