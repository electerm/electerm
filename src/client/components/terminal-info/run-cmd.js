/**
 * run command in remote terminal
 */

import fetch from '../../common/fetch'

export default (store, pid, sessionId, cmd) => {
  const { host, port } = store.config
  const url = `http://${host}:${port}/terminals/${pid}/run-cmd?sessionId=${sessionId}`
  return fetch.post(url, {
    cmd
  }, {
    handleErr: log.error
  })
}
