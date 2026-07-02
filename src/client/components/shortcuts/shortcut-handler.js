import { getKeyCharacter } from './get-key-char.js'
import shortcutsDefaultsGen from './shortcuts-defaults.js'
import {
  isMacJs
} from '../../common/constants'
import keyControlPressed from '../../common/key-control-pressed.js'

function processEscapeSequences (text) {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && i + 1 < text.length) {
      const next = text[i + 1]
      if (next === 'n') {
        result += '\n'
      } else if (next === 't') {
        result += '\t'
      } else if (next === 'r') {
        result += '\r'
      } else if (next === '\\') {
        result += '\\'
      } else {
        result += '\\' + next
      }
      i++
    } else {
      result += text[i]
    }
  }
  return result
}

function sendInputData (ctx, data) {
  if (!data) return
  if (ctx.attachAddon && ctx.attachAddon._sendData) {
    ctx.attachAddon._sendData(data)
  }
  // if (!ctx.onData) return
  // if (splitChars) {
  //   for (const ch of data) {
  //     ctx.onData(ch)
  //   }
  //   return
  // }
  // ctx.onData(data)
}

function getSelectionReplaceInfo (term) {
  if (!term || !term.hasSelection()) return null
  if (term.buffer?.active?.type === 'alternate') return null
  const getPos = term.getSelectionPosition?.bind(term)
  if (!getPos) return null
  const pos = getPos()
  if (!pos || !pos.start || !pos.end) return null
  const buffer = term.buffer.active
  const cursorY = buffer.cursorY
  if (pos.start.y !== cursorY || pos.end.y !== cursorY) return null
  const startX = Math.min(pos.start.x, pos.end.x)
  const endX = Math.max(pos.start.x, pos.end.x)
  if (startX === endX) return null
  return {
    startX,
    endX,
    cursorX: buffer.cursorX
  }
}

export function handleTerminalSelectionReplace (event, ctx) {
  if (
    !ctx.term ||
    !ctx.term.hasSelection() ||
    keyControlPressed(event)
  ) {
    return false
  }
  const { key } = event
  const isBackspace = key === 'Backspace'
  const isDelete = key === 'Delete'
  const isPrintable = key && key.length === 1
  if (!isBackspace && !isDelete && !isPrintable) return false

  const info = getSelectionReplaceInfo(ctx.term)
  if (!info) return false

  if (event && event.preventDefault) {
    event.preventDefault()
  }
  if (event && event.stopPropagation) {
    event.stopPropagation()
  }

  const { startX, endX, cursorX } = info
  const move = startX - cursorX
  if (move > 0) {
    sendInputData(ctx, '\x1b[C'.repeat(move))
  } else if (move < 0) {
    sendInputData(ctx, '\x1b[D'.repeat(-move))
  }

  const delCount = endX - startX
  if (delCount > 0) {
    sendInputData(ctx, '\x1b[3~'.repeat(delCount))
  }

  if (isPrintable) {
    sendInputData(ctx, key)
  }

  ctx.term.clearSelection()
  ctx.term.scrollToBottom()
  return true
}

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

function isInAntdInput () {
  const activeElement = document.activeElement
  return activeElement && activeElement.classList.contains('shortcut-input')
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
    if (isInAntdInput()) {
      return
    }
    // During IME composition, let xterm handle the event through its
    // CompositionHelper. Intercepting here breaks composition (e.g. first
    // char lost, closing bracket duplicated when typing Chinese inside brackets).
    if (event.isComposing) {
      return
    }
    if (handleTerminalSelectionReplace(event, this)) {
      return false
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
      this.term.scrollToBottom()
      return false
    } else if (
      this.term &&
      key === 'Enter' &&
      type === 'keydown' &&
      shiftKey &&
      !ctrlKey &&
      !altKey &&
      !metaKey
    ) {
      event.preventDefault()
      event.stopPropagation()
      const shiftEnterText = processEscapeSequences(this.props.config.shiftEnterMode || '\\n')
      this.socket.send(shiftEnterText)
      this.term.scrollToBottom()
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
      ctrlKey
    ) {
      // Cancel zmodem transfer if active
      if (this.zmodemClient && this.zmodemClient.isActive) {
        this.zmodemClient.cancel()
        return false
      }
      // Cancel trzsz transfer if active
      if (this.trzszClient && this.trzszClient.isActive) {
        this.trzszClient.cancel()
        return false
      }
      // Cancel xmodem transfer if active
      if (this.xmodemClient && this.xmodemClient.isActive) {
        this.xmodemClient.cancel()
        return false
      }
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
