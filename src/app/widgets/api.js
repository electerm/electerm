/**
 * The only door between a widget's server script and the host.
 *
 * A widget's main.js runs in the host's node process: the Electron main process
 * on desktop, the express server in the web app. Before this module existed
 * every widget reached for `require('electron')` — insertCSS, safeStorage,
 * shell, session — which is fine on desktop and impossible in the web app, so
 * six of the widgets under ~/dev could only ever run in the desktop build.
 *
 * So: widgets require '@electerm/widget-api' (a shim the loader writes into
 * their folder, see ./api-entry.js) and get this object. Each capability
 * is answered by the platform backend:
 *
 *   desktop  electronBackend  (Notification, safeStorage, shell, ...)
 *   tests    webBackend       nothing native, every capability reports false
 *
 * The plan for the web app is the same object with its own backend (a browser
 * has no native dialog or keychain, so those would report "not available"
 * instead of failing with module-not-found deep inside a widget); until that
 * server installs one, this file only has to serve the desktop app.
 *
 * `api.css` is deliberately platform-neutral: it edits the running instance's
 * css and the renderer applies it (see ./css-bus.js). A widget that only
 * restyles the app therefore needs no platform knowledge at all — and a widget
 * that has a UI does not even need this module: window.electerm.css does it in
 * the client.
 *
 * Everything is JSON-serialisable or a string; nothing here hands a widget a
 * handle to an electron object.
 */

const fs = require('fs')
const path = require('path')
const widgetLog = require('./instance-log')
const {
  resolveUserWidgetDir,
  isInside
} = require('./paths')

// widgetId -> instanceId, so api.log lands in the log file the widget manager
// shows. A widget may log before its instance exists; those lines go to
// <widgetId>.log instead of being dropped.
const instances = new Map()

let backend = null

// Set by ./load-widget.js once, at require time. The css belongs to the running
// instance, which lives there, so this module only forwards: no store here.
let cssHandlers = null

function configureCss (handlers) {
  cssHandlers = handlers || null
}

function cssHost () {
  if (!cssHandlers) {
    throw new Error('widget api css is not available: the widget loader is not running')
  }
  return cssHandlers
}

function electronBackend () {
  // required lazily: this file is also loaded by unit tests and by the web app,
  // where electron does not exist at all
  const {
    Notification,
    clipboard,
    dialog,
    safeStorage,
    shell
  } = require('electron')
  return {
    name: 'electron',
    isWebApp: false,
    platform: process.platform,
    capabilities: {
      css: true,
      notify: true,
      openExternal: true,
      clipboard: true,
      dialog: true,
      secret: true,
      net: true
    },
    notify ({ title, message }) {
      new Notification({
        title: title || 'electerm',
        body: message || ''
      }).show()
    },
    openExternal (url) {
      return shell.openExternal(url)
    },
    clipboardRead () {
      return clipboard.readText()
    },
    clipboardWrite (text) {
      clipboard.writeText(text)
    },
    dialogOpen (opts = {}) {
      return dialog.showOpenDialog(opts)
    },
    dialogSave (opts = {}) {
      return dialog.showSaveDialog(opts)
    },
    secretAvailable () {
      return safeStorage.isEncryptionAvailable()
    },
    secretEncrypt (text) {
      return safeStorage.encryptString(text).toString('base64')
    },
    secretDecrypt (data) {
      return safeStorage.decryptString(Buffer.from(data, 'base64'))
    },
    // Electron's own proxy resolver: a desktop VPN normally configures the
    // system proxy, which node cannot see, so a widget that makes its own
    // requests would otherwise go out direct and be refused.
    resolveProxy (url) {
      const { session } = require('electron')
      return session.defaultSession.resolveProxy(url)
    }
  }
}

/**
 * No electron: everything native is reported unavailable instead of thrown as
 * module-not-found. Unit tests use it as the "nothing native here" backend; it
 * is also the shape a web server would install, where a browser can be given no
 * native dialog or keychain by the machine that runs the server.
 */
function webBackend () {
  return {
    name: 'web',
    isWebApp: true,
    platform: process.platform,
    capabilities: {
      css: true,
      notify: false,
      openExternal: false,
      clipboard: false,
      dialog: false,
      secret: false,
      net: false
    }
  }
}

function defaultBackend () {
  try {
    return electronBackend()
  } catch (e) {
    return webBackend()
  }
}

function getBackend () {
  if (!backend) {
    backend = defaultBackend()
  }
  return backend
}

// Called once at host startup (desktop: ipc.js, web: the server's init path).
function configureBackend (be) {
  backend = be || defaultBackend()
  return backend
}

// `gate` is the capability flag, `method` the backend function behind it. One
// message shape for every refusal, so a widget author reads why instead of
// digging through a stack that ends in a missing module.
function backendCall (gate, method, hint, ...args) {
  const be = getBackend()
  const fn = be[method]
  if (be.capabilities[gate] && typeof fn === 'function') {
    return fn.apply(be, args)
  }
  const where = be.isWebApp ? 'in the web app' : 'on this host'
  throw new Error(
    `widget api ${method} is not available ${where}` + (hint ? `; ${hint}` : '')
  )
}

function currentInstance (widgetId) {
  return instances.get(widgetId) || widgetId
}

function bindInstance (widgetId, instanceId) {
  if (instanceId) {
    instances.set(widgetId, instanceId)
  }
}

function unbindInstance (widgetId, instanceId) {
  if (!instanceId || instances.get(widgetId) === instanceId) {
    instances.delete(widgetId)
  }
}

function cssFile (widgetId, rel) {
  if (typeof rel !== 'string' || !rel) {
    throw new Error('css.applyFile needs a file path inside the widget folder')
  }
  let dir
  try {
    dir = resolveUserWidgetDir(widgetId)
  } catch (e) {
    throw new Error(`css.applyFile is only available to user widgets: ${e.message}`)
  }
  const file = path.resolve(dir, rel)
  if (!isInside(dir, file)) {
    throw new Error(`css.applyFile must stay inside the widget folder: ${rel}`)
  }
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (e) {
    throw new Error(`cannot read ${rel}: ${e.message}`)
  }
}

/**
 * The object a widget gets. Built once per widget folder — a widget's own
 * exports share one module instance, so they share one api, and the instanceId
 * it logs to is looked up at call time (an instance can be stopped and started
 * again without re-importing the module).
 */
function createWidgetApi (widgetId) {
  if (typeof widgetId !== 'string' || !widgetId) {
    throw new Error('widget api needs a widget id')
  }
  const be = getBackend()
  const logger = () => widgetLog.loggerFor(currentInstance(widgetId))

  const api = {
    id: widgetId,
    isWebApp: be.isWebApp,
    platform: be.platform,
    capabilities: { ...be.capabilities },

    // Same two sinks a widget already got through widgetRun(config, ctx);
    // available anywhere in the module now, not only inside the ctx closure.
    log (levelOrMsg, ...rest) {
      logger().log(levelOrMsg, ...rest)
    },
    event (evt) {
      logger().event(evt)
    },

    css: {
      apply (css) {
        return cssHost().apply(widgetId, css)
      },
      // reads a stylesheet shipped in the widget folder, e.g. 'style.css'
      applyFile (rel) {
        return cssHost().apply(widgetId, cssFile(widgetId, rel))
      },
      remove () {
        return cssHost().remove(widgetId)
      },
      get () {
        return cssHost().get(widgetId)
      }
    },

    notify (opts) {
      const conf = opts && typeof opts === 'object'
        ? opts
        : { message: String(opts == null ? '' : opts) }
      return backendCall('notify', 'notify', 'use window.electerm in a widget UI for a client-side notice', conf)
    },
    openExternal (url) {
      return backendCall('openExternal', 'openExternal', 'open the link from the widget UI instead', String(url))
    },
    clipboard: {
      read () {
        return backendCall('clipboard', 'clipboardRead')
      },
      write (text) {
        return backendCall('clipboard', 'clipboardWrite', null, String(text == null ? '' : text))
      }
    },
    dialog: {
      open (opts) {
        return backendCall('dialog', 'dialogOpen', 'use a widget UI with window.electerm.openDialog', opts || {})
      },
      save (opts) {
        return backendCall('dialog', 'dialogSave', 'use a widget UI with window.electerm.saveDialog', opts || {})
      }
    },
    secret: {
      available () {
        const be2 = getBackend()
        return !!(
          be2.capabilities.secret &&
          typeof be2.secretAvailable === 'function' &&
          be2.secretAvailable()
        )
      },
      encrypt (text) {
        return backendCall('secret', 'secretEncrypt', 'a browser has no OS keychain', String(text))
      },
      decrypt (data) {
        return backendCall('secret', 'secretDecrypt', 'a browser has no OS keychain', String(data))
      }
    },
    net: {
      // "PROXY 127.0.0.1:10808; DIRECT" when a system proxy is configured.
      // Only the host can answer: node reads no OS proxy setting.
      resolveProxy (url) {
        return backendCall(
          'net',
          'resolveProxy',
          'the web app has no system proxy of its own; set HTTPS_PROXY there',
          String(url)
        )
      }
    }
  }
  return Object.freeze(api)
}

// The shim written into a widget folder calls this. Set at load so it exists
// before any widget module is evaluated.
globalThis.__electermWidgetApiFactory = createWidgetApi

module.exports = {
  createWidgetApi,
  configureBackend,
  configureCss,
  electronBackend,
  webBackend,
  bindInstance,
  unbindInstance,
  currentInstance
}
