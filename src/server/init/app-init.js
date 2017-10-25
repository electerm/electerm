import Koa from 'koa'
import mount from 'koa-mount'
import Bodyparser from 'koa-bodyparser'
import logger from 'koa-logger'
import serve from 'koa-static'
import CONFIG from '../config'
import router from '../routes'
import Pug from 'koa-pug-global'
import conditional from 'koa-conditional-get'
import etag from 'koa-etag'
import compress from 'koa-compress'
import ua from '../utils/ua'
import commonMiddleware from './common-middleware'
import {err} from '../utils/log'

const local = CONFIG.site
const env = local.env
const isProduction = env === 'production'
const cwd = process.cwd()
const app = new Koa()
const staticOption = () => ({
  maxAge: 1000 * 60 * 60 * 24 * 365,
  hidden: true
})

const bodyparser = Bodyparser()

export default function init() {

  // global middlewares
  app.keys = ['sugo:' + env]

  app.use(compress({
    threshold: 2048,
    flush: require('zlib').Z_SYNC_FLUSH
  }))

  //get
  app.use(conditional())

  // add etags
  app.use(etag())

  //static
  //app.use(serve(cwd + '/app/assets', staticOption()))
  app.use(mount('/_bc', serve(cwd + '/node_modules', staticOption())))
  app.use(mount('/static', serve(cwd + '/app/static', staticOption())))

  // body解析
  app.use(bodyparser)

  // 记录所用方式与时间
  if (env === 'development') {
    app.use(logger())
  }

  //ua
  app.use(ua)

  //全局错误处理 输出到body
  app.use(async (ctx, next) => {
    try {
      await next()
    } catch(e) {
      err(e.stack)
      let {path} = ctx
      if (
        /^\/api\//.test(path)
      ) {
        ctx.status = 500
        ctx.body = {
          error: e.message || e.stack,
          serverTime: new Date()
        }
      } else {
        //500 page
        ctx.status = 500
        ctx.render('500', {
          ...ctx.local,
          stack: e.stack,
          message: e.message
        })
      }
    }
  })

  //通用加工，获取host等
  app.use(commonMiddleware)

  //pug template
  new Pug({
    viewPath: cwd + '/views',
    debug: !isProduction,
    pretty: !isProduction,
    compileDebug: !isProduction,
    noCache: !isProduction,
    app: app // equals to pug.use(app) and app.use(pug.middleware)
  })

  //路由处理
  router(app)

  return app
}
