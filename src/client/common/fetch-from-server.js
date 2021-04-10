/**
 * fetch from server
 */

import initWs from './ws'
import { nanoid as generate } from 'nanoid/non-secure'

const id = 's'
window.et.wsOpened = false

export const init = async () => {
  const ws = await initWs('common', id, undefined, undefined, true)
  window.et.wsOpened = true
  ws.onclose = () => {
    window.et.wsOpened = false
  }
  window.et.commonWs = ws
}

window.pre.ipcOnEvent('power-resume', init)

export default async (data) => {
  if (!window.et.wsOpened) {
    await init()
  }
  const id = generate()
  return new Promise((resolve, reject) => {
    window.et.commonWs.once((arg) => {
      if (arg.error) {
        log.error('fetch error', arg.error)
        return reject(new Error(arg.error.message))
      }
      resolve(arg.data)
    }, id)
    window.et.commonWs.s({
      id,
      ...data
    })
  })
}
