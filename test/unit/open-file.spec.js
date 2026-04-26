const test = require('node:test')
const assert = require('node:assert/strict')

const childProcess = require('child_process')
const os = require('os')

const originalSpawn = childProcess.spawn
const originalPlatform = os.platform
const originalArch = os.arch
const originalNodeEnv = process.env.NODE_ENV

function loadFsForPlatform (platform) {
  os.platform = () => platform
  os.arch = () => 'x64'
  process.env.NODE_ENV = 'development'
  delete require.cache[require.resolve('../../src/app/lib/fs')]
  delete require.cache[require.resolve('../../src/app/common/runtime-constants')]
  return require('../../src/app/lib/fs').fsExport
}

test.afterEach(() => {
  childProcess.spawn = originalSpawn
  os.platform = originalPlatform
  os.arch = originalArch
  process.env.NODE_ENV = originalNodeEnv
  delete require.cache[require.resolve('../../src/app/lib/fs')]
  delete require.cache[require.resolve('../../src/app/common/runtime-constants')]
})

test('openFile passes malicious Windows filenames as a literal PowerShell argument', async () => {
  let spawnCall
  childProcess.spawn = (command, args, options) => {
    spawnCall = { command, args, options }

    return {
      stderr: {
        on: () => {}
      },
      on: (event, handler) => {
        if (event === 'close') {
          process.nextTick(() => handler(0))
        }
      },
      unref: () => {}
    }
  }

  const fsExport = loadFsForPlatform('win32')
  await fsExport.openFile("C:\\Temp\\poc';Start-Process calc;#.txt")

  assert.equal(spawnCall.command, 'powershell.exe')
  assert.deepEqual(spawnCall.args.slice(0, 3), [
    '-NoLogo',
    '-NonInteractive',
    '-Command'
  ])
  assert.match(spawnCall.args[3], /Invoke-Item -LiteralPath \$path/)
  assert.equal(
    Buffer.from(spawnCall.options.env.ELECTERM_OPEN_FILE_PATH_B64, 'base64').toString('utf8'),
    "C:\\Temp\\poc';Start-Process calc;#.txt"
  )
  assert.equal(spawnCall.options.windowsHide, true)
})

test('openFile passes malicious Unix filenames directly to open command', async () => {
  let spawnCall
  childProcess.spawn = (command, args, options) => {
    spawnCall = { command, args, options }

    return {
      stderr: {
        on: () => {}
      },
      on: (event, handler) => {
        if (event === 'close') {
          process.nextTick(() => handler(0))
        }
      },
      unref: () => {}
    }
  }

  const fsExport = loadFsForPlatform('darwin')
  await fsExport.openFile('/tmp/poc";touch /tmp/pwn;#.txt')

  assert.equal(spawnCall.command, 'open')
  assert.deepEqual(spawnCall.args, ['/tmp/poc";touch /tmp/pwn;#.txt'])
  assert.equal(spawnCall.options.detached, false)
})
