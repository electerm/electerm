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

test('Git exemptions are limited to fixed metadata queries', async () => {
  const { isReadOnlyAgentCommand: allowed } = await classifier
  for (const command of [
    'git --version', 'git --no-pager rev-parse --is-inside-work-tree',
    'git --no-pager rev-parse --show-toplevel', 'git --no-pager symbolic-ref --short HEAD'
  ]) assert.equal(allowed(command, 'zsh'), true, command)
  for (const command of [
    'git status', 'git diff', 'git log', 'git --no-pager log',
    'git --no-pager symbolic-ref --short HEAD refs/heads/main',
    'git --no-pager rev-parse --show-toplevel HEAD'
  ]) assert.equal(allowed(command, 'zsh'), false, command)
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

test('sensitive path names require approval even for otherwise read-only commands', async () => {
  const { isReadOnlyAgentCommand, mentionsSensitivePath } = await classifier
  const cases = [
    ['bash', 'cat /etc/shadow'],
    ['sh', 'cat README /home/user/.ssh/id_rsa'],
    ['zsh', 'head -n 1 -- .aws/config'],
    ['fish', 'tail -- .kube/config'],
    ['bash', 'cat .env.production.local'],
    ['bash', 'cat /tmp/credentials.json'],
    ['cmd', 'type C:\\Users\\tester\\.SSH\\config'],
    ['cmd', 'type C:\\etc\\gshadow.'],
    ['powershell', 'Get-Content C:/Users/Tester/.NPMRC'],
    ['pwsh', 'Get-Content path/.netrc']
  ]
  for (const [shell, command] of cases) {
    assert.equal(mentionsSensitivePath(command), true, command)
    assert.equal(isReadOnlyAgentCommand(command, shell), false, command)
  }
  // Users may have saved these literal commands before the path guard existed.
  for (const command of ['cat "/a directory/.env"', 'cat ~/.ssh/id_rsa', 'cat notes/.config/../.aws/config']) {
    assert.equal(mentionsSensitivePath(command), true, command)
  }
  for (const command of ['cat README', 'head -n 2 shadow.css', 'git status', 'type credentials-guide.txt']) {
    assert.equal(mentionsSensitivePath(command), false, command)
  }
})

test('resolves file-reader operands against the tracked shell directory', async () => {
  const { mentionsSensitivePath: sensitive } = await classifier
  assert.equal(sensitive('cat config', '/home/user/.kube'), true)
  assert.equal(sensitive('cat config', '/home/user/project'), false)
  assert.equal(sensitive('cat gh/hosts.yml', '/home/user/.config'), true)
  assert.equal(sensitive('Get-Content .\\config', 'C:\\Users\\tester\\.ssh'), true)
  assert.equal(sensitive('head -n 10 /tmp/report', '/home/user/.ssh'), false)
  assert.equal(sensitive('cat ../docs/report', '/home/user/.ssh'), false)
  for (const command of ['whoami', 'ls -la', 'pwd', 'git --no-pager rev-parse HEAD']) {
    assert.equal(sensitive(command, '/home/user/.ssh'), false, command)
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
