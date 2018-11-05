
import http from 'http'
import {resolve} from 'path'
import Koa from 'koa'
import mount from 'koa-mount'
import logger from 'koa-logger'
import serve from 'koa-static'
import conditional from 'koa-conditional-get'
import etag from 'koa-etag'
import compress from 'koa-compress'

const cwd = process.cwd()
const app = new Koa()
const staticOption = () => ({
  maxAge: 1000 * 60 * 60 * 24 * 365,
  hidden: true
})
const p = resolve(
  process.cwd(),
  'package.json'
)
const pack = require(p)
const {
  port = 4570,
  host = 'localhost'
} = process.env
const {log} = console
const start = function () {
  app.keys = ['electerm:' + Math.random()]
  app.use(compress({
    threshold: 2048,
    flush: require('zlib').Z_SYNC_FLUSH
  }))
  app.use(conditional())
  app.use(etag())
  app.use(
    mount(
      '/_bc',
      serve(cwd + '/node_modules', staticOption())
    )
  )
  app.use(logger())
  let server = http.Server(app.callback())
  server.listen(port, host, () => {
    log(`${pack.name} dev server start on --> http://${host}:${port}`)
  })
}

try {
  start()
} catch (e) {
  log(`error start ${pack.name}'`, e.stack)
  process.exit(1)
}
