/**
 * Default quick commands seeded on a brand new install.
 *
 * A quick command is sent verbatim to whatever shell the active tab runs, so
 * the defaults are picked per platform: POSIX commands on macOS/Linux, and
 * PowerShell on Windows (the platform default shell, see app/common/default-setting.js).
 * Commands are deliberately plain: no shell functions, no interactive TUIs
 * that swallow the next keystroke, and no `{{ }}` sequences that the
 * quick command template parser (store/quick-command.js) would rewrite.
 */

const { isWin, isMac } = require('./detect-shells')

function cmd (id, name, command, labels) {
  return {
    _id: id,
    name,
    commands: [{
      id: `${id}-cmd`,
      command,
      delay: 100
    }],
    inputOnly: false,
    labels,
    shortcut: ''
  }
}

const macOsCommands = [
  cmd('default-qm-ls', 'ls', 'ls -alh', ['file']),
  cmd('default-qm-df', 'df', 'df -h', ['disk']),
  cmd('default-qm-du', 'du', 'du -sh * | sort -h', ['disk', 'file']),
  cmd('default-qm-sysinfo', 'sysinfo', 'sw_vers && uname -a', ['system']),
  cmd('default-qm-cpu', 'cpu', 'sysctl -n machdep.cpu.brand_string && sysctl -n hw.ncpu', ['system']),
  cmd('default-qm-mem', 'mem', 'top -l 1 -s 0 | grep -E "PhysMem|Load Avg" || vm_stat | head -6', ['system']),
  cmd('default-qm-top', 'top', 'top', ['system']),
  cmd('default-qm-ps', 'ps', 'ps aux', ['system']),
  cmd('default-qm-net', 'net', 'ifconfig | grep -E "^[a-z0-9]+:|inet "', ['network']),
  cmd('default-qm-ports', 'ports', 'lsof -iTCP -sTCP:LISTEN -P -n', ['network']),
  cmd('default-qm-ping', 'ping', 'ping -c 4 1.1.1.1', ['network']),
  cmd('default-qm-whoami', 'whoami', 'whoami; hostname; uptime', ['system']),
  cmd('default-qm-git', 'git', 'git status -sb', ['git']),
  cmd('default-qm-docker', 'docker', 'docker ps', ['docker'])
]

const linuxCommands = [
  cmd('default-qm-ls', 'ls', 'ls -alh', ['file']),
  cmd('default-qm-df', 'df', 'df -h', ['disk']),
  cmd('default-qm-du', 'du', 'du -sh * | sort -h', ['disk', 'file']),
  cmd('default-qm-sysinfo', 'sysinfo', 'uname -a && cat /etc/os-release', ['system']),
  cmd('default-qm-cpu', 'cpu', 'nproc && grep -m1 "model name" /proc/cpuinfo', ['system']),
  cmd('default-qm-mem', 'mem', 'free -h', ['system']),
  cmd('default-qm-top', 'top', 'top', ['system']),
  cmd('default-qm-ps', 'ps', 'ps aux', ['system']),
  cmd('default-qm-net', 'net', 'ip -brief addr || ifconfig', ['network']),
  cmd('default-qm-ports', 'ports', 'ss -tulpn || netstat -tulpn', ['network']),
  cmd('default-qm-ping', 'ping', 'ping -c 4 1.1.1.1', ['network']),
  cmd('default-qm-whoami', 'whoami', 'whoami; hostname; uptime', ['system']),
  cmd('default-qm-git', 'git', 'git status -sb', ['git']),
  cmd('default-qm-docker', 'docker', 'docker ps', ['docker'])
]

// PowerShell 5.1 compatible: nothing here needs PowerShell 7
const windowsCommands = [
  cmd('default-qm-ls', 'ls', 'Get-ChildItem -Force | Format-Table -AutoSize', ['file']),
  cmd(
    'default-qm-disk',
    'disk',
    "Get-Volume | Where-Object { $_.DriveLetter } | Format-Table DriveLetter, FileSystemLabel, FileSystem, HealthStatus, @{n='Size(GB)';e={[math]::Round($_.Size/1GB,1)}}, @{n='Free(GB)';e={[math]::Round($_.SizeRemaining/1GB,1)}} -AutoSize",
    ['disk']
  ),
  cmd(
    'default-qm-sysinfo',
    'sysinfo',
    'Get-CimInstance Win32_OperatingSystem | Format-List Caption, Version, BuildNumber, OSArchitecture',
    ['system']
  ),
  cmd(
    'default-qm-cpu',
    'cpu',
    'Get-CimInstance Win32_Processor | Format-List Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed',
    ['system']
  ),
  cmd(
    'default-qm-mem',
    'mem',
    "Get-CimInstance Win32_OperatingSystem | Select-Object @{n='TotalGB';e={[math]::Round($_.TotalVisibleMemorySize/1MB,2)}}, @{n='FreeGB';e={[math]::Round($_.FreePhysicalMemory/1MB,2)}} | Format-List",
    ['system']
  ),
  cmd(
    'default-qm-ps',
    'ps',
    'Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Name, Id, CPU, WorkingSet',
    ['system']
  ),
  cmd('default-qm-net', 'net', 'Get-NetIPAddress -AddressFamily IPv4 | Format-Table InterfaceAlias, IPAddress -AutoSize', ['network']),
  cmd(
    'default-qm-ports',
    'ports',
    'Get-NetTCPConnection -State Listen | Sort-Object LocalPort | Select-Object LocalAddress, LocalPort, OwningProcess',
    ['network']
  ),
  cmd('default-qm-ping', 'ping', 'ping -n 4 1.1.1.1', ['network']),
  cmd('default-qm-whoami', 'whoami', 'whoami; hostname; Get-Date', ['system']),
  cmd('default-qm-env', 'env', 'Get-ChildItem Env: | Sort-Object Name', ['system']),
  cmd('default-qm-git', 'git', 'git status -sb', ['git']),
  cmd('default-qm-docker', 'docker', 'docker ps', ['docker'])
]

function getDefaultQuickCommands () {
  if (isWin) {
    return windowsCommands
  }
  return isMac ? macOsCommands : linuxCommands
}

/**
 * Default terminal command history entries, derived from the default quick
 * commands so the two can never drift apart.
 *
 * The history popover renders the array reversed (newest first, see
 * components/footer/cmd-history.jsx) and every seeded entry carries the same
 * timestamp, so the list is built backwards to keep the most useful command
 * ('ls') at the top instead of at the bottom of the popover.
 */
function getDefaultCmdHistory () {
  const now = new Date().toISOString()
  const items = []
  for (const qm of getDefaultQuickCommands()) {
    for (const c of qm.commands || []) {
      items.push({
        _id: c.id,
        cmd: c.command,
        // seeded entries are not "used" yet; 1 keeps the count badge in the
        // history popover readable, running the command bumps it to 2
        count: 1,
        lastUseTime: now
      })
    }
  }
  return items.reverse()
}

module.exports = {
  getDefaultQuickCommands,
  getDefaultCmdHistory,
  macOsCommands,
  linuxCommands,
  windowsCommands
}
