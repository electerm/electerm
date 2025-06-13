/**
 * sftp through ws
 */

import generate from './uid'
import Transfer from './transfer'
import { transferTypeMap, instSftpKeys as keys } from './constants'
import initWs from './ws'

const transferKeys = Object.keys(transferTypeMap)

class Sftp {
  async init (terminalId, port) {
    const id = generate()
    const ws = await initWs('sftp', id, terminalId, undefined, port)
    this.ws = ws
    this.id = id
    this.terminalId = terminalId
    ws.s({
      action: 'sftp-new',
      id,
      type: this.type,
      terminalId
    })
    const th = this
    this.ws = ws
    keys.forEach(func => {
      th[func] = async (...args) => {
        if (transferKeys.includes(func)) {
          return Transfer({
            sftpId: id,
            isFtp: this.type === 'ftp',
            ...args[0],
            terminalId,
            type: func
          })
        }
        const fid = generate()
        const uid = func + ':' + fid
        // let ws = await initWs()
        return new Promise((resolve, reject) => {
          ws.s({
            action: 'sftp-func',
            id,
            uid,
            func,
            args,
            terminalId,
            type: this.type
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
      id: this.id,
      terminalId: this.terminalId
    })
    ws.close()
  }
}

export default async (terminalId, type = 'sftp', port) => {
  const sftp = new Sftp()
  sftp.type = type
  await sftp.init(terminalId, port)
  return sftp
}
