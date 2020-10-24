/**
 * fetch from server
 */

import initWs from './ws'
import { generate } from 'shortid'

const id = 's'
let ws
let wsOpened = false

const init = async () => {
  ws = await initWs('fetch', id)
  wsOpened = true
  ws.onclose = () => {
    wsOpened = false
  }
}

export default async (url, options) => {
  const id = generate()
  if (!wsOpened) {
    await init()
  }
  return new Promise((resolve, reject) => {
    ws.s({
      id,
      options: {
        ...options,
        url,
        timeout: 15000
      }
    })
    ws.once((arg) => {
      if (arg.error) {
        log.error('fetch error', arg.error)
        log.error('url', url)
        return reject(new Error(arg.error))
      }
      resolve(arg.data)
    }, id)
  })
}
