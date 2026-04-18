/**
 * fs through ws
 */
import fetch from './fetch-from-server'

const fsFunctions = typeof window.pre.fsFunctions === 'undefined' ? window.et.fsFunctions : window.pre.fsFunctions

const fs = fsFunctions.reduce((prev, func) => {
  prev[func] = (...args) => {
    return fetch({
      action: 'fs',
      args,
      func
    })
  }
  return prev
}, {})

// Encoding function
fs.encodeUint8Array = (uint8Array) => {
  let str = ''
  const len = uint8Array.byteLength

  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(uint8Array[i])
  }

  return btoa(str)
}

// Decoding function
fs.decodeBase64String = (base64String) => {
  const str = atob(base64String)
  const len = str.length

  const uint8Array = new Uint8Array(len)

  for (let i = 0; i < len; i++) {
    uint8Array[i] = str.charCodeAt(i)
  }

  return uint8Array
}

Object.assign(fs, {
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
        const newArr1 = window.fs.decodeBase64String(newArr)
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
    window.fs.writeCustom(p1, window.fs.encodeUint8Array(buf))
      .then((data) => cb(undefined, data))
      .catch((err) => cb(err))
  },
  realpath: (p, cb) => {
    window.fs.realpath(p)
      .then((data) => cb(undefined, data))
      .catch((err) => cb(err))
  }
})

window.fs = fs

export default fs
