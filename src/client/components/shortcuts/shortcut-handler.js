import { getKeyCharacter } from './get-key-char.js'
import shortcutsDefaultsGen from './shortcuts-defaults.js'
import {
  isMacJs
} from '../../common/constants'
import { throttle } from 'lodash-es'

function buildConfig (config, filter = d => d) {
  const defs = shortcutsDefaultsGen().filter(filter)
  const { shortcuts = {} } = config
  return defs.reduce((p, c) => {
    const propName = isMacJs ? 'shortcutMac' : 'shortcut'
    if (isMacJs && c.skipMac) {
      return p
    }
    const name = c.name + '_' + propName
    const [type, func] = c.name.split('_')
    return {
      ...p,
      [name]: {
        shortcut: c.readonly ? c[propName] : (shortcuts[name] || c[propName]),
        type,
        func,
        readonly: c.readonly
      }
    }
  }, {})
}

function buildConfigForSearch (config) {
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
  Cls.prototype.handleKeyboardEvent = throttle(function (event) {
    const {
      code,
      ctrlKey,
      shiftKey,
      metaKey,
      altKey,
      wheelDeltaY,
      type,
      key
    } = event
    if (key === 'Backspace' && this.isTerm && type === 'keydown') {
      this.socket.send(
        String.fromCharCode(
          shiftKey ? 127 : 8
        )
      )
      return false
    }
    const codeName = event instanceof window.WheelEvent
      ? (wheelDeltaY > 0 ? 'mouseWheelUp' : 'mouseWheelDown')
      : code
    const codeK = getKeyCharacter(codeName)
    const noControlKey = !ctrlKey && !shiftKey && !metaKey && !altKey
    if (noControlKey) {
      return
    }
    const r = (ctrlKey ? 'ctrl+' : '') +
      (metaKey ? 'meta+' : '') +
      (shiftKey ? 'shift+' : '') +
      (altKey ? 'alt+' : '') +
      codeK.toLowerCase()
    const shortcutsConfig = buildConfig(this.props.config, d => !d.hidden)
    const keys = Object.keys(shortcutsConfig)
    const len = keys.length
    for (let i = 0; i < len; i++) {
      const k = keys[i]
      const conf = shortcutsConfig[k]
      const funcName = conf.func + 'Shortcut'
      if (conf.shortcut.split(',').includes(r)) {
        if (this[funcName]) {
          return this[funcName](event)
        } else if (this.isTerm && conf.readonly) {
          return true
        } else {
          return false
        }
      }
    }
  }, 300)
  return Cls
}

export function shortcutDescExtend (Cls) {
  Cls.prototype.getShortcut = function (name) {
    const shortcutsConfig = buildConfigForSearch(this.props.config)
    const propName = isMacJs ? 'shortcutMac' : 'shortcut'
    const n = `${name}_${propName}`
    return shortcutsConfig[n].shortcut
  }
  return Cls
}
