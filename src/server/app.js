

//user bluebird as global.Promise for better performance
global.Promise = require('bluebird')

import init from './init'
import config from './config'
import { err, log } from './utils/log'
import http from 'http'

const start = async function () {
  let { site, port, host } = config
  let app = await init()
  let server = http.Server(app.callback())
  server.listen(port, host, () => {
    log(site.siteName, 'start on -->', host + ':' + port)
  })
}

try {
  start()
} catch (e) {
  err(`error start ${config.pack.name}'`, e.stack)
  process.exit(1)
}
