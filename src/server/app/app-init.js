import Koa from 'koa'
import mount from 'koa-mount'
import Bodyparser from 'koa-bodyparser'
import logger from 'koa-logger'
import serve from 'koa-static'
import conditional from 'koa-conditional-get'
import etag from 'koa-etag'
import compress from 'koa-compress'
import Pug from 'koa-pug-global'

const isProduction = process.env.NODE_ENV === 'production'
const cwd = process.cwd()
const app = new Koa()
const staticOption = () => ({
  maxAge: 1000 * 60 * 60 * 24 * 365,
  hidden: true
})

const bodyparser = Bodyparser()

export default function init() {

  // global middlewares
  app.keys = ['electerm:' + Math.random()]

  app.use(compress({
    threshold: 2048,
    flush: require('zlib').Z_SYNC_FLUSH
  }))

  //get
  app.use(conditional())

  // add etags
  app.use(etag())

  app.use(
    mount(
      '/_bc',
      serve(cwd + '/node_modules', staticOption())
    )
  )

  // body
  app.use(bodyparser)

  if (!isProduction) {
    app.use(logger())
  }

  //pug template
  new Pug({
    viewPath: cwd + '/src/views',
    debug: !isProduction,
    pretty: !isProduction,
    compileDebug: !isProduction,
    noCache: !isProduction,
    app: app
  })

  return app
}
