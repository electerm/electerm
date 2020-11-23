/**
 * run cmd with terminal
 */

const {
  terminals
} = require('./remote-common')
const { terminal, testConnection } = require('./session')

async function runCmd (ws, msg) {
  const { id, pid, sessionId, cmd } = msg
  const term = terminals(pid, sessionId)
  let txt = ''
  if (term) {
    txt = await term.runCmd(cmd)
  }
  ws.s({
    id,
    data: txt
  })
}

function resize (ws, msg) {
  const { id, pid, sessionId, cols, rows } = msg
  const term = terminals(pid, sessionId)
  if (term) {
    term.resize(cols, rows)
  }
  ws.s({
    id,
    data: 'ok'
  })
}

function createTerm (ws, msg) {
  const { id, body } = msg
  terminal(body, ws)
    .then(data => {
      ws.s({
        id,
        data: data.pid
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
  testConnection(body)
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
