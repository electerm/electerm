/**
 * node fetch in server side
 */

const rp = require('phin')

function fetch (options) {
  return rp(options)
    .then((res) => {
      if (res.statusCode >= 304) {
        throw new Error(`status: ${res.statusCode}`)
      }
      return res.body.toString()
    })
    .catch(error => {
      return {
        error
      }
    })
}

async function wsFetchHandler (ws, msg) {
  const { id, options } = msg
  const res = await fetch(options)
  if (res.error) {
    ws.s({
      error: res.error,
      id
    })
  } else {
    ws.s({
      data: res,
      id
    })
  }
}

module.exports = wsFetchHandler
