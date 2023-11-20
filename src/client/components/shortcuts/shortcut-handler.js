import { getKeyCharacter } from './get-key-char.js'
import shortcutsDefaultsGen from './shortcuts-defaults.js'
import {
  isMacJs
} from '../../common/constants'

function buildConfig (config) {
  const defs = shortcutsDefaultsGen()
  const { shortcuts = {} } = config
  return defs.reduce((p, c) => {
    const propName = isMacJs ? 'shortcutMac' : 'shortcut'
    const name = c.name + '_' + propName
    const [type, func] = c.name.split('_')
    return {
      ...p,
      [name]: {
        shortcut: c.readonly ? c[propName] : (shortcuts[name] || c[propName]),
        type,
        func
      }
    }
  }, {})
}

export function shortcutExtend (Cls) {
  Cls.prototype.handleKeyboardEvent = function (event) {
    const {
      code,
      ctrlKey,
      shiftKey,
      metaKey,
      altKey
    } = event
    const codeK = getKeyCharacter(code)
    const noControlKey = !ctrlKey && !shiftKey && !metaKey && !altKey
    if (noControlKey) {
      return
    }
    const r = (ctrlKey ? 'ctrl+' : '') +
      (metaKey ? 'meta+' : '') +
      (shiftKey ? 'shift+' : '') +
      (altKey ? 'alt+' : '') +
      codeK.toLowerCase()
    const shortcutsConfig = buildConfig(this.props.config)
    const keys = Object.keys(shortcutsConfig)
    const len = keys.length
    for (let i = 0; i < len; i++) {
      const k = keys[i]
      const conf = shortcutsConfig[k]
      const funcName = conf.func + 'Shortcut'
      if (conf.shortcut.split(',').includes(r)) {
        if (this[funcName]) {
          this[funcName](event)
        } else {
          return false
        }
      }
    }
  }
  return Cls
}

export function shortcutDescExtend (Cls) {
  Cls.prototype.getShortcut = function (name) {
    const shortcutsConfig = buildConfig(this.props.config)
    const propName = isMacJs ? 'shortcutMac' : 'shortcut'
    const n = `${name}_${propName}`
    return shortcutsConfig[n].shortcut
  }
  return Cls
}
