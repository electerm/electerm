/**
 * fs in child process
 */

const { fsExport: fs } = require('../lib/fs')

function handleFs (ws, msg) {
  const { id, args, func } = msg
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
