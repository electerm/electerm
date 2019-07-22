global.Promise = require('bluebird')

const { exec } = require('child_process')
const fs = require('original-fs')
const fss = Promise.promisifyAll(fs)
const log = require('../utils/log')
const { isWin, isMac } = require('../utils/constants')
/**
 * run cmd
 * @param {string} cmd
 */
const run = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        reject(err)
      } else if (stderr) {
        reject(stderr)
      } else {
        resolve(stdout)
      }
    })
  })
}

/**
 * run windows cmd
 * @param {string} cmd
 */
const runWinCmd = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(
      'powershell.exe',
      [`-command ${cmd}`],
      (err, stdout, stderr) => {
        if (err) {
          reject(err)
        } else if (stderr) {
          reject(stderr)
        }
        resolve(stdout)
      })
  })
}

/**
 * rm -rf directory
 * @param {string} localFolderPath absolute path of directory
 */
const rmrf = (localFolderPath) => {
  const cmd = isWin
    ? `Remove-Item "${localFolderPath}" -Force -Recurse -ErrorAction SilentlyContinue`
    : `rm -rf "${localFolderPath}"`
  return isWin ? runWinCmd(cmd) : run(cmd)
}

/**
 * mv from to
 * @param {string} localFolderPath absolute path of directory
 */
const mv = (from, to) => {
  const cmd = isWin
    ? `Move-Item "${from}" "${to}"`
    : `mv "${from}" "${to}"`
  return isWin ? runWinCmd(cmd) : run(cmd)
}

/**
 * cp from to
 * @param {string} localFolderPath absolute path of directory
 */
const cp = (from, to) => {
  const cmd = isWin
    ? `Copy-Item "${from}" -Destination "${to}" -Recurse`
    : `cp -r "${from}" "${to}"`
  return isWin ? runWinCmd(cmd) : run(cmd)
}

/**
 * touch file
 * @param {string} localFolderPath absolute path
 */
const touch = (localFilePath) => {
  return fss.writeFileAsync(localFilePath, '')
}

/**
 * open file
 * @param {string} localFolderPath absolute path
 */
const openFile = (localFilePath) => {
  let cmd
  if (isWin) {
    cmd = `Invoke-Item "${localFilePath}"`
    return runWinCmd(cmd)
  }
  cmd = (isMac
    ? 'open'
    : 'xdg-open') +
    ` "${localFilePath}"`
  return run(cmd)
}

const fsExport = Object.assign(
  {},
  fss,
  {
    rmrf,
    touch,
    cp,
    mv,
    openFile
  },
  {
    statAsync: (...args) => {
      return fss.statAsync(...args)
        .then(res => {
          return Promise.resolve(Object.assign(res, {
            isDirectory: res.isDirectory()
          }))
        })
    },
    lstatAsync: (...args) => {
      return fss.lstatAsync(...args)
        .then(res => {
          return Promise.resolve(Object.assign(res, {
            isDirectory: res.isDirectory(),
            isSymbolicLink: res.isSymbolicLink()
          }))
        })
    },
    readFile: (...args) => {
      return fss.readFileAsync(...args)
        .then(res => {
          return res.toString()
        })
    },
    readFileAsBase64: (...args) => {
      return fss.readFileAsync(...args)
        .then(res => {
          return res.toString('base64')
        })
    },
    writeFile: (path, txt, mode) => {
      return fss.writeFileAsync(path, txt, { mode })
        .then(() => true)
        .catch((e) => {
          log.error('fs.writeFile', e)
          return false
        })
    }
  }
)

const fsFunctions = [
  'accessAsync',
  'statAsync',
  'lstatAsync',
  'cp',
  'mv',
  'mkdirAsync',
  'touch',
  'chmodAsync',
  'renameAsync',
  'unlinkAsync',
  'rmrf',
  'readdirAsync',
  'readFile',
  'readFileAsBase64',
  'writeFile',
  'openFile'
]

module.exports = {
  fsExport,
  fsFunctions
}
