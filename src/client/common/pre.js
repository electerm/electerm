import { TrzszFilter } from 'trzsz'

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
  readFileSync: (path) => {
    return runSync('readFileSync', path)
  },

  readClipboard: () => {
    return runSync('readClipboard')
  },

  writeClipboard: str => {
    return runSync('writeClipboard', str)
  },

  resolve: (...args) => runSync('resolve', ...args),
  showItemInFolder: (href) => runSync('showItemInFolder', href),
  ...props,
  ipcOnEvent,
  ipcOffEvent,

  getZoomFactor,
  setZoomFactor,
  lookup: (...args) => runSync('lookup', ...args),
  openExternal: (url) => runSync('openExternal', url),

  osInfo: () => runSync('osInfo'),
  runGlobalAsync,
  runSync
}
