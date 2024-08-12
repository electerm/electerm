/**
 * handle sync with github/gitee
 */

const GitHubOri = require('gist-wrapper').default
const GiteeOri = require('gitee-client').default
const customSync = require('electerm-sync')
const log = require('../common/log')
const rp = require('axios')
const { createProxyAgent } = require('../lib/proxy-agent')

rp.defaults.proxy = false

class Gitee extends GiteeOri {
  create (data, conf) {
    return this.post('/v5/gists', data, conf)
  }

  update (gistId, data, conf) {
    return this.patch(`/v5/gists/${gistId}`, data, conf)
  }

  getOne (gistId, conf) {
    return this.get(`/v5/gists/${gistId}`, conf)
  }

  delOne (gistId, conf) {
    return this.delete(`/gists/${gistId}`, conf)
  }

  test (conf) {
    return this.get('/v5/gists?page=1&per_page=1', conf)
  }
}

class GitHub extends GitHubOri {
  test (conf) {
    return this.get('/gists?page=1&per_page=1', conf)
  }
}

const dist = {
  gitee: Gitee,
  github: GitHub,
  custom: customSync,
  cloud: customSync
}

async function doSync (type, func, args, token, proxy) {
  const argsArr = [...args]
  const inst = new dist[type](token)
  if (type === 'cloud') {
    argsArr[0] = ''
  }
  const agent = createProxyAgent(proxy)
  const conf = agent
    ? {
        httpsAgent: agent
      }
    : {
        proxy: false
      }
  return inst[func](...argsArr, conf)
    .then(r => {
      return r.data
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
