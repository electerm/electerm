/**
 * upgrade through ws
 */

import {generate} from 'shortid'
import initWs from './ws'

const keys = window.getGlobal('upgradeKeys')

class Upgrade {

  constructor() {}

  async init ({
    onData,
    onEnd,
    onError,
    ...rest
  }) {
    let id = generate()
    this.id = id
    let th = this
    let ws = await initWs('upgrade', id)
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

    let did = 'upgrade:data:' + id
    this.onData = (evt) => {
      let arg = JSON.parse(evt.data)
      if (did === arg.id) {
        onData(arg.data)
      }
    }
    ws.addEventListener('message', this.onData)
    ws.once((arg) => {
      onEnd(arg)
    }, 'upgrade:end:' + id)
    ws.once((arg) => {
      console.log('upgrade error')
      console.log(arg.error.stack)
      onError(new Error(arg.error.message))
    }, 'upgrade:err:' + id)

  }

  onDestroy(ws) {
    ws.removeEventListener('message', this.onData)
    ws.close()
  }

}

export default async (props) => {
  let upgrade = new Upgrade()
  await upgrade.init(props)
  return upgrade
}
