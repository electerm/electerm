/**
 * node fetch in server side
 */

const { createProxyAgent } = require('../lib/proxy-agent')

function fetch (options) {
  const rp = require('axios')
  rp.defaults.proxy = false
  return rp(options)
    .then((res) => {
      return res.data
    })
    .catch(error => {
      return {
        error
      }
    })
}

async function wsFetchHandler (ws, msg) {
  const { id, options, proxy } = msg
  const agent = createProxyAgent(proxy)
  if (agent) {
    options.httpsAgent = agent
  }
  const res = await fetch(options)
  if (res.error) {
    console.log(res.error)
    ws.s({
      error: res.error.message,
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
