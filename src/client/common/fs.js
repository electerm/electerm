/**
 * fs through ws
 */

import { nanoid as generate } from 'nanoid/non-secure'
import initWs from './ws'

const { fsFunctions } = window.pre
const id = generate()
let ws
let wsOpened = false

export const initFS = async () => {
  ws = await initWs('fs', id)
  wsOpened = true
  ws.onclose = () => {
    wsOpened = false
  }
}

export default fsFunctions.reduce((prev, func) => {
  prev[func] = async (...args) => {
    const uid = func + ':' + id
    if (!wsOpened) {
      await initFS()
    }
    return new Promise((resolve, reject) => {
      ws.s({
        id,
        func,
        args
      })
      ws.once((arg) => {
        if (arg.error) {
          log.error('fs error', arg.error.message)
          return reject(new Error(arg.error.message))
        }
        resolve(arg.data)
      }, uid)
    })
  }
  return prev
}, {})
