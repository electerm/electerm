/**
 * upgrade through ws
 */

import { nanoid as generate } from 'nanoid/non-secure'
import initWs from './ws'

const keys = window.pre.transferKeys

class Upgrade {
  async init ({
    onData,
    onEnd,
    onError,
    ...rest
  }) {
    const id = generate()
    this.id = id
    const th = this
    const ws = await initWs('upgrade', id)
    ws.s({
      action: 'upgrade-new',
      ...rest,
      id
    })
    keys.forEach(func => {
      th[func] = (...args) => {
        ws.s({
          action: 'upgrade-func',
          id: th.id,
          func,
          args
        })
        if (func === 'destroy') {
          th.onDestroy(ws)
        }
      }
    })

    const did = 'upgrade:data:' + id
    this.onData = (evt) => {
      const arg = JSON.parse(evt.data)
      if (did === arg.id) {
        onData(arg.data)
      }
    }
    ws.addEventListener('message', this.onData)
    ws.once((arg) => {
      onEnd(arg)
    }, 'upgrade:end:' + id)
    ws.once((arg) => {
      log.debug('upgrade error')
      log.debug(arg.error.stack)
      onError(new Error(arg.error.message))
    }, 'upgrade:err:' + id)
  }

  onDestroy (ws) {
    ws.removeEventListener('message', this.onData)
    ws.close()
  }
}

export default async (props) => {
  const upgrade = new Upgrade()
  await upgrade.init(props)
  return upgrade
}
