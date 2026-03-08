/**
 * handle sync with github/gitee
 */

const log = require('../common/log')
const rp = require('axios')
const { createProxyAgent } = require('../lib/proxy-agent')
const {
  electermSync
} = require('electerm-sync')

rp.defaults.proxy = false

async function doSync (type, func, args, token, proxy) {
  const agent = createProxyAgent(proxy)
  const conf = agent
    ? {
        httpsAgent: agent
      }
    : {
        proxy: false
      }
  const axiosInst = rp.create(conf)
  if (type === 'cloud') {
    args[0] = ''
  }
  return electermSync(axiosInst, type, func, args, token)
    .then(r => {
      return r
    })
    .catch(e => {
      log.error('sync error')
      log.error(e)
      return {
        error: e
      }
    })
}

async function wsSyncHandler (ws, msg) {
  const { id, type, args, func, token, proxy } = msg
  const res = await doSync(type, func, args, token, proxy)
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

module.exports = wsSyncHandler
