/**
 * run cmd with terminal
 */

const { testConnection, terminal, terminals } = require('./session-process')

async function runCmd (ws, msg) {
  const { id, pid, cmd } = msg
  const term = terminals(pid)
  let txt = ''
  if (term) {
    txt = await term.runCmd(cmd, id)
  }
  ws.s({
    id,
    data: txt
  })
}

function resize (ws, msg) {
  const { id, pid, cols, rows } = msg
  const term = terminals(pid)
  if (term) {
    term.resize(cols, rows, id)
  }
  ws.s({
    id,
    data: 'ok'
  })
}

function toggleTerminalLog (ws, msg) {
  const { id, pid } = msg
  const term = terminals(pid)
  if (term) {
    term.toggleTerminalLog(id)
  }
  ws.s({
    id,
    data: 'ok'
  })
}

function toggleTerminalLogTimestamp (ws, msg) {
  const { id, pid } = msg
  const term = terminals(pid)
  if (term) {
    term.toggleTerminalLogTimestamp(id)
  }
  ws.s({
    id,
    data: 'ok'
  })
}

function createTerm (ws, msg) {
  const { id, body } = msg
  terminal(body, ws, id)
    .then(data => {
      ws.s({
        id,
        data
      })
    })
    .catch(err => {
      ws.s({
        id,
        error: {
          message: err.message,
          stack: err.stack
        }
      })
    })
}

function testTerm (ws, msg) {
  const { id, body } = msg
  testConnection(body, id)
    .then(data => {
      if (data) {
        ws.s({
          id,
          data
        })
      } else {
        ws.s({
          id,
          error: {
            message: 'test failed',
            stack: 'test failed'
          }
        })
      }
    })
}

exports.createTerm = createTerm
exports.testTerm = testTerm
exports.resize = resize
exports.runCmd = runCmd
exports.toggleTerminalLog = toggleTerminalLog
exports.toggleTerminalLogTimestamp = toggleTerminalLogTimestamp
