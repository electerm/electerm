import { isMacJs as isMac } from '../../common/constants.js'
import shortcutsDefaultsGen from './shortcuts-defaults'

/**
 * Get keys taken data for shortcut conflict checking
 * @returns {object} Object with shortcut strings as keys and true as values
 */
export function getKeysTakenData () {
  const { store } = window
  const { config, quickCommands } = store
  const { shortcuts = {} } = config

  // Get shortcuts defaults
  const shortcutsDefaults = shortcutsDefaultsGen()

  // Gather system shortcuts
  const systemShortcuts = shortcutsDefaults.reduce((p, k) => {
    const propName = isMac ? 'shortcutMac' : 'shortcut'
    const name = k.name + '_' + propName
    const vv = k.readonly ? k[propName] : (shortcuts[name] || k[propName])
    if (!vv) return p

    const v = vv
      .split(',')
      .map(f => f.trim())
      .reduce((p, k) => ({
        ...p,
        [k]: true
      }), {})
    return {
      ...p,
      ...v
    }
  }, {})

  // Gather quick command shortcuts
  const quickCommandShortcuts = quickCommands.reduce((acc, command) => {
    if (command.shortcut) {
      acc[command.shortcut] = true
    }
    return acc
  }, {})

  // Combine system shortcuts and quick command shortcuts
  return {
    ...systemShortcuts,
    ...quickCommandShortcuts
  }
}
