/**
 * Default local terminal bookmarks seeded on a brand new install.
 *
 * Only shells that are actually present on this machine are included, and
 * each one carries the exec field of the running platform (execWindows on
 * Windows, execMac on macOS, execLinux elsewhere), see app/server/session-local.js.
 *
 * The builders below are pure and take already resolved exec paths, so the
 * Windows branch stays testable from macOS/Linux CI.
 */

const path = require('path')
const {
  isWin,
  isMac,
  resolveExec,
  resolveWinDirExec,
  firstExisting
} = require('./detect-shells')

// POSIX shells worth a one click local terminal, platform default first
const posixShells = isMac
  ? ['zsh', 'bash', 'fish']
  : ['bash', 'zsh', 'fish']

const colors = {
  bash: '#4EAA25',
  zsh: '#2E86DE',
  fish: '#8E44AD',
  'cmd.exe': '#607D8B',
  PowerShell: '#2E5C8A',
  'PowerShell 7': '#3B78C3',
  WSL: '#E95420',
  'Git Bash': '#F05033'
}

const fallbackColor = '#0088cc'

/**
 * @param {object} conf
 * @param {string} conf.id stable bookmark id
 * @param {string} conf.title bookmark title
 * @param {string} conf.execProp execWindows / execMac / execLinux
 * @param {string} conf.execArgsProp matching args field
 * @param {string} conf.exec resolved shell
 * @param {string} conf.description bookmark description
 */
function build ({ id, title, execProp, execArgsProp, exec, description }) {
  return {
    _id: id,
    title,
    type: 'local',
    description,
    color: colors[title] || fallbackColor,
    [execProp]: exec,
    [execArgsProp]: []
  }
}

function findPowerShell7 () {
  const inPath = resolveExec('pwsh')
  if (inPath) {
    return inPath
  }
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const programFiles86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  return firstExisting([
    path.join(programFiles, 'PowerShell', '7', 'pwsh.exe'),
    path.join(programFiles86, 'PowerShell', '7', 'pwsh.exe')
  ])
}

function findGitBash () {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const programFiles86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const localAppData = process.env.LOCALAPPDATA || ''
  const found = firstExisting([
    path.join(programFiles, 'Git', 'bin', 'bash.exe'),
    path.join(programFiles86, 'Git', 'bin', 'bash.exe'),
    localAppData && path.join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe')
  ])
  return found || resolveExec('bash')
}

/**
 * @param {object} execs resolved Windows exec values, '' when missing
 * @param {string} execs.cmd cmd.exe
 * @param {string} execs.powershell Windows PowerShell
 * @param {string} execs.pwsh PowerShell 7
 * @param {string} execs.wsl wsl.exe
 * @param {string} execs.gitBash Git Bash
 */
function buildWindowsBookmarks (execs) {
  const candidates = [
    {
      id: 'default-local-cmd',
      title: 'cmd.exe',
      exec: execs.cmd,
      description: 'Local terminal running the Windows command prompt'
    },
    {
      id: 'default-local-powershell',
      title: 'PowerShell',
      exec: execs.powershell,
      description: 'Local terminal running Windows PowerShell'
    },
    {
      id: 'default-local-pwsh',
      title: 'PowerShell 7',
      exec: execs.pwsh,
      description: 'Local terminal running PowerShell 7 (pwsh.exe)'
    },
    {
      id: 'default-local-wsl',
      title: 'WSL',
      exec: execs.wsl,
      // wsl.exe is the only entry point: WSL2 is selected per distro, there
      // is no separate wsl2.exe binary
      description: 'Local terminal running the default WSL distribution (wsl.exe, add -d <distro> to pick one)'
    },
    {
      id: 'default-local-git-bash',
      title: 'Git Bash',
      exec: execs.gitBash,
      description: 'Local terminal running Git Bash'
    }
  ]
  return candidates
    .filter(d => d.exec)
    .map(d => build({
      id: d.id,
      title: d.title,
      execProp: 'execWindows',
      execArgsProp: 'execWindowsArgs',
      exec: d.exec,
      description: d.description
    }))
}

function getWindowsBookmarks () {
  return buildWindowsBookmarks({
    cmd: resolveWinDirExec('System32/cmd.exe'),
    powershell: resolveWinDirExec('System32/WindowsPowerShell/v1.0/powershell.exe'),
    pwsh: findPowerShell7(),
    wsl: resolveWinDirExec('System32/wsl.exe'),
    gitBash: findGitBash()
  })
}

/**
 * @param {string} shell bare shell name
 * @param {string} execProp execMac / execLinux
 * @param {string} execArgsProp matching args field
 * @param {string} exec resolved shell
 */
function buildPosixBookmark (shell, execProp, execArgsProp, exec) {
  return build({
    id: `default-local-${shell}`,
    title: shell,
    execProp,
    execArgsProp,
    exec,
    description: `Local terminal running ${shell}`
  })
}

function getPosixBookmarks () {
  const execProp = isMac ? 'execMac' : 'execLinux'
  const execArgsProp = isMac ? 'execMacArgs' : 'execLinuxArgs'
  return posixShells
    .map(name => [name, resolveExec(name)])
    .filter(([, exec]) => exec)
    .map(([name, exec]) => buildPosixBookmark(name, execProp, execArgsProp, exec))
}

function getDefaultLocalBookmarks () {
  return isWin ? getWindowsBookmarks() : getPosixBookmarks()
}

module.exports = {
  getDefaultLocalBookmarks,
  getWindowsBookmarks,
  getPosixBookmarks,
  buildWindowsBookmarks,
  buildPosixBookmark,
  posixShells
}
