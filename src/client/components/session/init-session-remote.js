import { isEqual, pick, debounce, throttle } from 'lodash-es'
import clone from '../../common/to-simple-obj.js'
import deepCopy from 'json-deep-copy'

export const remoteInit = async (term = this.term) => {
  this.setState({
    loading: true
  })
  const { cols, rows } = term
  const { config } = this.props
  const {
    keywords = []
  } = config
  const { sessionId, logName } = this.props
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
  const opts = clone({
    cols,
    rows,
    term: terminalType || config.terminalType,
    saveTerminalLogToFile: config.saveTerminalLogToFile,
    ...tab,
    ...extra,
    logName,
    sessionLogPath: config.sessionLogPath || createDefaultLogPath(),
    ...pick(config, [
      'addTimeStampToTermLog',
      'keepaliveInterval',
      'keepaliveCountMax',
      'execWindows',
      'execMac',
      'execLinux',
      'execWindowsArgs',
      'execMacArgs',
      'execLinuxArgs',
      'debug'
    ]),
    keepaliveInterval: tab.keepaliveInterval === undefined ? config.keepaliveInterval : tab.keepaliveInterval,
    sessionId,
    tabId: id,
    uid: id,
    srcTabId: id,
    termType,
    readyTimeout: config.sshReadyTimeout,
    proxy: getProxy(tab, config),
    type: tab.host
      ? typeMap.remote
      : typeMap.local
  })
  let r = await createTerm(opts)
    .catch(err => {
      const text = err.message
      handleErr({ message: text })
    })
  r = r || ''
  if (r.includes('fail')) {
    return this.promote()
  }
  if (savePassword) {
    window.store.editItem(srcId, extra, from)
  }
  this.setState({
    loading: false
  })
  if (!r) {
    this.setStatus(statusMap.error)
    return
  }
  this.setStatus(statusMap.success)
  term.pid = id
  this.pid = id
  const wsUrl = this.buildWsUrl()
  const socket = new WebSocket(wsUrl)
  socket.onclose = this.oncloseSocket
  socket.onerror = this.onerrorSocket
  this.socket = socket
  this.initSocketEvents()
  this.term = term
  socket.onopen = () => {
    this.initAttachAddon()
    this.runInitScript()
    term._initialized = true
  }
  // term.onRrefresh(this.onRefresh)
  term.onResize(this.onResizeTerminal)
  if (pick(term, 'buffer._onBufferChange._listeners')) {
    term.buffer._onBufferChange._listeners.push(this.onBufferChange)
  }
  term.loadAddon(new WebLinksAddon(this.webLinkHandler))
  term.focus()
  this.zmodemAddon = new AddonZmodem()
  this.fitAddon.fit()
  term.loadAddon(this.zmodemAddon)
  term.zmodemAttach(this)
  term.displayRaw = displayRaw
  term.loadAddon(
    new KeywordHighlighterAddon(keywords)
  )
}