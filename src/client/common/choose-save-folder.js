import { getItem, setItem } from './safe-local-storage.js'

const {
  openDialog
} = window.api

export const lastSaveFolderKey = 'last-save-folder'

/**
 * Open a folder select dialog, remembers last selected folder in
 * localStorage and uses it as next dialog's defaultPath.
 * Pass `defaultPath` to override the remembered one.
 * @param {Object} opts extra openDialog options
 * @returns {Promise<string|undefined>} selected folder path
 */
export async function chooseSaveDirectory (opts = {}) {
  const {
    defaultPath,
    ...rest
  } = opts
  const savePaths = await openDialog({
    title: 'Choose a folder to save file(s)',
    message: 'Choose a folder to save file(s)',
    defaultPath: defaultPath || getItem(lastSaveFolderKey) || undefined,
    properties: [
      'openDirectory',
      'showHiddenFiles',
      'createDirectory',
      'noResolveAliases',
      'treatPackageAsDirectory',
      'dontAddToRecent'
    ],
    ...rest
  })
  if (!savePaths || !savePaths.length) {
    return undefined
  }
  if (savePaths[0]) {
    setItem(lastSaveFolderKey, savePaths[0])
  }
  return savePaths[0]
}
