/**
 * The local RDP launcher hands connection settings to mstsc.exe. A bookmark
 * can arrive from a synced file, a deep
 * link, an import or an AI caller, so what ends up in the argv and in the temp
 * `.rdp` file is pinned here: a line break must not be able to append settings
 * to the `.rdp` file, the password must never be written to that file, and a
 * failed launch must not leave the file behind.
 *
 * Lives in unit-ci/ because src/test/unit/ is not wired into any npm script or
 * workflow -- a suite there does not run in CI.
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const childProcess = require('child_process')

const MOD = '../../../src/app/lib/native-rdp-win'

const originalSpawn = childProcess.spawn
const originalExecFile = childProcess.execFile

function getMod () {
  return require(MOD)
}

async function withPlatform (platform, run) {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform
  })
  try {
    await run()
  } finally {
    Object.defineProperty(process, 'platform', descriptor)
  }
}

function mockExecFile () {
  const calls = []
  childProcess.execFile = (command, args, options, cb) => {
    calls.push({ command, args, options })
    process.nextTick(() => cb(null, '', ''))
  }
  return calls
}

/**
 * @param {Error} [failWith] emit 'error' instead of 'spawn'
 */
function mockSpawn (failWith) {
  const calls = []
  childProcess.spawn = (command, args, options) => {
    calls.push({ command, args, options })
    const child = {
      once: (event, handler) => {
        if (failWith && event === 'error') {
          process.nextTick(() => handler(failWith))
        }
        if (!failWith && event === 'spawn') {
          process.nextTick(() => handler())
        }
        return child
      },
      unref: () => {}
    }
    return child
  }
  return calls
}

function readRdpFile (file) {
  // written as UTF-16LE with a BOM, like mstsc writes it
  return fs.readFileSync(file, 'utf16le')
}

test.afterEach(() => {
  childProcess.spawn = originalSpawn
  childProcess.execFile = originalExecFile
  delete require.cache[require.resolve(MOD)]
})

test('buildRdpFileContent writes the connection without the password', () => {
  const { buildRdpFileContent } = getMod()
  const content = buildRdpFileContent({
    host: '192.168.1.10',
    port: 3390,
    username: 'admin',
    domain: 'CORP',
    password: 'secret',
    nla: true
  })

  assert.match(content, /^full address:s:192\.168\.1\.10:3390\r\n/)
  assert.match(content, /\r\nusername:s:admin\r\n/)
  assert.match(content, /\r\ndomain:s:CORP$/)
  assert.doesNotMatch(content, /prompt for credentials/)
  assert.match(content, /enablecredsspsupport:i:1/)
  assert.ok(!/password/i.test(content), 'the .rdp file must not carry the password')
})

test('buildRdpFileContent defaults to port 3389 and enables NLA', () => {
  const { buildRdpFileContent } = getMod()
  const content = buildRdpFileContent({ host: 'h' })
  assert.match(content, /full address:s:h:3389/)
  assert.match(content, /enablecredsspsupport:i:1/)
})

test('buildRdpFileContent follows the bookmark NLA switch', () => {
  const { buildRdpFileContent } = getMod()
  assert.match(
    buildRdpFileContent({ host: 'h', nla: false }),
    /enablecredsspsupport:i:0/
  )
})

test('buildRdpFileContent refuses a host that would add its own settings', () => {
  const { buildRdpFileContent } = getMod()
  assert.throws(
    () => buildRdpFileContent({ host: 'good\r\ndrivestoredirect:s:*' }),
    /line break/
  )
  assert.throws(
    () => buildRdpFileContent({ host: 'winner', username: 'a\r\nb' }),
    /line break/
  )
  assert.throws(() => buildRdpFileContent({ host: 'has space' }), /whitespace/)
  assert.throws(() => buildRdpFileContent({ host: '' }), /host is required/)
  assert.throws(() => buildRdpFileContent({ host: 'h', port: 70000 }), /invalid RDP port/)
})

test('buildRdpFileContent leaves out a domain the user name already carries', () => {
  const { buildRdpFileContent } = getMod()
  const content = buildRdpFileContent({
    host: 'h',
    username: 'CORP\\admin',
    domain: 'CORP'
  })
  assert.match(content, /username:s:CORP\\admin/)
  assert.ok(!/domain:s:/.test(content))
})

test('launchNativeRdp starts only mstsc and leaves authentication to Windows', async () => {
  const execCalls = mockExecFile()
  const spawnCalls = mockSpawn()

  await withPlatform('win32', async () => {
    const { launchNativeRdp } = getMod()
    const res = await launchNativeRdp({
      host: '192.168.1.10',
      port: 3390,
      username: 'admin',
      password: 'secret',
      nla: true
    })

    assert.equal(execCalls.length, 0)
    assert.equal(spawnCalls.length, 1)
    assert.match(spawnCalls[0].command, /mstsc\.exe$/)
    assert.deepEqual(spawnCalls[0].args, [res.file])
    assert.equal(spawnCalls[0].options.detached, true)

    const content = readRdpFile(res.file)
    assert.match(content, /full address:s:192\.168\.1\.10:3390/)
    assert.ok(!content.includes('secret'), 'password must not reach the disk')
    fs.unlinkSync(res.file)
  })
})

test('launchNativeRdp removes the temp file when mstsc cannot start', async () => {
  mockExecFile()
  const spawnCalls = mockSpawn(new Error('spawn mstsc.exe ENOENT'))

  await withPlatform('win32', async () => {
    const { launchNativeRdp } = getMod()
    await assert.rejects(
      launchNativeRdp({ host: 'h', port: 3389 }),
      /cannot start mstsc\.exe: spawn mstsc\.exe ENOENT/
    )
    const file = spawnCalls[0].args[0]
    assert.equal(fs.existsSync(file), false, 'no temp file left behind')
  })
})

test('only Windows is supported', async () => {
  await withPlatform('linux', async () => {
    const { isSupported, launchNativeRdp } = getMod()
    assert.equal(isSupported(), false)
    await assert.rejects(launchNativeRdp({ host: 'h' }), /only supported on Windows/)
  })
})
