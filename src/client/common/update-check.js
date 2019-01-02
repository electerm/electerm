/**
 * check latest release for update warn
 */

import fetch from './fetch'
import {generate} from 'shortid'
import initWs from './ws'

let ws

export async function getLatestReleaseInfo() {
  let url = 'https://electerm.html5beta.com/version.html?_=' + (+new Date())
  let tag_name = await fetch.get(url, null, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36'
    },
    timeout: 1000 * 60 * 5
  })
  if (tag_name) {
    return {
      tag_name
    }
  }
}

export async function upgrade(version) {
  let id = generate()
  ws = await initWs('upgrade', id)
  return new Promise((resolve, reject) => {
    ws.s({
      id,
      version
    })
    ws.once((arg) => {
      if (arg.error) {
        console.log('fs error')
        console.log(arg.error.message)
        console.log(arg.error.stack)
        return reject(new Error(arg.error.message))
      }
      resolve(arg.data)
    }, id)
  })
}
