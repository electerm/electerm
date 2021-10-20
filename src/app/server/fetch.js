/**
 * node fetch in server side
 */

const rp = require('axios')
const {
  createAgent
} = require('./download-upgrade')

function fetch (options) {
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
  const {
    agent,
    agentType
  } = createAgent(proxy)
  if (agent) {
    options[agentType] = agent
  }
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
