import { TrzszFilter } from 'trzsz'

const {
  openDialog
} = window.api

window.newTrzsz = function (
  writeToTerminal,
  sendToServer,
  terminalColumns,
  isWindowsShell
) {
  // create a trzsz filter
  return new TrzszFilter({
    // write the server output to the terminal
    writeToTerminal,
    // send the user input to the server
    sendToServer,
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
        properties
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
    terminalColumns,
    // there is a windows shell
    isWindowsShell
  })
}
