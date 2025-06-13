/**
 * run cmd with terminal
 */

const {
  terminals
} = require('./remote-common')
const { testConnection, terminal } = require('./session')

async function runCmd (msg) {
  const { pid, cmd } = msg
  const term = terminals(pid)
  let txt = ''
  if (term) {
    txt = await term.runCmd(cmd)
  }
  return txt
}

async function resize (msg) {
  const { pid, cols, rows } = msg
  const term = terminals(pid)
  if (term) {
    term.resize(cols, rows)
  }
  return 'ok'
}

async function toggleTerminalLog (msg) {
  const { pid } = msg
  const term = terminals(pid)
  if (term) {
    term.toggleTerminalLog()
  }
  return 'ok'
}

async function toggleTerminalLogTimestamp (msg) {
  const { pid } = msg
  const term = terminals(pid)
  if (term) {
    term.toggleTerminalLogTimestamp()
  }
  return 'ok'
}

async function createTerm (msg) {
  const { body } = msg
  const t = await terminal(body)
  return t.pid
}

async function testTerm (ws, msg) {
  const { body } = msg
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
