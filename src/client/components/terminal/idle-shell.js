import { refs } from '../common/ref.js'
import { probeAccountShell } from './shell-detect.js'
import { shellName } from './ssh-reload-state.js'

const posixShells = new Set(['bash', 'zsh', 'sh', 'ash', 'dash', 'fish'])
const accountShells = new WeakMap()

const userHost = /^(?:\[[\p{L}\p{M}\p{N}_.-]+@[\p{L}\p{M}\p{N}_.-]+ [\p{L}\p{M}\p{N}_.~ /-]+\]|[\p{L}\p{M}\p{N}_.-]+@[\p{L}\p{M}\p{N}_.-]+(?:[ :][\p{L}\p{M}\p{N}_.~ /-]*)?)$/u

function isShellPrompt (session, line, shell) {
  if (!line) return false
  if (!posixShells.has(shell) && !['cmd', 'powershell', 'pwsh'].includes(shell)) return false
  const tracked = session.cmdAddon?.hasShellIntegration?.()
  if (tracked && !session.cmdAddon.isAtTrackedPrompt(line)) return false
  if (shell === 'powershell' || shell === 'pwsh') {
    return /^PS (?:[A-Za-z]:[\\/]|\/)[^<>]*>$/.test(line)
  }
  if (shell === 'cmd') return /^[A-Za-z]:\\[^<>]*>$/.test(line)
  if (tracked && ['bash', 'zsh', 'fish'].includes(shell)) return true
  // Match the prompt prefix and terminator separately so an interactive
  // program's 'postgres=#', 'router#' or bare continuation '>' cannot pass.
  const ending = line.slice(-1)
  const prefix = line.slice(0, -1).trimEnd()
  if (ending === '>') return shell === 'fish' && userHost.test(prefix)
  if (!'#$%❯'.includes(ending)) return false
  return !prefix || userHost.test(prefix) ||
    /^(?:ba|z|da|a)?sh(?:-[\d.]+)?$/.test(prefix) ||
    (ending === '%' && /^[\p{L}\p{M}\p{N}_.-]+$/u.test(prefix)) ||
    (ending === '$' && /^[\p{L}\p{M}\p{N}_.-]+:[\p{L}\p{M}\p{N}_.~/-]+ [\p{L}\p{M}\p{N}_.-]+$/u.test(prefix))
}

function promptLine (session) {
  const addon = session?.attachAddon
  if (!addon || session.onClose || session.onZmodem || session.state?.sessionStopped ||
      addon.disposed || addon.socket?.readyState !== 1 || !addon.hasReceivedInitialData ||
      addon.outputSuppressed || session.startupQueue?.running ||
      addon._bufferChars || addon._pendingInputUnknown ||
      addon._lastInputTime > addon.getLastOutputTime() ||
      addon._lineHasUnsubmittedInput() || session.cmdAddon?.currentCommand) return ''

  const buffer = session.term?.buffer?.active
  if (buffer?.type !== 'normal') return ''
  const row = buffer.getLine(buffer.baseY + buffer.cursorY)
  if (!row || row.isWrapped || row.translateToString(true, buffer.cursorX)) return ''
  return row.translateToString(true, 0, buffer.cursorX).trimEnd()
}

async function getAccountShell (connection, pid) {
  const cached = accountShells.get(connection)
  if (cached) return cached
  const probe = probeAccountShell(pid)
  accountShells.set(connection, probe)
  const shell = await probe
  // A null entry allows one later retry after a transient failure. Concurrent
  // callers share each probe; a second failure lasts until reconnection.
  if (!shell && cached === undefined) accountShells.set(connection, null)
  return shell
}

function isInteractiveArgument (shell, arg) {
  if (posixShells.has(shell)) return ['-i', '-l', '--login'].includes(arg)
  if (typeof arg !== 'string') return false
  if (shell === 'cmd') return arg.toLowerCase() === '/d'
  return ['-nologo', '-noprofile'].includes(arg.toLowerCase())
}

export async function getIdleShellType (tabId) {
  const session = refs.get('term-' + tabId)
  let line = promptLine(session)
  if (!line) return ''
  let shell
  if (session.isLocal()) {
    const exec = session.startupQueue.getLocalExec()
    // A shell executable launched with a script can draw an unrelated prompt.
    shell = shellName(exec.shell)
    if (!Array.isArray(exec.args) || !exec.args.every(arg => isInteractiveArgument(shell, arg))) return ''
  } else if (session.isSsh() && session.pid) {
    const { attachAddon, pid } = session
    shell = await getAccountShell(attachAddon, pid)
    if (refs.get('term-' + tabId) !== session || session.attachAddon !== attachAddon || session.pid !== pid) return ''
    line = promptLine(session)
  }
  return isShellPrompt(session, line, shell) ? shell : ''
}
