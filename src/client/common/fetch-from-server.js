/**
 * fetch from server
 */

import initWs from './ws'
import { nanoid as generate } from 'nanoid/non-secure'

const id = 's'
let ws
let wsOpened = false

const init = async () => {
  ws = await initWs('common', id)
  wsOpened = true
  ws.onclose = () => {
    wsOpened = false
  }
  window.et.commonWs = ws
}

export default async (data) => {
  const id = generate()
  if (!wsOpened) {
    await init()
  }
  return new Promise((resolve, reject) => {
    ws.s({
      id,
      ...data
    })
    ws.once((arg) => {
      if (arg.error) {
        log.error('fetch error', arg.error)
        return reject(new Error(arg.error.message))
      }
      resolve(arg.data)
    }, id)
  })
}
