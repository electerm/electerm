const { describe, test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('fs')
const { resolve } = require('path')

// The module is CommonJS on the server side; the renderer copy is ESM. Both are
// the same code, which the drift test below enforces.
const shared = require('../../app/common/powershell-integration.js')
const loadClient = () => import('../../client/common/powershell-integration.js')

const read = (file) => readFileSync(resolve(__dirname, '../../..', file), 'utf8')

// #4737: a Windows local pty used to have the integration typed into it after
// connect. PSReadLine re-renders the whole line for every keystroke, and the
// shell is often still starting, so the script ended up on screen. Handing it
// over as a spawn argument removes the typing - and with it the echo.
describe('PowerShell spawn integration', () => {
  test('appends -NoExit -Command to an empty argument list', () => {
    for (const shell of [
      'System32/WindowsPowerShell/v1.0/powershell.exe',
      'powershell.exe',
      'pwsh',
      'pwsh.exe',
      '"C:\\Program Files\\PowerShell\\7\\pwsh.exe"'
    ]) {
      const args = shared.getPowerShellSpawnArgs(shell, [])
      assert.deepEqual(args.slice(0, 2), ['-NoExit', '-Command'], shell)
      assert.equal(args.length, 3, shell)
      assert.equal(args[2], shared.getPowerShellIntegrationScript(), shell)
    }
  })

  test('keeps the arguments the user configured', () => {
    const args = shared.getPowerShellSpawnArgs('pwsh.exe', ['-NoLogo', '-NoProfile'])
    assert.deepEqual(args.slice(0, 4), ['-NoLogo', '-NoProfile', '-NoExit', '-Command'])
  })

  test('does not add a second -NoExit', () => {
    const args = shared.getPowerShellSpawnArgs('pwsh.exe', ['-NoExit'])
    assert.deepEqual(args.slice(0, 2), ['-NoExit', '-Command'])
    assert.equal(args.filter(a => a === '-NoExit').length, 1)
  })

  // -Command / -File / -EncodedCommand / -NonInteractive own execution: putting
  // ours next to them would either be ignored or break the user's command.
  test('leaves a shell whose arguments own execution alone', () => {
    for (const userArgs of [
      ['-Command', 'Get-Date'],
      ['-c', 'Get-Date'],
      ['-File', 'C:\\setup.ps1'],
      ['-f', 'C:\\setup.ps1'],
      ['-EncodedCommand', 'ZQBjAGgAbwA='],
      ['-NonInteractive'],
      ['-NoExit', '-Command:Get-Date']
    ]) {
      assert.equal(
        shared.getPowerShellSpawnArgs('pwsh.exe', userArgs),
        null,
        JSON.stringify(userArgs)
      )
    }
  })

  test('tolerates arguments that do not take over execution', () => {
    for (const userArgs of [
      ['-NoProfile'],
      ['-ExecutionPolicy', 'Bypass'],
      ['-WindowStyle', 'Hidden'],
      ['-WorkingDirectory', 'D:\\work']
    ]) {
      assert.ok(
        shared.getPowerShellSpawnArgs('pwsh.exe', userArgs),
        JSON.stringify(userArgs)
      )
    }
  })

  test('never touches another shell', () => {
    for (const shell of [
      '',
      undefined,
      'System32/cmd.exe',
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\cmd.exe',
      '/bin/bash',
      'zsh',
      'pwsh-preview',
      'C:\\Program Files\\PowerShell\\7\\pwsh-preview.exe'
    ]) {
      assert.equal(shared.getPowerShellSpawnArgs(shell, []), null, String(shell))
    }
  })

  test('recognizes PowerShell paths only', () => {
    for (const shell of ['powershell', 'POWERSHELL.EXE', 'pwsh', 'pwsh.exe', '  pwsh.exe  ', '"pwsh.exe"', 'C:\\x\\pwsh.exe', 'C:/x/powershell.exe']) {
      assert.equal(shared.isPowerShellPath(shell), true, shell)
    }
    for (const shell of ['', undefined, null, 'cmd.exe', 'bash', 'my-pwsh.exe', 'pwshx.exe']) {
      assert.equal(shared.isPowerShellPath(shell), false, String(shell))
    }
  })

  test('handles a missing or malformed argument list', () => {
    assert.ok(shared.getPowerShellSpawnArgs('pwsh.exe'))
    assert.ok(shared.getPowerShellSpawnArgs('pwsh.exe', null))
    assert.ok(shared.getPowerShellSpawnArgs('pwsh.exe', ['-NoLogo', 42, null]))
  })
})

describe('the injected script', () => {
  const script = shared.getPowerShellIntegrationScript()

  // It travels as *one* command line argument that powershell.exe re-parses.
  // A double quote, a newline or a CR would split or unbalance it.
  test('survives being passed as a single command line argument', () => {
    assert.equal(script.includes('"'), false, 'no double quotes')
    assert.equal(script.includes('\n'), false, 'one line')
    assert.equal(script.includes('\r'), false, 'no carriage return')
    assert.equal(script.includes('\0'), false, 'no null byte')
  })

  // Both halves matter: the OSC 633 pair is what the tracker reads, and the
  // script must not run twice when a nested shell inherits the environment.
  test('guards itself and reports the live cwd', () => {
    assert.match(script, /ELECTERM_SHELL_INTEGRATION/)
    assert.match(script, /^\s*if\(-not \$env:ELECTERM_SHELL_INTEGRATION\)\{/)
    assert.ok(script.includes('[Console]::Write('), 'writes to the pty')
    assert.ok(script.includes("]633;P;Cwd='"), 'reports the cwd')
    assert.ok(script.includes("]633;A'"), 'reports the prompt')
    assert.ok(script.includes(String.raw`.Replace('\','\\')`), 'doubles the backslashes')
    assert.ok(script.includes(String.raw`.Replace(';','\x3b')`), 'escapes the semicolons')
  })

  // oh-my-posh / starship read `$?` as their first statement, and
  // [Console]::Write sets it to true - so the user's prompt has to run first.
  test('runs the user prompt before writing anything', () => {
    assert.ok(
      script.includes('$x=if($global:__e_prompt){& $global:__e_prompt}else{'),
      'the original prompt is called first'
    )
    const body = script.slice(script.indexOf('function global:prompt{'))
    assert.ok(
      body.indexOf('& $global:__e_prompt') < body.indexOf('[Console]::Write('),
      'no statement runs before the user prompt'
    )
  })

  test('does not report a non-filesystem location', () => {
    assert.ok(script.includes("if($PWD.Provider.Name -eq 'FileSystem'){"))
  })
})

describe('the two copies of the module', () => {
  // The server spawns with the script, the renderer decides whether to type it:
  // they must always agree, so one copy is mirrored for the other process.
  test('differ only in module syntax', () => {
    const normalize = src => src.replace(/^module\.exports = \{/m, 'export {')
    assert.strictEqual(
      normalize(read('src/app/common/powershell-integration.js')),
      read('src/client/common/powershell-integration.js'),
      'src/app/common and src/client/common powershell-integration.js have drifted'
    )
  })

  test('the renderer sees the same answers as the server', async () => {
    const client = await loadClient()
    assert.equal(client.getPowerShellIntegrationScript(), shared.getPowerShellIntegrationScript())
    assert.deepEqual(
      client.getPowerShellSpawnArgs('pwsh.exe', ['-NoLogo']),
      shared.getPowerShellSpawnArgs('pwsh.exe', ['-NoLogo'])
    )
  })
})

describe('the local session', () => {
  test('spawns the platform shell with the integration', () => {
    const src = read('src/app/server/session-local.js')
    assert.match(
      src,
      /getPowerShellSpawnArgs\(shellPath, userArgs\)/,
      'the local pty must be spawned with the integration argument'
    )
    // The Windows setting exists on every platform - spawning a Linux pty with
    // `-NoExit -Command <PowerShell script>` would have been a disaster.
    assert.match(
      src,
      /const shellPath = isWin\s*\?\s*execWindows\s*:\s*platform === 'darwin' \? execMac : execLinux/,
      'the platform shell decides, not the Windows setting'
    )
  })
})
