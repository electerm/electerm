/**
 * The local RDP launcher hands values from a bookmark to two Windows binaries
 * (cmdkey.exe, mstsc.exe). A bookmark can arrive from a synced file, a deep
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
    hasPassword: true,
    nla: true
  })

  assert.match(content, /^full address:s:192\.168\.1\.10:3390\r\n/)
  assert.match(content, /\r\nusername:s:admin\r\n/)
  assert.match(content, /\r\ndomain:s:CORP$/)
  assert.match(content, /prompt for credentials:i:0/)
  assert.match(content, /enablecredsspsupport:i:1/)
  assert.ok(!/password/i.test(content), 'the .rdp file must not carry the password')
})

test('buildRdpFileContent asks for the password when none is stored', () => {
  const { buildRdpFileContent } = getMod()
  const content = buildRdpFileContent({ host: 'h', hasPassword: false })
  assert.match(content, /prompt for credentials:i:1/)
  // default port, and the bookmark's NLA choice defaults to on
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

test('credentialTargets covers the port mstsc may look up', () => {
  const { credentialTargets } = getMod()
  assert.deepEqual(
    credentialTargets({ host: 'h', port: 3389 }),
    ['TERMSRV/h']
  )
  assert.deepEqual(
    credentialTargets({ host: 'h', port: 3390 }),
    ['TERMSRV/h', 'TERMSRV/h:3390']
  )
  assert.deepEqual(credentialTargets({ host: 'h' }), ['TERMSRV/h'])
})

test('qualifiedUser does not prefix a user name that has its domain', () => {
  const { qualifiedUser } = getMod()
  assert.equal(qualifiedUser({ username: 'admin', domain: 'CORP' }), 'CORP\\admin')
  assert.equal(qualifiedUser({ username: 'CORP\\admin', domain: 'CORP' }), 'CORP\\admin')
  assert.equal(qualifiedUser({ username: 'admin@corp.com', domain: 'CORP' }), 'admin@corp.com')
  assert.equal(qualifiedUser({ username: 'admin' }), 'admin')
  assert.equal(qualifiedUser({}), '')
})

test('buildCmdkeyArgs quotes a value carrying a space, for cmdkey own parser', () => {
  const { buildCmdkeyArgs } = getMod()
  // cmdkey splits its command line at spaces and only honours a quote that
  // reaches it verbatim, so the quotes go inside the argument and runCmdkey
  // spawns the argv verbatim. Wrapping the whole argument instead makes cmdkey
  // answer "this parameter requires /U" and store nothing.
  assert.deepEqual(
    buildCmdkeyArgs({
      target: 'TERMSRV/h',
      username: 'John Smith',
      domain: 'CORP',
      password: 'pa ss'
    }),
    [
      '/generic:TERMSRV/h',
      '/user:"CORP\\John Smith"',
      '/pass:"pa ss"'
    ]
  )
  assert.deepEqual(
    buildCmdkeyArgs({
      target: 'TERMSRV/h',
      username: 'admin',
      password: 'p$s&s%w/ord'
    }),
    [
      '/generic:TERMSRV/h',
      '/user:admin',
      '/pass:p$s&s%w/ord'
    ]
  )
  // a double quote cannot be expressed for that parser, so it stays as it is;
  // launchNativeRdp does not even try to store such a password
  assert.deepEqual(
    buildCmdkeyArgs({ target: 'TERMSRV/h', password: 'pa"s s' }),
    ['/generic:TERMSRV/h', '/pass:pa"s s']
  )
})

test('launchNativeRdp does not hand cmdkey a password it cannot parse', async () => {
  const execCalls = mockExecFile()
  const spawnCalls = mockSpawn()

  await withPlatform('win32', async () => {
    const { launchNativeRdp } = getMod()
    const res = await launchNativeRdp({
      host: 'h',
      username: 'admin',
      password: 'pa"ss'
    })

    assert.deepEqual(execCalls, [])
    assert.equal(res.credentialStored, false)
    assert.match(res.warnings[0], /double quote/)
    // mstsc asks for it instead of trying a password that was not stored
    assert.match(readRdpFile(res.file), /prompt for credentials:i:1/)
    assert.equal(spawnCalls.length, 1)
    fs.unlinkSync(res.file)
  })
})

test('launchNativeRdp stores the credential and starts mstsc on the temp file', async () => {
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

    assert.equal(res.credentialStored, true)
    assert.deepEqual(res.warnings, [])
    assert.equal(execCalls.length, 2, 'both credential targets are written')
    assert.ok(execCalls.every(c => /cmdkey\.exe$/.test(c.command)))
    assert.deepEqual(execCalls[0].args, [
      '/generic:TERMSRV/192.168.1.10',
      '/user:admin',
      '/pass:secret'
    ])

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

test('launchNativeRdp still connects when the credential cannot be stored', async () => {
  childProcess.execFile = (command, args, options, cb) => {
    process.nextTick(() => cb(new Error('denied'), '', 'denied'))
  }
  const spawnCalls = mockSpawn()

  await withPlatform('win32', async () => {
    const { launchNativeRdp } = getMod()
    const res = await launchNativeRdp({ host: 'h', username: 'admin', password: 'secret' })

    assert.equal(res.credentialStored, false)
    // one credential target for the default port, so one warning
    assert.equal(res.warnings.length, 1)
    assert.match(res.warnings[0], /cmdkey\.exe .* failed: denied/)
    // nothing was stored, so mstsc has to ask -- and the launch goes ahead
    assert.match(readRdpFile(res.file), /prompt for credentials:i:1/)
    assert.equal(spawnCalls.length, 1)
    fs.unlinkSync(res.file)
  })
})

test('launchNativeRdp stores nothing without a user name', async () => {
  const execCalls = mockExecFile()
  const spawnCalls = mockSpawn()

  await withPlatform('win32', async () => {
    const { launchNativeRdp } = getMod()
    // cmdkey needs a user name with the password, mstsc has to ask for both
    const res = await launchNativeRdp({ host: 'h', password: 'secret' })

    assert.deepEqual(execCalls, [])
    assert.equal(res.credentialStored, false)
    assert.match(readRdpFile(res.file), /prompt for credentials:i:1/)
    assert.equal(spawnCalls.length, 1)
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
    const { isSupported, launchNativeRdp, clearRdpCredential } = getMod()
    assert.equal(isSupported(), false)
    await assert.rejects(launchNativeRdp({ host: 'h' }), /only supported on Windows/)
    await assert.rejects(clearRdpCredential({ host: 'h' }), /only supported on Windows/)
  })
})

test('clearRdpCredential reports each target instead of throwing', async () => {
  const execCalls = mockExecFile()

  await withPlatform('win32', async () => {
    const { clearRdpCredential } = getMod()
    const res = await clearRdpCredential({ host: 'h', port: 3390 })
    assert.deepEqual(execCalls.map(c => c.args), [
      ['/delete:TERMSRV/h'],
      ['/delete:TERMSRV/h:3390']
    ])
    assert.deepEqual(res, [
      { target: 'TERMSRV/h', ok: true },
      { target: 'TERMSRV/h:3390', ok: true }
    ])
  })
})
