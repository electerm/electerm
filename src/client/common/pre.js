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

// Encoding function
function encodeUint8Array (uint8Array) {
  let str = ''
  const len = uint8Array.byteLength

  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(uint8Array[i])
  }

  return btoa(str)
}

// Decoding function
function decodeBase64String (base64String) {
  const str = atob(base64String)
  const len = str.length

  const uint8Array = new Uint8Array(len)

  for (let i = 0; i < len; i++) {
    uint8Array[i] = str.charCodeAt(i)
  }

  return uint8Array
}

window.log = {
  debug: (...args) => runSync('debug', ...args),
  log: (...args) => runSync('log', ...args),
  error: (...args) => runSync('error', ...args),
  info: (...args) => runSync('info', ...args)
}

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

const fs = {
  stat: (path, cb) => {
    window.fs.statCustom(path)
      .catch(err => cb(err))
      .then(obj => {
        obj.isDirectory = () => obj.isD
        obj.isFile = () => obj.isF
        cb(undefined, obj)
      })
  },
  access: (...args) => {
    const cb = args.pop()
    window.fs.access(...args)
      .then((data) => cb(undefined, data))
      .catch((err) => cb(err))
  },
  open: (...args) => {
    const cb = args.pop()
    window.fs.openCustom(...args)
      .then((data) => cb(undefined, data))
      .catch((err) => cb(err))
  },
  read: (p1, arr, ...args) => {
    const cb = args.pop()
    window.fs.readCustom(
      p1,
      arr.length,
      ...args
    )
      .then((data) => {
        const { n, newArr } = data
        const newArr1 = decodeBase64String(newArr)
        cb(undefined, n, newArr1)
      })
      .catch(err => cb(err))
  },
  close: (fd, cb) => {
    window.fs.closeCustom(fd)
      .then((data) => cb(undefined, data))
      .catch((err) => cb(err))
  },
  readdir: (p, cb) => {
    window.fs.readdir(p)
      .then((data) => cb(undefined, data))
      .catch((err) => cb(err))
  },
  mkdir: (...args) => {
    const cb = args.pop()
    window.fs.mkdir(...args)
      .then((data) => cb(undefined, data))
      .catch((err) => cb(err))
  },
  write: (p1, buf, cb) => {
    window.fs.writeCustom(p1, encodeUint8Array(buf))
      .then((data) => cb(undefined, data))
      .catch((err) => cb(err))
  },
  realpath: (p, cb) => {
    window.fs.realpath(p)
      .then((data) => cb(undefined, data))
      .catch((err) => cb(err))
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
