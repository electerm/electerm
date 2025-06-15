/**
 * run cmd with terminal
 */

const {
  terminals
} = require('./remote-common')
const { testConnection, terminal } = require('./session')

async function runCmd (body) {
  const { pid, cmd } = body
  const term = terminals(pid)
  let txt = ''
  if (term) {
    txt = await term.runCmd(cmd)
  }
  return txt
}

async function resize (body) {
  const { pid, cols, rows } = body
  const term = terminals(pid)
  if (term) {
    term.resize(cols, rows)
  }
  return 'ok'
}

async function toggleTerminalLog (body) {
  const { pid } = body
  const term = terminals(pid)
  if (term) {
    term.toggleTerminalLog()
  }
  return 'ok'
}

async function toggleTerminalLogTimestamp (body) {
  const { pid } = body
  const term = terminals(pid)
  if (term) {
    term.toggleTerminalLogTimestamp()
  }
  return 'ok'
}

async function createTerm (body, ws) {
  const t = await terminal(body, ws)
  return t.pid
}

async function testTerm (body) {
  const r = await testConnection(body)
  if (r) {
    return r
  } else {
    throw new Error('test failed')
  }
}

exports.createTerm = createTerm
exports.testTerm = testTerm
exports.resize = resize
exports.runCmd = runCmd
exports.toggleTerminalLog = toggleTerminalLog
exports.toggleTerminalLogTimestamp = toggleTerminalLogTimestamp
