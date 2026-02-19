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

window.pre = {
  requireAuth: runSync('shouldAuth'),
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

window.reqs = {
  path
}

function require (name) {
  return window.reqs[name]
}

require.resolve = name => name

window.require = require
