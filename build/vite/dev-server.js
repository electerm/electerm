import logger from 'morgan'
import { viewPath, env, staticPaths, pack, isProd, cwd } from './common.js'
import express from 'express'
import { createServer as createViteServer } from 'vite'
import conf from './conf.js'
import { loadDevStylus } from './style.js'
import copy from 'json-deep-copy'

const devPort = env.DEV_PORT || 5570
const host = env.DEV_HOST || '127.0.0.1'
const h = `http://${host}:${devPort}`
const base = {
  version: pack.version,
  isDev: !isProd,
  siteName: pack.name,
  stylus: loadDevStylus()
}

function handleIndex (req, res) {
  const view = 'index'
  res.render(view, {
    ...base,
    _global: copy(base)
  })
}

function redirect (req, res) {
  const {
    name
  } = req.params
  const mapper = {
    electerm: '/src/client/entry/electerm.jsx',
    worker: '/src/client/entry/worker.js'
  }
  res.redirect(mapper[name])
}

async function createServer () {
  const app = express()

  // Create Vite server in middleware mode and configure the app type as
  // 'custom', disabling Vite's own HTML serving logic so parent server
  // can take control
  const vite = await createViteServer({
    ...conf,
    server: {
      middlewareMode: true,
      hmr: {
        port: 30085,
        overlay: true
      }
    },
    appType: 'custom'
  })

  app.use(
    logger('dev')
  )
  app.use(express.json())
  app.use(express.urlencoded({
    extended: true
  }))
  staticPaths.forEach(({ path, dir }) => {
    app.use(
      path,
      express.static(dir, { maxAge: '170d' })
    )
  })

  app.set('views', viewPath)
  app.set('view engine', 'pug')

  // Use vite's connect instance as middleware. If you use your own
  // express router (express.Router()), you should use router.use
  app.use(vite.middlewares)
  app.get(['/', '/index.html'], handleIndex)
  app.get('/:dir/:name.:ext', redirect)
  app.listen(devPort, host, () => {
    console.log('cwd:', cwd)
    console.log(`server started at ${h}`)
  })
}

createServer()
