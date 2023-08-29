import { TrzszFilter } from '@electerm/trzsz'

const {
  runSync,
  ipcOnEvent,
  ipcOffEvent,
  runGlobalAsync,
  getZoomFactor,
  setZoomFactor,
  openDialog
} = window.api

const props = runSync('getConstants')

props.env = JSON.parse(props.env)
props.versions = JSON.parse(props.versions)

window.newTrzsz = function (
  writeToTerminal,
  sendToServer,
  terminalColumns,
  isWindowsShell
) {
  // create a trzsz filter
  return new TrzszFilter({
    // write the server output to the terminal
    writeToTerminal: writeToTerminal,
    // send the user input to the server
    sendToServer: sendToServer,
    // choose some files to be sent to the server
    chooseSendFiles: async (directory) => {
      const properties = [
        'openFile',
        'multiSelections',
        'showHiddenFiles',
        'noResolveAliases',
        'treatPackageAsDirectory',
        'dontAddToRecent'
      ]
      if (directory) {
        properties.push('openDirectory')
      }
      return openDialog({
        title: 'Choose some files to send',
        message: 'Choose some files to send',
        properties: properties
      })
    },
    // choose a directory to save the received files
    chooseSaveDirectory: async () => {
      const savePaths = await openDialog({
        title: 'Choose a folder to save file(s)',
        message: 'Choose a folder to save file(s)',
        properties: [
          'openDirectory',
          'showHiddenFiles',
          'createDirectory',
          'noResolveAliases',
          'treatPackageAsDirectory',
          'dontAddToRecent'
        ]
      })
      if (!savePaths || !savePaths.length) {
        return undefined
      }
      return savePaths[0]
    },
    // the terminal columns
    terminalColumns: terminalColumns,
    // there is a windows shell
    isWindowsShell: isWindowsShell
  })
}

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

window.require = require
