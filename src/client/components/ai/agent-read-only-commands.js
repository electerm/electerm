import { sensitiveReadPath } from '../../common/mcp-transfer-guard.js'

// Classify a single foreground command at a shell prompt. Shell names and
// options have different meanings across interpreters (e.g. cd, date, ls).
// Anything outside these literal forms goes through normal approval.
const posixShells = new Set(['sh', 'ash', 'dash', 'bash', 'zsh', 'fish'])

const posixCommands = new Set([
  // Fixed metadata queries only. Other Git commands can read file contents,
  // refresh the index, or invoke programs configured by the repository.
  'git --version', 'git --no-pager rev-parse --show-toplevel',
  'git --no-pager rev-parse --is-inside-work-tree', 'git --no-pager symbolic-ref --short HEAD',
  'pwd', 'pwd -L', 'pwd -P', 'whoami', 'hostname', 'uptime',
  'id', 'id -u', 'id -un', 'id -g', 'id -gn', 'id -G',
  'uname', 'uname -a', 'uname -s', 'uname -r', 'uname -m',
  'date', 'date -u', 'df', 'df -h', 'ps', 'ps -ef', 'ps aux'
])
const cmdCommands = new Set(['cd', 'ver', 'whoami', 'hostname', 'date /t', 'time /t'])
const cmdDirOptions = new Set(['/a', '/a:d', '/a:-d', '/b', '/n', '/w', '/o:n'])
const powershellCommands = new Set(['pwd', 'get-location', 'get-date', 'whoami', 'hostname'])
const powershellListings = new Set(['get-childitem', 'dir', 'ls'])
const powershellListOptions = new Set(['-name', '-file', '-directory', '-force', '-hidden'])

function isPosixPath (word) {
  return /^[a-zA-Z0-9_./][a-zA-Z0-9_./-]*$/.test(word) && !word.startsWith('//')
}

const fileReadOptions = new Map([
  ['cat', /^-[bnsvET]+$/],
  ['wc', /^-[clmw]+$/],
  ['stat', null],
  ['head', null],
  ['tail', null]
])

function isFileInspection (name, args) {
  if (!fileReadOptions.has(name)) return false
  let start = 0
  if ((name === 'head' || name === 'tail') && args[0] === '-n' && /^\d{1,4}$/.test(args[1])) {
    start = 2
  } else if (fileReadOptions.get(name)?.test(args[0])) {
    start = 1
  }
  if (args[start] === '--') start++
  // Require named inputs. A bare reader, "-" or a terminal device can take
  // over the interactive session instead of returning a tool result.
  return start < args.length && args.slice(start).every(path => {
    const parts = path.split('/').filter(part => part && part !== '.')
    const special = path.startsWith('/') && ['dev', 'proc', 'sys'].includes(parts[0])
    return isPosixPath(path) && !parts.includes('..') && !special
  })
}

function isWindowsPath (word) {
  // Accept local filesystem paths only. A colon outside an absolute drive
  // prefix could name a PowerShell provider or an alternate data stream.
  const path = word.replace(/^[a-z]:\\/, '\\')
  return !path.startsWith('\\\\') &&
    /^[a-z0-9_.\\][a-z0-9_.\\-]*$/.test(path) &&
    !/(?:^|\\)(?:con|prn|aux|nul|(?:com|lpt)[1-9])(?:[.\\]|$)/.test(path)
}

// This checks names visible in the requested command, including quoted paths
// in saved commands. Arbitrary shell expansion and symlink targets are unknown.
export function mentionsSensitivePath (command, cwd = '') {
  const words = command.trim().split(/[\s"'|&;<>()]+/).filter(Boolean)
  if (words.some(word => sensitiveReadPath(word))) return true
  const name = words[0]?.split(/[/\\]/).pop().toLowerCase()
  if (!cwd || !(fileReadOptions.has(name) || ['type', 'get-content', 'gc'].includes(name))) return false
  const operands = words.slice(1)
  if ((name === 'head' || name === 'tail') && operands[0] === '-n') operands.splice(0, 2)
  return operands.some(word => !/^(?:[-~/\\]|[a-z]:)/i.test(word) && sensitiveReadPath(`${cwd}/${word}`))
}

export function isReadOnlyAgentCommand (command, shellType) {
  // Reject controls before splitting, and reject quotes, expansions, command
  // separators and redirections even when they appear inside a path.
  if (typeof command !== 'string' || /[^a-zA-Z0-9 ._:/\\-]/.test(command)) return false
  if (mentionsSensitivePath(command)) return false
  const posix = posixShells.has(shellType)
  const normalized = (posix ? command : command.toLowerCase()).trim().replace(/ +/g, ' ')
  const [name, ...args] = normalized.split(' ')
  if (posix) {
    return posixCommands.has(normalized) ||
      (name === 'ls' && args.every(word => word === '--' || /^-[1aAdFhlrt]+$/.test(word) || isPosixPath(word))) ||
      isFileInspection(name, args)
  }
  if (shellType === 'cmd' || shellType === 'cmd.exe') {
    // cmd also interprets slashes embedded in a directory name as switches.
    // Limit paths to backslashes so '/p' cannot select interactive paging.
    if (name === 'dir') return args.every(word => cmdDirOptions.has(word) || isWindowsPath(word))
    if (name === 'type') return args.length === 1 && isWindowsPath(args[0])
    return cmdCommands.has(normalized)
  }
  if (shellType === 'powershell' || shellType === 'pwsh') {
    const filePath = word => isWindowsPath(word.replaceAll('/', '\\'))
    if (powershellListings.has(name)) return args.every(word => powershellListOptions.has(word) || filePath(word))
    if (name === 'get-content') return args.length === 1 && filePath(args[0])
    return powershellCommands.has(normalized)
  }
  return false
}
