const fs = require('fs')
const path = require('path')
const { randomBytes } = require('crypto')
const { sanitize: sanitizeCss } = require('./css-bus')
const { isInside, isValidWidgetId } = require('./paths')

// Resolve again when serving. An installed asset can change after import.
function assetFiles (dir, assets) {
  const root = fs.realpathSync(dir)
  const out = { css: [], js: [], images: [] }
  for (const kind of Object.keys(out)) {
    const list = assets[kind] ?? []
    if (!Array.isArray(list)) {
      throw new Error('assets.' + kind + ' must be a list')
    }
    out[kind] = list.map(name => {
      const allowed = kind === 'images' ? ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'] : ['.' + kind]
      if (typeof name !== 'string' || !allowed.includes(path.extname(name).toLowerCase()) ||
        name.split('/').some(part => !part || part === '.' || part === '..') || name.includes('\\') || path.isAbsolute(name)) {
        throw new Error('expected a relative ' + kind + ' asset path')
      }
      const file = fs.realpathSync(path.resolve(root, name))
      if (!isInside(root, file) || !fs.statSync(file).isFile()) {
        throw new Error('invalid widget asset')
      }
      return file
    })
  }
  if (!out.css.length && !out.js.length) {
    throw new Error('assets needs a CSS or JavaScript file')
  }
  return out
}

// This function runs inside a dedicated worker with an opaque origin. Its
// messages are data: the renderer only accepts the documented widget actions.
function widgetApi () {
  const listeners = { tabOpen: new Set(), tabStatusChange: new Set() }
  function subscribe (event, fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('expected a tab event handler')
    }
    listeners[event].add(fn)
    return () => listeners[event].delete(fn)
  }
  self.electerm = Object.freeze({
    onTabOpen: fn => subscribe('tabOpen', fn),
    onTabStatusChange: fn => subscribe('tabStatusChange', fn),
    closeTab: id => self.postMessage({ method: 'closeTab', id })
  })
  self.onmessage = ({ data }) => listeners[data.event]?.forEach(fn => fn(data.tab))
}

// Only this host bootstrap runs in the frame. Widget JS runs in its worker,
// which inherits the frame's network policy and has no DOM or app origin.
function runAssets (js) {
  window.addEventListener('message', function connect (event) {
    if (event.source !== window.parent || !event.ports[0]) {
      return
    }
    window.removeEventListener('message', connect)
    const port = event.ports[0]
    const url = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }))
    const worker = new window.Worker(url)
    URL.revokeObjectURL(url)
    worker.onmessage = ({ data }) => {
      if (data?.method === 'closeTab') {
        port.postMessage({ method: 'closeTab', id: data.id })
      }
    }
    port.onmessage = ({ data }) => worker.postMessage(data)
  })
}

function mountWidgetAssets (app, widgetRoot, appOrigin) {
  const router = require('express').Router()
  app.use('/api/widget-assets', router)
  router.param('id', (req, res, next, id) => {
    if (!isValidWidgetId(id)) {
      return res.sendStatus(404)
    }
    try {
      const root = fs.realpathSync(widgetRoot)
      const dir = fs.realpathSync(path.join(root, id))
      const manifest = fs.realpathSync(path.join(dir, 'package.json'))
      if (!isInside(root, dir) || !isInside(dir, manifest)) {
        return res.sendStatus(404)
      }
      const { assets } = JSON.parse(fs.readFileSync(manifest, 'utf8')).electerm
      req.widgetAssetFiles = assetFiles(dir, assets)
      req.widgetAssets = assets
      res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      next()
    } catch {
      res.sendStatus(404)
    }
  })

  router.get('/:id/files/*file', (req, res) => {
    const name = req.params.file.join('/')
    for (const kind of ['css', 'images']) {
      const index = req.widgetAssets[kind]?.indexOf(name) ?? -1
      if (index >= 0) {
        const file = req.widgetAssetFiles[kind][index]
        if (kind === 'css') {
          return res.type('css').send(sanitizeCss(fs.readFileSync(file, 'utf8')))
        }
        return res.type(path.extname(name)).sendFile(file)
      }
    }
    res.sendStatus(404)
  })

  router.get('/:id', (req, res) => {
    try {
      const files = req.widgetAssetFiles
      const read = file => fs.readFileSync(file, 'utf8')
      const js = files.js.length ? [`(${widgetApi})();`, ...files.js.map(read)].join('\n;\n') : ''
      // Asset text is a string argument, including when it contains </script>.
      const source = JSON.stringify(js).replace(/</g, '\\u003c')
      const nonce = randomBytes(16).toString('base64')
      res.set({
        'Content-Security-Policy': `sandbox allow-scripts; default-src 'none'; script-src 'nonce-${nonce}'; worker-src blob:; frame-ancestors 'self' ${appOrigin}; base-uri 'none'; form-action 'none'`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      })
      res.type('html').send(`<!doctype html><meta charset="utf-8"><script nonce="${nonce}">(${runAssets})(${source})</script>`)
    } catch {
      res.sendStatus(404)
    }
  })
}

module.exports = { assetFiles, mountWidgetAssets }
