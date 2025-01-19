import { getKeyCharacter } from './get-key-char.js'
import shortcutsDefaultsGen from './shortcuts-defaults.js'
import {
  isMacJs
} from '../../common/constants'

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
  Cls.prototype.handleKeyboardEvent = function (event) {
    const {
      code,
      ctrlKey,
      shiftKey,
      metaKey,
      altKey,
      wheelDeltaY,
      button,
      type,
      key
    } = event
    if (this.cmdAddon) {
      this.cmdAddon.handleKey(event)
    }

    if (
      this.term &&
      key === 'Backspace' &&
      type === 'keydown' &&
      !altKey &&
      !ctrlKey
    ) {
      this.props.onDelKeyPressed()
      const delKey = this.props.config.backspaceMode === '^?' ? 8 : 127
      const altDelDelKey = delKey === 8 ? 127 : 8
      const char = String.fromCharCode(shiftKey ? delKey : altDelDelKey)
      this.socket.send(char)
      return false
    } else if (
      this.term &&
      this.term.buffer.active.type === 'alternate'
    ) {
      return true
    }

    if (
      this.term &&
      key === 'c' &&
      type === 'keydown' &&
      !altKey &&
      !shiftKey &&
      ctrlKey &&
      this.onZmodem
    ) {
      this.onZmodemEnd()
    }

    let codeName
    if (type === 'mousedown' && button === 1) {
      codeName = 'mouseWheel'
    } else {
      codeName = event instanceof window.WheelEvent
        ? (wheelDeltaY > 0 ? 'mouseWheelUp' : 'mouseWheelDown')
        : code
    }

    const codeK = getKeyCharacter(codeName)

    const noControlKey = type !== 'mousedown' && !ctrlKey && !shiftKey && !metaKey && !altKey
    if (noControlKey) {
      return
    }
    const r = codeName === 'mouseWheel'
      ? 'mouseWheel'
      : (ctrlKey ? 'ctrl+' : '') +
      (metaKey ? 'meta+' : '') +
      (shiftKey ? 'shift+' : '') +
      (altKey ? 'alt+' : '') +
      codeK.toLowerCase()

    const shortcutsConfig = buildConfig(this.props.config, d => !d.hidden)
    const keys = Object.keys(shortcutsConfig)
    const len = keys.length

    if (this.term) {
      const qmMatch = window.store.quickCommands.find(d => d.shortcut === r)
      if (qmMatch) {
        window.store.runQuickCommandItem(qmMatch.id)
        return false
      }
    }

    for (let i = 0; i < len; i++) {
      const k = keys[i]
      const conf = shortcutsConfig[k]
      const funcName = conf.func + 'Shortcut'
      if (conf.shortcut.split(',').includes(r)) {
        if (this[funcName]) {
          return this[funcName](event)
        } else if (this.term && conf.readonly) {
          return true
        } else {
          return false
        }
      }
    }

    return !!this.term
  }
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
