/**
 * terminal apis
 */

import fetch from '../../common/fetch-from-server'

export function createTerm (body) {
  return fetch({
    body,
    action: 'create-terminal'
  })
}

export function runCmd (pid, sessionId, cmd) {
  return fetch({
    pid,
    sessionId,
    cmd,
    action: 'run-cmd'
  })
}

export function resizeTerm (pid, sessionId, cols, rows) {
  return fetch({
    pid,
    sessionId,
    cols,
    rows,
    action: 'resize-terminal'
  })
}

export function toggleTerminalLog (pid, sessionId) {
  return fetch({
    pid,
    sessionId,
    action: 'toggle-terminal-log'
  })
}

export function toggleTerminalLogTimestamp (pid, sessionId) {
  return fetch({
    pid,
    sessionId,
    action: 'toggle-terminal-log-timestamp'
  })
}
