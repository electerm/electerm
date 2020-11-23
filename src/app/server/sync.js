/**
 * handle sync with github/gitee
 */

const GitHubOri = require('gist-wrapper').default
const GiteeOri = require('gitee-client').default
const log = require('../utils/log')

class Gitee extends GiteeOri {
  create (data) {
    return this.post('/v5/gists', data)
  }

  update (gistId, data) {
    return this.patch(`/v5/gists/${gistId}`, data)
  }

  getOne (gistId) {
    return this.get(`/v5/gists/${gistId}`)
  }

  delOne (gistId) {
    return this.delete(`/gists/${gistId}`)
  }

  test () {
    return this.get(`/v5/gists?page=1&per_page=1`)
  }
}

class GitHub extends GitHubOri {
  test () {
    return this.get(`/gists?page=1&per_page=1`)
  }
}

const dist = {
  gitee: Gitee,
  github: GitHub
}

async function doSync (type, func, args, token) {
  const inst = new dist[type](token)
  return inst[func](...args)
    .then(r => r.data)
    .catch(e => {
      log.error('sync error')
      return e
    })
}

async function wsSyncHandler (ws, msg) {
  const { id, type, args, func, token } = msg
  const res = await doSync(type, func, args, token)
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
