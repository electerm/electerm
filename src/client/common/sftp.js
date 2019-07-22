/**
 * sftp through ws
 */

import { generate } from 'shortid'
import Transfer from './transfer'
import { transferTypeMap } from './constants'
import initWs from './ws'

const keys = window.getGlobal('instSftpKeys')
const transferKeys = Object.keys(transferTypeMap)

class Sftp {
  async init () {
    const id = generate()
    const ws = await initWs('sftp', id)
    this.ws = ws
    this.id = id
    ws.s({
      action: 'sftp-new',
      id
    })
    const th = this
    this.ws = ws
    keys.forEach(func => {
      th[func] = async (...args) => {
        if (transferKeys.includes(func)) {
          return Transfer({
            sftpId: id,
            ...args[0],
            type: func
          })
        }
        const uid = func + ':' + id
        // let ws = await initWs()
        return new Promise((resolve, reject) => {
          ws.s({
            action: 'sftp-func',
            id,
            func,
            args
          })
          ws.once((arg) => {
            if (arg.error) {
              log.debug('sftp error', arg.error.message)
              return reject(new Error(arg.error.message))
            }
            resolve(arg.data)
          }, uid)
        })
      }
    })
  }

  async destroy () {
    const { ws } = this
    ws.s({
      action: 'sftp-destroy',
      id: this.id
    })
    ws.close()
  }
}

export default async () => {
  const sftp = new Sftp()
  await sftp.init()
  return sftp
}
