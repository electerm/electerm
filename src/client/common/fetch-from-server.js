/**
 * fetch from server
 */

import initWs from './ws'
import generate from './uid'
import { NewPromise } from './promise-timeout'

const id = 's'
window.et.wsOpened = false

export const initWsCommon = async () => {
  if (window.et.wsOpened) {
    return
  }
  const ws = await initWs('common', id, undefined, undefined, true)
  if (!ws) {
    return
  }
  window.et.wsOpened = true
  ws.onclose = () => {
    window.et.wsOpened = false
  }
  window.et.commonWs = ws
  window.store.wsInited = true
}

window.pre.ipcOnEvent('power-resume', initWsCommon)

const wsFetch = async (data) => {
  if (!window.et.wsOpened) {
    await initWsCommon()
  }
  const id = generate()
  return new NewPromise((resolve, reject) => {
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
window.wsFetch = wsFetch
export default wsFetch
