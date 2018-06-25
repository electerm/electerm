/**
 * sftp through ws
 */

import {generate} from 'shortid'
import Transfer from './transfer'
import {transferTypeMap} from './constants'
import initWs from './ws'

const keys = window.getGlobal('instSftpKeys')
const transferKeys = Object.keys(transferTypeMap)

class Sftp {

  constructor() {}

  async init () {
    let id = generate()
    let ws = await initWs('sftp', id)
    this.ws = ws
    this.id = id
    ws.s({
      action: 'sftp-new',
      id
    })
    let th = this
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
        let uid = func + ':' + id
        //let ws = await initWs()
        return new Promise((resolve, reject) => {
          ws.s({
            action: 'sftp-func',
            id,
            func,
            args
          })
          ws.once((arg) => {
            if (arg.error) {
              console.log('sftp error')
              console.log(arg.error.message)
              console.log(arg.error.stack)
              return reject(new Error(arg.error.message))
            }
            resolve(arg.data)
          }, uid)
        })
      }
    })
  }

  async destroy() {
    let {ws} = this
    ws.s({
      action: 'sftp-destroy',
      id: this.id
    })
    ws.close()
  }

}

export default async () => {
  let sftp = new Sftp()
  await sftp.init()
  return sftp
}
