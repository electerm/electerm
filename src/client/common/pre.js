
const {
  runSync,
  ipcOnEvent,
  ipcOffEvent,
  runGlobalAsync,
  getZoomFactor,
  setZoomFactor
} = window.api

const props = runSync('getConstants')

props.env = JSON.parse(props.env)
props.versions = JSON.parse(props.versions)

window.log = {
  debug: (...args) => runSync('debug', ...args),
  log: (...args) => runSync('log', ...args),
  error: (...args) => runSync('error', ...args),
  info: (...args) => runSync('info', ...args)
}
window.pre = {
  readFileSync: (...args) => {
    return runSync('readFileSync', ...args)
  },

  readClipboard: () => {
    return runSync('readClipboard')
  },

  writeClipboard: str => {
    return runSync('writeClipboard', str)
  },

  resolve: (...args) => runSync('resolve', ...args),
  join: (...args) => runSync('join', ...args),
  basename: (...args) => runSync('basename', ...args),
  showItemInFolder: (href) => runSync('showItemInFolder', href),
  ...props,
  ipcOnEvent,
  ipcOffEvent,

  getZoomFactor,
  setZoomFactor,
  openExternal: (url) => runSync('openExternal', url),

  osInfo: () => runSync('osInfo'),
  runGlobalAsync,
  runSync
}

const path = {
  resolve: window.pre.resolve,
  join: window.pre.join,
  basename: window.pre.basename
}

const fs = {
  existsSync: (...args) => {
    return runSync('existsSync', ...args)
  },
  statSync: (...args) => {
    const obj = runSync('statSync', ...args)
    obj.isDirectory = () => obj.isD
    obj.isFile = () => obj.isF
    return obj
  },
  accessSync: (...args) => {
    const r = runSync('accessSync', ...args)
    if (r) {
      throw new Error(r)
    }
  },
  openSync: (...args) => {
    return runSync('openSync', ...args)
  },
  readSync: (...args) => {
    return runSync('readSync', ...args)
  },
  closeSync: (...args) => {
    return runSync('closeSync', ...args)
  },
  readdirSync: (...args) => {
    return runSync('readdirSync', ...args)
  },
  mkdirSync: (...args) => {
    return runSync('mkdirSync', ...args)
  },
  writeSync: (...args) => {
    return runSync('writeSync', ...args)
  },
  realpathSync: (...args) => {
    return runSync('realpathSync', ...args)
  },
  constants: runSync('getFsContants')
}

window.reqs = {
  path,
  fs
}

function require (name) {
  return window.reqs[name]
}

require.resolve = name => name

window.require = require
