/**
 * test connection
 */

import fetch from './fetch'

export default (config) => {
  const { host, port } = window._config
  const url = `http://${host}:${port}/terminals?isTest=1`
  return fetch.post(url, config)
}
