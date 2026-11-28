const { test } = require('node:test')
const assert = require('node:assert/strict')
const classifier = import('../../client/components/ai/agent-read-only-commands.js')

test('recognizes literal POSIX inspection commands and vetted listing options', async () => {
  const { isReadOnlyAgentCommand } = await classifier
  for (const shell of ['bash', 'zsh', 'sh', 'ash', 'dash', 'fish']) {
    for (const command of [
      'pwd', ' pwd -P ', 'ls', 'ls  -la ./src /tmp', 'ls -lhA -- ../some-dir',
      'ls ./-literal', 'whoami', 'id -u', 'uname -a', 'df -h', 'date -u', 'ps -ef'
    ]) {
      assert.equal(isReadOnlyAgentCommand(command, shell), true, command)
    }
  }
})

test('file inspection requires named inputs and recognized options', async () => {
  const { isReadOnlyAgentCommand: allowed } = await classifier
  for (const cmd of ['cat README.md', 'wc -l ./log.txt', 'head -n 25 /etc/hosts', 'tail -- app.log', 'stat .git/config']) {
    assert.equal(allowed(cmd, 'bash'), true, cmd)
  }
  for (const cmd of ['cat', 'wc -l', 'head -n 3 -', 'tail -f app.log', 'cat /dev/tty', 'cat /./dev/tty', 'cat x/../dev/tty']) {
    assert.equal(allowed(cmd, 'bash'), false, cmd)
  }
  assert.equal(allowed('type README.md', 'cmd'), true)
  assert.equal(allowed('type CON', 'cmd'), false)
  assert.equal(allowed('Get-Content .\\readme.md', 'pwsh'), true)
  assert.equal(allowed('Get-Content -Wait readme.md', 'pwsh'), false)
})

test('distinguishes cmd and PowerShell directory, location and date commands', async () => {
  const { isReadOnlyAgentCommand } = await classifier
  const forms = [
    ['cmd', ['DIR /b C:\\Users', 'dir /a:d ..\\src', 'CD', 'VER', 'DATE /T', 'time /t']],
    ['powershell', ['Get-Location', 'pwd', 'Get-Date', 'Get-ChildItem -File C:\\Users', 'LS -Name ./src', 'dir -Directory']],
    ['pwsh', ['get-childitem /tmp -Force', 'get-location']],
    ['cmd.exe', ['dir']]
  ]
  for (const [shell, commands] of forms) {
    for (const command of commands) assert.equal(isReadOnlyAgentCommand(command, shell), true, command)
  }
  assert.equal(isReadOnlyAgentCommand('cd', 'powershell'), false)
  assert.equal(isReadOnlyAgentCommand('date', 'cmd'), false)
  assert.equal(isReadOnlyAgentCommand('pwd', 'cmd'), false)
  assert.equal(isReadOnlyAgentCommand('ls -la', 'powershell'), false)
  for (const shell of ['', undefined, 'unknown', 'telnet']) {
    assert.equal(isReadOnlyAgentCommand('pwd', shell), false)
  }
})

test('rejects shell syntax, control characters and options with other behavior', async () => {
  const { isReadOnlyAgentCommand } = await classifier
  for (const shell of ['bash', 'cmd', 'powershell']) {
    const list = shell === 'cmd' ? 'dir' : 'ls'
    for (const suffix of [
      ' | sort', ' && pwd', ';pwd', ' > out', '< in', ' $(pwd)', ' "$(pwd)"',
      ' `pwd`', ' *.log', ' ~/src', ' %TMP%', ' !TMP!', ' ^x', ' {a,b}',
      " 'file;pwd'", ' #comment', '\npwd', '\r', '\x1b', '\t/tmp', ' \u202eabc'
    ]) {
      assert.equal(isReadOnlyAgentCommand(list + suffix, shell), false, JSON.stringify(suffix))
    }
  }
  const rejected = [
    ['zsh', ['ls =pwd', 'ls \\-R', 'ls -R', 'ls --color=auto', 'ls /tmp*(e:foo:)', 'pwdx', 'ps -o cmd', 'df --sync', 'git status', 'cat', 'less file', 'date 0101010100']],
    ['cmd', ['cd folder', 'dir /p', 'dir .\\folder/p', 'dir \\\\server\\share', 'dir CON', 'dir C:\\dir\\COM1.txt', 'dir c:relative', 'dir file:stream', 'time']],
    ['powershell', ['cd ..', 'ls -Recurse', 'ls -OutVariable result', 'dir //server/share', 'ls Env:PATH', 'ls function:prompt', 'ls file:stream', 'Get-Date -Date tomorrow']]
  ]
  for (const [shell, commands] of rejected) {
    for (const command of commands) assert.equal(isReadOnlyAgentCommand(command, shell), false, command)
  }
  for (const command of [null, undefined, 0, {}, '', '  ']) {
    assert.equal(isReadOnlyAgentCommand(command, 'bash'), false)
  }
})
