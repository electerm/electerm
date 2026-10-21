const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const { Sftp } = require('../../app/server/session-sftp')

// Remote Windows commands are built for a double shell context: sshd hands
// the exec string to the default shell (cmd.exe by default on OpenSSH for
// Windows), which then launches powershell.exe. GHSA-ch82-q8wq-2gfv showed
// that raw file names (attacker-influenced via directory listing) could
// break out of that construction. The fix carries every path base64-encoded
// inside a fixed PowerShell script, so these tests pin the command shape:
// template + base64 payloads, nothing else.
const scripts = {
  rmrf: 'Remove-Item -LiteralPath $p0 -Force -Recurse',
  cp: 'Copy-Item -LiteralPath $p0 -Destination $p1 -Recurse -Force',
  mv: 'Move-Item -LiteralPath $p0 -Destination $p1 -Force',
  'folder-size': 'Get-ChildItem -LiteralPath $p0 -Recurse -File | Measure-Object -Property Length -Sum'
}

const b64 = (str) => Buffer.from(str, 'utf8').toString('base64')

// mirrors buildPowerShellCommand, computed independently in the test
const expectedWinCmd = (paths, script) => {
  const decoders = paths
    .map((p, i) => `$p${i}=[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(p)}'))`)
    .join(';')
  return `powershell.exe -NoLogo -NonInteractive -NoProfile -Command "${decoders};${script}"`
}

const newSession = (platform) => {
  const inst = new Sftp({}, null, true)
  // skip the remote platform probe: it needs a live SSH connection
  inst.remoteExecPlatform = platform
  return inst
}

// both techniques from the advisory + generic cmd.exe/PowerShell soup
const hostileNames = [
  'x" & calc & rem \'',
  'test%CMDCMDLINE%end & calc & rem',
  '%PATH%',
  'a|b&c',
  '`whoami`',
  '$(whoami)',
  'a>b<c',
  '^&escape^',
  "it's a trap",
  '\r\ncalc\r\n'
]

describe('sftp remote windows command', () => {
  for (const type of Object.keys(scripts)) {
    test(`${type} keeps hostile file names inert`, async () => {
      const inst = newSession('windows')
      const twoPaths = type !== 'rmrf' && type !== 'folder-size'
      for (const name of hostileNames) {
        const from = `/C:/data/${name}`
        const to = 'C:/backup'
        const paths = twoPaths ? [from, to] : [from]
        const cmd = await inst.buildRemoteCommand(type, ...paths)
        assert.equal(
          cmd,
          expectedWinCmd(paths.map(p => p.replace(/^\/([a-zA-Z]:)/, '$1')), scripts[type]),
          `name ${JSON.stringify(name)} produced ${cmd}`
        )
        // the raw name must not appear: everything travels base64
        assert.equal(cmd.includes(name), false, `raw name leaked into ${cmd}`)
        // payloads decode back to exactly the input paths
        const payloads = [...cmd.matchAll(/FromBase64String\('([^']*)'\)/g)].map(m => m[1])
        assert.deepEqual(payloads.map(p => Buffer.from(p, 'base64').toString('utf8')), paths.map(p => p.replace(/^\/([a-zA-Z]:)/, '$1')))
      }
    })
  }

  test('round-trips ordinary and non-ascii paths', async () => {
    const inst = newSession('windows')
    for (const p of ['C:/data/hello world.txt', 'C:/数据 (1)/文件.txt', 'C:/data/~$temp']) {
      const cmd = await inst.buildRemoteCommand('rmrf', p)
      assert.equal(cmd, expectedWinCmd([p], scripts.rmrf))
    }
  })

  test('posix branch keeps quoting hostile names', async () => {
    const inst = newSession('posix')
    assert.equal(
      await inst.buildRemoteCommand('rmrf', '/data/x" & calc & rem \''),
      'rm -rf "/data/x\\" & calc & rem \'"'
    )
    assert.equal(
      await inst.buildRemoteCommand('folder-size', '/data/$(id)'),
      'du -sh "/data/\\$(id)" && find "/data/\\$(id)" -type f | wc -l'
    )
  })
})
