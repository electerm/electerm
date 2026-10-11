/**
 * Remember the last used directory for file dialogs.
 *
 * Electron 43 changed the default: when no `defaultPath` is given the dialog
 * now always opens in Downloads, and because Electron sets that directory
 * explicitly the OS stops restoring the last used directory between
 * invocations (see breaking-changes.md, "Behavior Changed: Dialog methods
 * default to Downloads directory"). This keeps that memory ourselves and feeds
 * it back as `defaultPath`, so dialogs open where the user last was.
 *
 * The store is injected so this stays testable without Electron or the db.
 */

const path = require('node:path')

// an open dialog and a save dialog usually point at different trees, so they
// remember separately; each also falls back to the other, so the first dialog
// of a kind is not stranded in Downloads when the other kind already knows a
// folder
const keys = {
  open: 'last-dialog-open-dir',
  save: 'last-dialog-save-dir'
}

const fallbackOrder = {
  open: [keys.open, keys.save],
  save: [keys.save, keys.open]
}

const isDirSelection = (opts) =>
  Array.isArray(opts.properties) && opts.properties.includes('openDirectory')

function createDialogLastDir ({ get, set, log }) {
  const readLastDir = async (kind) => {
    for (const key of fallbackOrder[kind]) {
      try {
        const dir = await get(key)
        if (dir) {
          return dir
        }
      } catch (e) {
        log.error(e)
      }
    }
    return undefined
  }

  // fire and forget: a dialog result must not be held up by a write, and a
  // storage failure must not turn a finished dialog into a rejected ipc call
  const rememberDir = (kind, dir) => {
    if (!dir) {
      return
    }
    return Promise.resolve()
      .then(() => set(keys[kind], dir))
      .catch(e => log.error(e))
  }

  // returns a copy of `args` with `defaultPath` filled in, or `args` unchanged
  // when there is nothing to add
  const withDefaultPath = async (args, kind) => {
    const opts = args[0] && typeof args[0] === 'object'
      ? args[0]
      : {}
    const remembered = await readLastDir(kind)
    let defaultPath = opts.defaultPath
    if (!defaultPath) {
      defaultPath = remembered
    } else if (remembered && !path.isAbsolute(defaultPath)) {
      // a bare file name such as "term.log": keep the name, but anchor it to
      // the folder we remember instead of letting it resolve against Downloads
      defaultPath = path.join(remembered, defaultPath)
    }
    if (!defaultPath) {
      return args
    }
    return [
      {
        ...opts,
        defaultPath
      },
      ...args.slice(1)
    ]
  }

  const rememberOpenResult = (opts, res) => {
    if (!res || !res.length || !res[0]) {
      return
    }
    return rememberDir(
      'open',
      isDirSelection(opts) ? res[0] : path.dirname(res[0])
    )
  }

  const rememberSaveResult = (res) => {
    if (!res || res.canceled || !res.filePath) {
      return
    }
    return rememberDir('save', path.dirname(res.filePath))
  }

  return {
    withDefaultPath,
    rememberOpenResult,
    rememberSaveResult
  }
}

module.exports = {
  createDialogLastDir,
  dialogLastDirKeys: keys
}
