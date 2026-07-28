/**
 * fs in child process
 */

const { fsExport: fs } = require('../lib/fs')

function handleFs (ws, msg) {
  const { id, args, func } = msg
  // only dispatch to fs helpers defined on the export itself, never to
  // anything reached through the prototype chain
  if (!Object.prototype.hasOwnProperty.call(fs, func) || typeof fs[func] !== 'function') {
    return ws.s({
      id,
      error: {
        message: 'invalid fs function: ' + func,
        stack: ''
      }
    })
  }
  fs[func](...args)
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

module.exports = handleFs
