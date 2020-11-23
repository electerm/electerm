/**
 * test connection
 */

import fetch from './fetch-from-server'

export default (body) => {
  return fetch({
    body,
    action: 'test-terminal'
  })
}
