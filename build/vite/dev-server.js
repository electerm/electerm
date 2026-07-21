import logger from 'morgan'
import { viewPath, env, staticPaths, pack, isProd, cwd } from './common.js'
import express from 'express'
import { createServer as createViteServer } from 'vite'
import conf from './conf.js'
import copy from 'json-deep-copy'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import multer from 'multer'

const devPort = env.DEV_PORT || 5570
const host = env.DEV_HOST || '127.0.0.1'
const h = `http://${host}:${devPort}`
const defaultAIPreset = {
  baseURLAI: 'https://ai.electerm.org/api/ai',
  apiPathAI: '/chat/completions',
  modelAI: 'mistral-small-latest',
  authHeaderNameAI: 'Authorization: Bearer',
  id: 'ai.electerm.org',
  nameAI: 'ai.electerm.org(default free)'
}

// const AIDisclamer = 'AI-generated terminal commands can be inaccurate or unsafe, be careful'

const base = {
  version: pack.version,
  isDev: !isProd,
  siteName: pack.name,
  defaultAIPreset
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

  const upload = multer({ dest: 'uploads/' })

  app.get('/api/download', (req, res) => {
    const filePath = req.query.path
    if (!filePath) {
      return res.status(400).json({ error: 'path is required' })
    }
    try {
      const stat = fs.statSync(filePath)
      if (stat.isFile()) {
        const fileName = path.basename(filePath)
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
        res.setHeader('Content-Type', 'application/octet-stream')
        fs.createReadStream(filePath).pipe(res)
      } else if (stat.isDirectory()) {
        const dirName = path.basename(filePath)
        const parentDir = path.dirname(filePath)
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(dirName)}.tar.gz"`)
        res.setHeader('Content-Type', 'application/gzip')
        const tar = spawn('tar', ['czf', '-', '-C', parentDir, dirName])
        tar.stdout.pipe(res)
        tar.stderr.on('data', (data) => {
          console.error('tar stderr:', data.toString())
        })
        tar.on('error', (err) => {
          console.error('tar error:', err)
          if (!res.headersSent) {
            res.status(500).json({ error: err.message })
          }
        })
      } else {
        res.status(400).json({ error: 'path is not a file or directory' })
      }
    } catch (err) {
      console.error('download error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/upload', upload.single('file'), (req, res) => {
    const targetDir = req.body.path
    if (!targetDir || !req.file) {
      return res.status(400).json({ error: 'path and file are required' })
    }
    try {
      const destPath = path.join(targetDir, req.file.originalname)
      fs.renameSync(req.file.path, destPath)
      res.json({ success: true, path: destPath })
    } catch (err) {
      console.error('upload error:', err)
      res.status(500).json({ error: err.message })
    }
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
