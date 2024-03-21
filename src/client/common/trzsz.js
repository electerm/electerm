import { TrzszFilter } from 'trzsz'
import { chooseSaveDirectory } from './choose-save-folder'

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
    chooseSaveDirectory,
    // the terminal columns
    terminalColumns,
    // there is a windows shell
    isWindowsShell
  })
}
