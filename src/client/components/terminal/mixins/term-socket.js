import { pick } from 'lodash-es'
import clone from '../../../common/to-simple-obj.js'
import deepCopy from 'json-deep-copy'
import {
  statusMap,
  typeMap,
  isWin,
  isMac,
  terminalSerialType,
  paneMap
} from '../../../common/constants.js'
import getProxy from '../../../common/get-proxy.js'
import { refs } from '../../common/ref.js'
import { createTerm, resizeTerm } from '../terminal-apis.js'
import { ZmodemClient } from '../zmodem-client.js'
import { TrzszClient } from '../trzsz-client.js'
import { XmodemClient } from '../xmodem-client.js'
import { loadWebLinksAddon } from '../xterm-loader.js'
import { KeywordHighlighterAddon } from '../highlight-addon.js'
import {
  createSshReloadState,
  getAlternateBufferSnapshot,
  shouldCaptureSshReloadState
} from '../ssh-reload-state.js'

// Expands \n \t \r \\ and \xHH hex byte escapes, used to let users type
// control bytes (e.g. \x01 = Ctrl+A) in the serial "closeSequence" field.
function expandCloseSequence (text) {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && i + 1 < text.length) {
      const next = text[i + 1]
      if (next === 'n') {
        result += '\n'
        i++
      } else if (next === 't') {
        result += '\t'
        i++
      } else if (next === 'r') {
        result += '\r'
        i++
      } else if (next === '\\') {
        result += '\\'
        i++
      } else if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(text.slice(i + 2, i + 4))) {
        result += String.fromCharCode(parseInt(text.slice(i + 2, i + 4), 16))
        i += 3
      } else {
        result += text[i]
      }
    } else {
      result += text[i]
    }
  }
  return result
}

/**
 * Session lifecycle: opening the pty/ssh session over its websocket, error
 * and reconnect handling, input broadcast, and the screen snapshot used to
 * restore an ssh session after a reload.
 */
export const socketMixin = {
  buildWsUrl (port) {
    const { host, tokenElecterm } = this.props.config
    const { id } = this.props.tab
    if (window.et.buildWsUrl) {
      return window.et.buildWsUrl(
        host,
        port,
        tokenElecterm,
        id
      )
    }
    return `ws://${host}:${port}/terminals/${id}?token=${tokenElecterm}`
  },

  async remoteInit (term = this.term) {
    this.setState({
      loading: true,
      terminalError: null
    })
    const { cols, rows } = term
    const { config } = this.props
    const {
      keywords = []
    } = config
    const { logName } = this.props
    const tab = window.store.applyProfileToTabs(deepCopy(this.props.tab || {}))
    const {
      srcId, from = 'bookmarks',
      type,
      term: terminalType,
      displayRaw,
      id
    } = tab
    const { savePassword } = this.state
    const termType = type
    const extra = this.props.sessionOptions
    // Determine if this is a local terminal (no host)
    const isLocalType = !tab.host
    // Build exec settings: only for local type, prefer tab settings over config
    let execOpts = {}
    let execPropName = 'execLinux'
    if (isWin) {
      execPropName = 'execWindows'
    } else if (isMac) {
      execPropName = 'execMac'
    }
    if (isLocalType) {
      // Check flat properties on tab first (bookmark data), then fall back to config
      if (tab[execPropName]) {
        // Use bookmark's exec setting directly
        execOpts = {
          [execPropName]: tab[execPropName],
          [`${execPropName}Args`]: tab[`${execPropName}Args`] || []
        }
      } else if (config[execPropName]) {
        // Use global config exec settings
        execOpts = {
          [execPropName]: config[execPropName],
          [`${execPropName}Args`]: config[`${execPropName}Args`] || []
        }
      }
    }
    const keepaliveInterval = tab.keepaliveInterval || config.keepaliveInterval
    const opts = clone({
      cols,
      rows,
      term: terminalType || config.terminalType,
      saveTerminalLogToFile: config.saveTerminalLogToFile,
      ...tab,
      ...extra,
      ...execOpts,
      logName,
      sessionLogPath: this.state.logPath,
      ...pick(config, [
        'addTimeStampToTermLog',
        'keepaliveCountMax',
        'keyword2FA',
        'debug'
      ]),
      keepaliveInterval,
      tabId: id,
      uid: id,
      srcTabId: tab.id,
      termType,
      readyTimeout: config.sshReadyTimeout,
      proxy: getProxy(tab, config),
      type: tab.host
        ? typeMap.remote
        : typeMap.local
    })
    // Renderer-only state can contain a large serialized screen and must not
    // cross the process boundary as part of the SSH connection options.
    delete opts._reloadState
    const isAutoReconnect = !!(tab.autoReConnect && this.props.config.autoReconnectTerminal)
    const r = await createTerm(opts)
      .catch(err => {
        if (!isAutoReconnect) {
          const text = err.message
          this.handleError({ message: text, from, srcId })
        }
      })
    // Guard: component was unmounted while createTerm was pending.
    // The child process is already running; connect briefly to trigger its cleanup.
    if (this.onClose) {
      if (r && r.port) {
        try {
          const tmpSock = new WebSocket(this.buildWsUrl(r.port))
          tmpSock.onopen = () => tmpSock.close()
        } catch (_e) {}
      }
      return
    }
    if (typeof r === 'string' && r.includes('fail')) {
      return this.promote()
    }
    if (savePassword) {
      window.store.editItem(srcId, extra, from)
    }
    this.setState({
      loading: false
    })
    if (!r) {
      if (isAutoReconnect) {
        this.scheduleAutoReconnect(3000)
        return
      }
      this.setStatus(statusMap.error)
      return
    }
    this.port = r.port
    this.setStatus(statusMap.success)
    refs.get('sftp-' + id)?.initData(id, r.port)
    term.pid = id
    this.pid = id
    const wsUrl = this.buildWsUrl(r.port)
    const socket = new WebSocket(wsUrl)
    socket.onclose = this.oncloseSocket
    socket.onerror = this.onerrorSocket
    this.socket = socket
    this.initSocketEvents()
    this.term = term
    socket.onopen = async () => {
      await this.initAttachAddon()
      this.startupQueue.runInitScript()
    }
    // term.onRrefresh(this.onRefresh)
    term.onResize(this.onResizeTerminal)
    // xterm 6.x exposes buffer change as a public event (IBufferNamespace.onBufferChange).
    // Previously this reached into the private _onBufferChange._listeners array.
    term.buffer.onBufferChange(this.onBufferChange)
    const WebLinksAddon = await loadWebLinksAddon()
    term.loadAddon(new WebLinksAddon(this.webLinkHandler))
    term.focus()
    this.zmodemClient = new ZmodemClient(this)
    this.zmodemClient.init(socket)
    this.trzszClient = new TrzszClient(this)
    this.trzszClient.init(socket)
    this.xmodemClient = new XmodemClient(this)
    this.xmodemClient.init(socket)
    // 仅在可见时 fit，隐藏标签跳过，避免 0 列损坏提示符。
    if (this.isElementVisible()) {
      this.fitAddon.fit()
    }
    // Force-send the current size now that `this.pid` is finally valid.
    // A resize may already have fired earlier (e.g. from the tab-becomes-
    // visible fit in componentDidUpdate, which can run before createTerm()
    // resolves) while this.pid was still undefined - the backend silently
    // drops resize calls for an unknown pid. If that earlier call already
    // updated term.cols/rows locally, xterm's resize() no-ops on the next
    // fit() (dims unchanged) and never fires onResize again, so the
    // backend pty would otherwise be stuck at its initial (possibly wrong)
    // size forever. Sending explicitly here, keyed off the real pid,
    // guarantees the remote pty/ssh channel is told the true current size.
    resizeTerm(this.pid, term.cols, term.rows)
    term.displayRaw = displayRaw
    term.loadAddon(
      new KeywordHighlighterAddon(keywords)
    )
  },

  handleError ({ message: errorMessage, from, srcId }) {
    this.setState({
      terminalError: {
        message: errorMessage || 'Failed to create terminal session',
        from,
        srcId
      }
    })
  },

  handleEditBookmarkFromError () {
    const error = this.state.terminalError
    if (!error || error.from !== 'bookmarks' || !error.srcId) {
      return
    }
    const item = window.store.bookmarksMap?.get(error.srcId) ||
      window.store.bookmarks?.find(d => d.id === error.srcId)
    if (!item) {
      return
    }
    window.store.openBookmarkEdit(item)
  },

  initSocketEvents () {
    const originalSend = this.socket.send
    this.socket.send = (data) => {
      // Call original send first
      originalSend.call(this.socket, data)

      // Broadcast to other terminals
      this.broadcastSocketData(data)
    }
  },

  canReceiveBroadcast (termRef) {
    return (
      termRef.socket &&
      termRef.props?.tab.pane === paneMap.terminal
    )
  },

  broadcastSocketData (data) {
    if (!this.isActiveTerminal() || !this.props.broadcastInput) {
      return
    }

    window.refs.forEach((termRef, refId) => {
      if (
        refId !== this.id &&
        refId.startsWith('term-') &&
        this.canReceiveBroadcast(termRef)
      ) {
        termRef.socket.send(data)
      }
    })
  },

  onerrorSocket (err) {
    console.error('onerrorSocket', err)
  },

  oncloseSocket () {
    if (this.onClose || this.props.tab.enableSsh === false) {
      return
    }
    this.setStatus(
      statusMap.error
    )
    if (this.userTypeExit) {
      return this.props.delTab(this.props.tab.id)
    }
    const { autoReconnectTerminal } = this.props.config
    if (autoReconnectTerminal) {
      this.scheduleAutoReconnect(3000)
    }
  },

  scheduleAutoReconnect (delay = 3000) {
    clearTimeout(this.timers.reconnectTimer)
    clearInterval(this.timers.reconnectCountdown)
    const seconds = Math.round(delay / 1000)
    this.setState({ reconnectCountdown: seconds })
    let remaining = seconds
    this.timers.reconnectCountdown = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearInterval(this.timers.reconnectCountdown)
        this.timers.reconnectCountdown = null
      }
      this.setState({ reconnectCountdown: remaining <= 0 ? null : remaining })
    }, 1000)
    this.timers.reconnectTimer = setTimeout(() => {
      clearInterval(this.timers.reconnectCountdown)
      this.timers.reconnectCountdown = null
      this.setState({ reconnectCountdown: null })
      if (this.onClose || !this.props.config.autoReconnectTerminal) {
        return
      }
      const reconnectCount = (this.props.tab.autoReConnect || 0) + 1
      this.props.reloadTab({ ...this.props.tab, autoReConnect: reconnectCount })
    }, delay)
  },

  handleCancelAutoReconnect () {
    clearTimeout(this.timers.reconnectTimer)
    clearInterval(this.timers.reconnectCountdown)
    this.timers.reconnectTimer = null
    this.timers.reconnectCountdown = null
    this.setState({ reconnectCountdown: null })
  },

  handleCancel () {
    const { id } = this.props.tab
    this.props.delTab(id)
  },

  /**
   * Manually triggered from the "exit gracefully" control in
   * session-control.jsx (serial tabs only). Writes the configured key
   * sequence (default \x01ky = Ctrl+A, k, y to kill a GNU screen window) to
   * the socket, waits a bit so the remote end (e.g. a Bluetooth console
   * adapter) can release cleanly, then closes the tab.
   */
  async exitGracefully () {
    const { tab } = this.props
    if (tab.type !== terminalSerialType) {
      return
    }
    if (!this.onClose && this.attachAddon?._sendData) {
      try {
        const data = expandCloseSequence(tab.closeSequence || '\\x01ky')
        if (data) {
          this.attachAddon._sendData(data)
        }
      } catch (err) {
        console.error('send close sequence failed', err)
      }
      const delay = Number(tab.closeSequenceDelay)
      await new Promise(resolve => setTimeout(resolve, Number.isFinite(delay) && delay >= 0 ? delay : 500))
    }
    this.props.delTab(tab.id)
  },

  getReloadState () {
    if (!shouldCaptureSshReloadState(this.props.tab, this.props.config)) {
      return undefined
    }
    let screen = ''
    try {
      screen = this.serializeAddon?.serialize({
        scrollback: this.props.config.scrollback,
        excludeAltBuffer: true,
        excludeModes: true
      }) || ''
      // Full-screen programs use the alternate buffer. Replaying that buffer
      // as a terminal mode would trap the fresh shell in stale mouse/cursor
      // state, so preserve its visible text as a safe normal-buffer snapshot.
      const alternateScreen = getAlternateBufferSnapshot(this.term?.buffer.active)
      if (alternateScreen) {
        screen += `${screen ? '\r\n' : ''}${alternateScreen}`
      }
    } catch (e) {
      console.warn('Failed to serialize terminal before reload', e)
    }
    const cwd = this.cmdAddon?.getCwd() || this.props.tab._reloadState?.cwd || ''
    return createSshReloadState({ cwd, screen })
  },

  restoreReloadScreen (term) {
    const screen = this.props.tab._reloadState?.screen
    if (!screen) {
      return Promise.resolve()
    }
    return new Promise(resolve => {
      term.write(screen, () => {
        // The framebuffer has been replayed; do not keep a potentially large
        // duplicate string on the live tab. A later reload serializes afresh.
        delete this.props.tab._reloadState.screen
        resolve()
      })
    })
  }
}
