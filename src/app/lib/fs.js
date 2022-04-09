const promisifyAll = require('util-promisifyall')
const { spawn } = require('child_process')
const fs = require('original-fs')
const fss = promisifyAll(fs)
const log = require('../common/log')
const tar = require('tar')
const { isWin, isMac, tempDir } = require('../common/runtime-constants')
const uid = require('../common/uid')
const { isWinDrive } = require('../common/is-win-drive')
const path = require('path')
const ROOT_PATH = '/'

/**
 * run cmd
 * @param {string} cmd
 */
const run = (cmd) => {
  console.log('ggg', cmd)
  const { Bash } = require('node-bash')
  const ps = new Bash({
    executableOptions: {
      '--login': true
    }
  })
  return ps.invokeCommand(cmd)
    .then(s => s.stdout.toString())
}

/**
 * run windows cmd
 * @param {string} cmd
 */
const runWinCmd = (cmd) => {
  const { PowerShell } = require('node-powershell')
  const ps = new PowerShell({
    executableOptions: {
      '-ExecutionPolicy': 'Bypass',
      '-NoProfile': true
    }
  })
  return ps.invokeCommand(cmd)
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

/**
 * zip file
 * @param {string} localFolerPath absolute path of a folder
 */
const zipFolder = (localFolerPath) => {
  return new Promise((resolve, reject) => {
    const n = uid()
    const p = path.resolve(tempDir, `electerm-temp-${n}.tar.gz`)
    const cwd = path.dirname(localFolerPath)
    const file = path.basename(localFolerPath)
    try {
      tar.c({
        gzip: true,
        file: p,
        cwd
      }, [file], () => {
        resolve(p)
      })
    } catch (e) {
      log.error(e)
      reject(e)
    }
  })
}

/**
 * unzip file
 * @param {string} localFilePath absolute path of a zip file
 * @param {string} targetFolderPath absolute path of unzip target folder
 */
const unzipFile = (localFilePath, targetFolderPath) => {
  return new Promise((resolve, reject) => {
    try {
      tar.x({
        file: localFilePath,
        C: targetFolderPath
      }, () => {
        resolve(1)
      })
    } catch (e) {
      log.error(e)
      reject(e)
    }
  })
}

async function listWindowsRootPath () {
  const list = spawn('cmd')
  return new Promise((resolve, reject) => {
    list.stdout.on('data', function (data) {
      const output = String(data)
      const out = output.split('\r\n').map(e => e.trim()).filter(e => e !== '')
      if (out[0] === 'Name') {
        resolve(out.slice(1))
      }
    })

    list.stderr.on('data', function (data) {
      console.log('stderr: ' + data)
    })

    list.on('exit', function (code) {
      if (code !== 0) {
        reject(code)
      }
    })

    list.stdin.write('wmic logicaldisk get name\n')
    list.stdin.end()
  })
}

const fsExport = Object.assign(
  {},
  fss,
  {
    run,
    runWinCmd,
    rmrf,
    touch,
    cp,
    mv,
    openFile,
    zipFolder,
    unzipFile
  },
  {
    readdirAsync: (_path) => {
      if (_path === ROOT_PATH && isWin) {
        return listWindowsRootPath()
      }
      let path = _path
      if (isWin && isWinDrive(path)) {
        path = path + '\\'
      }
      return fss.readdirAsync(path)
    },
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

module.exports = {
  fsExport
}
