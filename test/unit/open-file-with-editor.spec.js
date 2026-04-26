const test = require('node:test')
const assert = require('node:assert/strict')

const childProcess = require('child_process')
const originalSpawn = childProcess.spawn

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

test.afterEach(() => {
  childProcess.spawn = originalSpawn
  delete require.cache[require.resolve('../../src/app/lib/open-file-with-editor')]
})

test('parseEditorCommand preserves quoted executable and args', () => {
  const { parseEditorCommand } = require('../../src/app/lib/open-file-with-editor')
  const result = parseEditorCommand('"C:\\Program Files\\Notepad++\\notepad++.exe" -multiInst -nosession')

  assert.equal(result.command, 'C:\\Program Files\\Notepad++\\notepad++.exe')
  assert.deepEqual(result.args, ['-multiInst', '-nosession'])
})

test('openFileWithEditor passes malicious filenames as a literal Windows argument', async () => {
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

  await withPlatform('win32', async () => {
    const { openFileWithEditor } = require('../../src/app/lib/open-file-with-editor')
    await openFileWithEditor('C:\\Temp\\poc";Start-Process calc;#.txt', 'notepad.exe')
  })

  assert.equal(spawnCall.command, 'powershell.exe')
  assert.deepEqual(spawnCall.args.slice(0, 2), ['-NoLogo', '-Command'])
  assert.match(spawnCall.args[2], /& \$editor @editorArgs/)
  assert.equal(
    Buffer.from(spawnCall.options.env.ELECTERM_EDITOR_COMMAND_B64, 'base64').toString('utf8'),
    'notepad.exe'
  )
  assert.deepEqual(
    JSON.parse(Buffer.from(spawnCall.options.env.ELECTERM_EDITOR_ARGS_B64, 'base64').toString('utf8')),
    ['C:\\Temp\\poc";Start-Process calc;#.txt']
  )
  assert.equal(spawnCall.options.windowsHide, true)
})

test('openFileWithEditor passes malicious filenames as a literal shell argument on Unix', async () => {
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

  const originalShell = process.env.SHELL
  process.env.SHELL = '/bin/zsh'

  try {
    await withPlatform('darwin', async () => {
      const { openFileWithEditor } = require('../../src/app/lib/open-file-with-editor')
      await openFileWithEditor('/tmp/poc";touch /tmp/pwn;#.txt', 'code --wait')
    })
  } finally {
    process.env.SHELL = originalShell
  }

  assert.equal(spawnCall.command, '/bin/zsh')
  assert.deepEqual(spawnCall.args, [
    '-l',
    '-i',
    '-c',
    'exec "$0" "$@"',
    'code',
    '--wait',
    '/tmp/poc";touch /tmp/pwn;#.txt'
  ])
  assert.equal(spawnCall.options.detached, false)
})

test('parseEditorCommand rejects unmatched quotes', () => {
  const { parseEditorCommand } = require('../../src/app/lib/open-file-with-editor')

  assert.throws(
    () => parseEditorCommand('"C:\\Program Files\\Notepad++\\notepad++.exe'),
    /unmatched quote/
  )
})
