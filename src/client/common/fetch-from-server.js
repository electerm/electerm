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
  const ws = await initWs('common', id, undefined, true)
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

const wsFetch = async (data, options = {}) => {
  const { silent = false } = options
  if (!window.et.wsOpened) {
    await initWsCommon()
  }
  const id = generate()
  return new NewPromise((resolve, reject) => {
    window.et.commonWs.once((arg) => {
      if (arg.error) {
        // Rejections are propagated to the caller via the returned promise, so
        // callers decide severity. Many fetches (shell detection, owner lookup,
        // folder size) are best-effort and catch gracefully; logging every one
        // at error level with a stack dump surfaces scary-but-harmless failures
        // (e.g. an SSH server rejecting an auxiliary exec channel). Default to a
        // low-key warning carrying only the message; best-effort probes pass
        // { silent: true } to suppress this and log their own clearer message.
        if (!silent) {
          console.warn('fetch error:', arg.error.message || arg.error)
        }
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
