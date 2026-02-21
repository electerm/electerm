import { Component, createRef } from 'react'
import { handleErr } from '../../common/fetch.jsx'
import { isEqual, pick, debounce, throttle } from 'lodash-es'
import clone from '../../common/to-simple-obj.js'
import resolve from '../../common/resolve.js'
import {
  ReloadOutlined
} from '@ant-design/icons'
import {
  Spin,
  Button,
  Dropdown
} from 'antd'
import { notification } from '../common/notification'
import message from '../common/message'
import Modal from '../common/modal'
import classnames from 'classnames'
import './terminal.styl'
import {
  statusMap,
  paneMap,
  typeMap,
  isWin,
  rendererTypes,
  isMac
} from '../../common/constants.js'
import deepCopy from 'json-deep-copy'
import { readClipboardAsync, readClipboard, copy } from '../../common/clipboard.js'
import AttachAddon from './attach-addon-custom.js'
import getProxy from '../../common/get-proxy.js'
import { ZmodemClient } from './zmodem-client.js'
import { TrzszClient } from './trzsz-client.js'
import keyControlPressed from '../../common/key-control-pressed.js'
import NormalBuffer from './normal-buffer.jsx'
import { createTerm, resizeTerm } from './terminal-apis.js'
import { shortcutExtend, shortcutDescExtend } from '../shortcuts/shortcut-handler.js'
import { KeywordHighlighterAddon } from './highlight-addon.js'
import { getFilePath, isUnsafeFilename } from '../../common/file-drop-utils.js'
import { CommandTrackerAddon } from './command-tracker-addon.js'
import AIIcon from '../icons/ai-icon.jsx'
import {
  getShellIntegrationCommand,
  detectRemoteShell,
  detectShellType
} from './shell.js'
import iconsMap from '../sys-menu/icons-map.jsx'
import { refs, refsStatic } from '../common/ref.js'
import ExternalLink from '../common/external-link.jsx'
import createDefaultLogPath from '../../common/default-log-path.js'
import SearchResultBar from './terminal-search-bar'
import RemoteFloatControl from '../common/remote-float-control'
import {
  loadTerminal,
  loadFitAddon,
  loadWebLinksAddon,
  loadCanvasAddon,
  loadWebglAddon,
  loadSearchAddon,
  loadLigaturesAddon,
  loadUnicode11Addon
} from './xterm-loader.js'

const e = window.translate

class Term extends Component {
  constructor (props) {
    super(props)
    this.state = {
      loading: false,
      hasSelection: false,
      saveTerminalLogToFile: !!this.props.config.saveTerminalLogToFile,
      addTimeStampToTermLog: !!this.props.config.addTimeStampToTermLog,
      passType: 'password',
      lines: [],
      searchResults: [],
      matchIndex: -1,
      totalLines: 0
    }
    this.id = `term-${this.props.tab.id}`
    refs.add(this.id, this)
    this.currentInput = ''
    this.shellInjected = false
    this.shellType = null
    this.manualCommandHistory = new Set()
  }

  domRef = createRef()

  componentDidMount () {
    this.initTerminal()
    if (this.props.tab.enableSsh === false) {
      this.props.tab.pane = paneMap.fileManager
    }
  }

  componentDidUpdate (prevProps) {
    const shouldChange = (
      prevProps.currentBatchTabId !== this.props.currentBatchTabId &&
      this.props.tab.id === this.props.currentBatchTabId &&
      this.props.pane === paneMap.terminal
    ) || (
      this.props.pane !== prevProps.pane &&
      this.props.pane === paneMap.terminal
    )
    const names = [
      'width',
      'height',
      'left',
      'top'
    ]
    if (
      !isEqual(
        pick(this.props, names),
        pick(prevProps, names)
      ) ||
      shouldChange
    ) {
      this.onResize()
    }
    if (shouldChange && this.term) {
      this.term.focus()
    }
    this.checkConfigChange(
      prevProps,
      this.props
    )
    const themeChanged = !isEqual(
      this.props.themeConfig,
      prevProps.themeConfig
    )
    if (themeChanged && this.term) {
      this.term.options.theme = {
        ...deepCopy(this.props.themeConfig),
        background: 'rgba(0,0,0,0)'
      }
    }
  }

  componentWillUnmount () {
    refs.remove(this.id)
    if (window.store.activeTerminalId === this.props.tab.id) {
      window.store.activeTerminalId = ''
    }
    if (this.term) {
      this.term.parent = null
    }
    Object.keys(this.timers).forEach(k => {
      clearTimeout(this.timers[k])
      this.timers[k] = null
    })
    this.onClose = true
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    if (this.term) {
      this.term.dispose()
      this.term = null
    }
    this.attachAddon = null
    this.fitAddon = null
    this.zmodemClient = null
    this.trzszClient = null
    this.searchAddon = null
    this.fitAddon = null
    this.cmdAddon = null
    // Clear the notification if it exists
    if (this.socketCloseWarning) {
      notification.destroy(this.socketCloseWarning.key)
      this.socketCloseWarning = null
    }
  }

  terminalConfigProps = [
    {
      name: 'rightClickSelectsWord',
      type: 'glob'
    },
    {
      name: 'fontSize',
      type: 'glob_local'
    },
    {
      name: 'fontFamily',
      type: 'glob_local'
    }
  ]

  initAttachAddon = async () => {
    this.attachAddon = new AttachAddon(
      this.term,
      this.socket,
      isWin && !this.isRemote()
    )
    this.attachAddon.decoder = new TextDecoder(
      this.encode || this.props.tab.encode || 'utf-8'
    )
    await this.attachAddon.activate(this.term)
  }

  getValue = (props, type, name) => {
    return type === 'glob'
      ? props.config[name]
      : props.tab[name] || props.config[name]
  }

  checkConfigChange = (prevProps, props) => {
    for (const k of this.terminalConfigProps) {
      const { name, type } = k
      const prev = this.getValue(prevProps, type, name)
      const curr = this.getValue(props, type, name)
      if (
        prev !== curr
      ) {
        this.term.options[name] = curr
        if (['fontFamily', 'fontSize'].includes(name)) {
          this.onResize()
        }
      }
    }

    // Check for shell integration related config changes
    const prevShowSuggestions = prevProps.config.showCmdSuggestions
    const currShowSuggestions = props.config.showCmdSuggestions
    const prevSftpFollow = prevProps.sftpPathFollowSsh
    const currSftpFollow = props.sftpPathFollowSsh

    if (
      (!prevShowSuggestions && currShowSuggestions) ||
      (!prevSftpFollow && currSftpFollow)
    ) {
      // Config was toggled to true, try to inject shell integration if not already done
      if (this.canInjectShellIntegration() && !this.shellInjected) {
        // If there's an active execution queue, add to it
        if (this.executionQueue && this.executionQueue.length > 0) {
          this.executionQueue.unshift({
            type: 'shell_integration',
            execute: async () => {
              await this.injectShellIntegration()
              if (currSftpFollow) {
                this.attachAddon._sendData('\r')
              }
            }
          })
        } else {
          // No active queue, inject directly
          this.injectShellIntegration().then(() => {
            if (currSftpFollow) {
              this.attachAddon._sendData('\r')
            }
          })
        }
      } else if (this.shellInjected && currSftpFollow) {
        this.getCwd()
      }
    }
    if (
      !prevSftpFollow &&
      currSftpFollow &&
      this.isLocal() &&
      isWin
    ) {
      return this.warnSftpFollowUnsupported()
    }
  }

  timers = {}

  getDomId = () => {
    return `term-${this.props.tab.id}`
  }

  zoom = (v) => {
    const { term } = this
    if (!term) {
      return
    }
    term.options.fontSize = term.options.fontSize + v
    window.store.triggerResize()
  }

  isActiveTerminal = () => {
    return this.props.tab.id === this.props.activeTabId &&
    this.props.tab.pane === paneMap.terminal
  }

  clearShortcut = (e) => {
    e.stopPropagation()
    this.onClear()
  }

  // selectAllShortcut = (e) => {
  //   e.stopPropagation()
  //   this.term.selectAll()
  // }

  copyShortcut = (e) => {
    const sel = this.term.getSelection()
    if (sel) {
      e.stopPropagation()
      this.copySelectionToClipboard()
      return false
    }
  }

  searchShortcut = (e) => {
    e.stopPropagation()
    this.toggleSearch()
  }

  pasteSelectedShortcut = (e) => {
    e.stopPropagation()
    this.tryInsertSelected()
  }

  pasteTextTooLong = () => {
    if (window.et.isWebApp) {
      return false
    }
    const text = readClipboard()
    return text.length > 500
  }

  askUserConfirm = () => {
    Modal.confirm({
      title: e('paste'),
      content: (
        <div>
          <p>{e('paste')}:</p>
          <div className='paste-text'>
            <pre>
              <code>{readClipboard()}</code>
            </pre>
          </div>
        </div>
      ),
      okText: e('ok'),
      cancelText: e('cancel'),
      onOk: () => this.onPaste(true)
    })
  }

  warnSftpFollowUnsupported = () => {
    message.warning(
      <span>
        Fish shell/windows shell is not supported for SFTP follow SSH path feature. See: <ExternalLink to='https://github.com/electerm/electerm/wiki/Warning-about-sftp-follow-ssh-path-function'>wiki</ExternalLink>
      </span>
      , 7)
  }

  pasteShortcut = (e) => {
    if (this.pasteTextTooLong()) {
      this.askUserConfirm()
      e.preventDefault()
      e.stopPropagation()
      return false
    }
    if (isMac) {
      return true
    }
    if (!this.isRemote()) {
      return true
    }
    if (this.term.buffer.active.type !== 'alternate') {
      return false
    }
    return true
  }

  showNormalBufferShortcut = (e) => {
    e.stopPropagation()
    this.openNormalBuffer()
  }

  runQuickCommand = (cmd, inputOnly = false) => {
    this.term && this.attachAddon._sendData(
      cmd +
      (inputOnly ? '' : '\r')
    )
    this.term.focus()
  }

  cd = (p) => {
    if (isUnsafeFilename(p)) {
      return message.error('File name contains unsafe characters')
    }
    this.runQuickCommand(`cd "${p}"`)
  }

  onDrop = e => {
    const dt = e.dataTransfer
    const fromFile = dt.getData('fromFile')
    const notSafeMsg = 'File name contains unsafe characters'

    if (fromFile) {
      // Handle SFTP file drop
      try {
        const fileData = JSON.parse(fromFile)
        const filePath = resolve(fileData.path, fileData.name)
        if (isUnsafeFilename(filePath)) {
          message.error(notSafeMsg)
          return
        }
        this.attachAddon._sendData(`"${filePath}" `)
        return
      } catch (e) {
        console.error('Failed to parse fromFile data:', e)
      }
    }

    // Handle regular file drop
    const files = dt.files
    if (files && files.length) {
      const arr = Array.from(files)
      const filePaths = arr.map(f => getFilePath(f))

      // Check each file path individually
      const hasUnsafeFilename = filePaths.some(path => isUnsafeFilename(path))
      if (hasUnsafeFilename) {
        message.error(notSafeMsg)
        return
      }

      const filesAll = filePaths.map(path => `"${path}"`).join(' ')
      this.attachAddon._sendData(filesAll)
    }
  }

  onSelection = () => {
    if (
      !this.props.config.copyWhenSelect ||
      window.store.onOperation
    ) {
      return false
    }
    this.copySelectionToClipboard()
  }

  copySelectionToClipboard = () => {
    const txt = this.term.getSelection()
    if (txt) {
      copy(txt)
    }
  }

  tryInsertSelected = () => {
    const txt = this.term.getSelection()
    if (txt) {
      this.attachAddon._sendData(txt)
    }
  }

  webLinkHandler = (event, url) => {
    if (event?.button === 2) {
      return false
    }
    if (!this.props.config.ctrlOrMetaOpenTerminalLink) {
      return window.openLink(url, '_blank')
    }
    if (keyControlPressed(event)) {
      window.openLink(url, '_blank')
    }
  }

  onContextMenuInner = e => {
    e.preventDefault()
    if (this.state.loading) {
      return
    }
    if (this.props.config.pasteWhenContextMenu) {
      return this.onPaste()
    }
  }

  onCopy = () => {
    const selected = this.term.getSelection()
    copy(selected)
    this.term.focus()
  }

  // onSelectAll = () => {
  //   this.term.selectAll()
  // }

  onClear = () => {
    this.term.clear()
    this.term.focus()
    // this.notifyOnData('')
  }

  isRemote = () => {
    return this.props.tab?.host
  }

  onPaste = async (skipTextLengthCheck) => {
    let selected = await readClipboardAsync()
    if (!skipTextLengthCheck && selected.length > 500) {
      return this.askUserConfirm()
    }
    if (isWin && this.isRemote()) {
      selected = selected.replace(/\r\n/g, '\n')
    }
    this.term.paste(selected || '')
    this.term.focus()
  }

  onPasteSelected = () => {
    const selected = this.term.getSelection()
    this.term.paste(selected || '')
    this.term.focus()
  }

  toggleSearch = () => {
    window.store.toggleTerminalSearch()
  }

  onSearchResultsChange = ({ resultIndex, resultCount }) => {
    window.store.storeAssign({
      termSearchMatchCount: resultCount,
      termSearchMatchIndex: resultIndex
    })

    this.updateSearchResults(resultIndex)
  }

  updateSearchResults = (resultIndex) => {
    const matches = this.searchAddon._highlightDecorations.map((highlight, i) => {
      return highlight.match.row
    })

    this.setState({
      searchResults: matches,
      matchIndex: resultIndex,
      totalLines: this.term.buffer.active.length
    })
  }

  searchPrev = (searchInput, options) => {
    this.searchAddon.findPrevious(
      searchInput, options
    )
  }

  searchNext = (searchInput, options) => {
    this.searchAddon.findNext(
      searchInput, options
    )
  }

  explainWithAi = () => {
    window.store.explainWithAi(
      this.term.getSelection()
    )
  }

  renderContextMenu = () => {
    const { hasSelection } = this.state
    const copyed = true
    const copyShortcut = this.getShortcut('terminal_copy')
    const pasteShortcut = this.getShortcut('terminal_paste')
    const clearShortcut = this.getShortcut('terminal_clear')
    const searchShortcut = this.getShortcut('terminal_search')

    return [
      {
        key: 'onCopy',
        icon: <iconsMap.CopyOutlined />,
        label: e('copy'),
        disabled: !hasSelection,
        extra: copyShortcut
      },
      {
        key: 'onPaste',
        icon: <iconsMap.SwitcherOutlined />,
        label: e('paste'),
        disabled: !copyed,
        extra: pasteShortcut
      },
      {
        key: 'onPasteSelected',
        icon: <iconsMap.SwitcherOutlined />,
        label: e('pasteSelected'),
        disabled: !hasSelection
      },
      {
        key: 'explainWithAi',
        icon: <AIIcon />,
        label: e('explainWithAi'),
        disabled: !hasSelection
      },
      {
        key: 'onClear',
        icon: <iconsMap.ReloadOutlined />,
        label: e('clear'),
        extra: clearShortcut
      },
      {
        key: 'toggleSearch',
        icon: <iconsMap.SearchOutlined />,
        label: e('search'),
        extra: searchShortcut
      }
    ]
  }

  onContextMenu = ({ key }) => {
    this[key]()
  }

  notifyOnData = debounce(() => {
    window.store.notifyTabOnData(this.props.tab.id)
  }, 1000)

  parse (rawText) {
    let result = ''
    const len = rawText.length
    for (let i = 0; i < len; i++) {
      if (rawText[i] === '\b') {
        result = result.slice(0, -1)
      } else {
        result += rawText[i]
      }
    }
    return result
  }

  getCmd = () => {
    return this.cmdAddon.getCurrentCommand()
  }

  getCwd = () => {
    // Use shell integration CWD if available
    if (this.cmdAddon && this.cmdAddon.hasShellIntegration()) {
      const cwd = this.cmdAddon.getCwd()
      if (cwd) {
        this.setCwd(cwd)
        return cwd
      }
    }
    // Fallback: no longer needed with shell integration
    return ''
  }

  setCwd = (cwd) => {
    this.props.setCwd(cwd, this.state.id)
  }

  getCursorPosition = () => {
    if (!this.term) return null

    // Get the active buffer and cursor position
    const buffer = this.term.buffer.active
    const cursorRow = buffer.cursorY
    const cursorCol = buffer.cursorX

    // Get dimensions from term element
    const termElement = this.term.element
    if (!termElement) return null

    // Get the exact position of the terminal element
    const termRect = termElement.getBoundingClientRect()

    // Calculate cell dimensions
    const cellWidth = termRect.width / this.term.cols
    const cellHeight = termRect.height / this.term.rows

    // Calculate absolute position relative to terminal element
    const left = Math.floor(termRect.left + (cursorCol * cellWidth))
    const top = Math.floor(termRect.top + ((cursorRow + 1) * cellHeight))

    return {
      cellWidth,
      cellHeight,
      left,
      top
    }
  }

  closeSuggestions = () => {
    refsStatic
      .get('terminal-suggestions')
      ?.closeSuggestions()
  }

  openSuggestions = (cursorPos, data) => {
    refsStatic
      .get('terminal-suggestions')
      ?.openSuggestions(cursorPos, data)
  }

  /**
   * Read current input directly from terminal buffer
   * This is more reliable than tracking character-by-character
   */
  getCurrentInput = () => {
    if (!this.term) return ''

    const buffer = this.term.buffer.active
    const cursorY = buffer.cursorY
    const cursorX = buffer.cursorX

    // Get the current line from buffer (baseY + cursorY gives absolute position)
    const absoluteY = buffer.baseY + cursorY
    const line = buffer.getLine(absoluteY)
    if (!line) return ''

    // Get text from start of line up to cursor position
    const lineText = line.translateToString(true, 0, cursorX)

    // Try to extract command after prompt
    // Common prompt endings with trailing space
    const promptEndings = ['$ ', '# ', '> ', '% ', '] ', ') ']

    let commandStart = 0
    for (const ending of promptEndings) {
      const idx = lineText.lastIndexOf(ending)
      if (idx !== -1 && idx + ending.length > commandStart) {
        commandStart = idx + ending.length
      }
    }

    return lineText.slice(commandStart)
  }

  setCurrentInput = (value) => {
    this.currentInput = value
  }

  /**
   * Handle special input events for command history tracking
   * The actual input reading is done via getCurrentInput from buffer
   */
  handleInputEvent = (d) => {
    // Handle Enter - add command to history
    if (d === '\r' || d === '\n') {
      const currentCmd = this.getCurrentInput()
      if (currentCmd && currentCmd.trim() && this.shouldUseManualHistory()) {
        this.manualCommandHistory.add(currentCmd.trim())
        window.store.addCmdHistory(currentCmd.trim())
      }
      this.closeSuggestions()
    }
  }

  onData = (d) => {
    this.handleInputEvent(d)
    if (this.props.config.showCmdSuggestions) {
      const data = this.getCurrentInput()
      if (data && d !== '\r' && d !== '\n') {
        const cursorPos = this.getCursorPosition()
        this.openSuggestions(cursorPos, data)
      } else {
        this.closeSuggestions()
      }
    } else {
      this.closeSuggestions()
    }
  }

  loadRenderer = async (term, config) => {
    if (config.rendererType === rendererTypes.canvas) {
      const CanvasAddon = await loadCanvasAddon()
      term.loadAddon(new CanvasAddon())
    } else if (config.rendererType === rendererTypes.webGL) {
      try {
        const WebglAddon = await loadWebglAddon()
        term.loadAddon(new WebglAddon())
      } catch (e) {
        console.error('render with webgl failed, fallback to canvas')
        console.error(e)
        const CanvasAddon = await loadCanvasAddon()
        term.loadAddon(new CanvasAddon())
      }
    }
  }

  initTerminal = async () => {
    const { themeConfig, tab = {}, config = {} } = this.props
    const tc = deepCopy(themeConfig)
    tc.background = 'rgba(0,0,0,0)'
    const Terminal = await loadTerminal()
    const term = new Terminal({
      allowProposedApi: true,
      scrollback: config.scrollback,
      rightClickSelectsWord: config.rightClickSelectsWord || false,
      fontFamily: tab.fontFamily || config.fontFamily,
      theme: tc,
      allowTransparency: true,
      wordSeparator: config.terminalWordSeparator,
      cursorStyle: config.cursorStyle,
      cursorBlink: config.cursorBlink,
      fontSize: tab.fontSize || config.fontSize,
      screenReaderMode: config.screenReaderMode
    })

    term.parent = this
    term.onSelectionChange(this.onSelection)
    term.open(this.domRef.current, true)
    await this.loadRenderer(term, config)

    const FitAddon = await loadFitAddon()
    this.fitAddon = new FitAddon()
    this.cmdAddon = new CommandTrackerAddon()
    this.cmdAddon.onCommandExecuted((cmd) => {
      if (cmd && cmd.trim()) {
        window.store.addCmdHistory(cmd.trim())
      }
    })
    this.cmdAddon.onCwdChanged((cwd) => {
      this.setCwd(cwd)
    })
    const SearchAddon = await loadSearchAddon()
    this.searchAddon = new SearchAddon()
    const LigaturesAddon = await loadLigaturesAddon()
    const ligtureAddon = new LigaturesAddon()
    this.searchAddon.onDidChangeResults(this.onSearchResultsChange)
    const Unicode11Addon = await loadUnicode11Addon()
    const unicode11Addon = new Unicode11Addon()
    term.loadAddon(unicode11Addon)
    term.loadAddon(ligtureAddon)
    term.unicode.activeVersion = '11'
    term.loadAddon(this.fitAddon)
    term.loadAddon(this.searchAddon)
    term.loadAddon(this.cmdAddon)
    term.onData(this.onData)
    this.term = term
    term.onSelectionChange(this.onSelectionChange)
    term.attachCustomKeyEventHandler(this.handleKeyboardEvent.bind(this))
    await this.remoteInit(term)
  }

  onSelectionChange = () => {
    this.setState({
      hasSelection: this.term.hasSelection()
    })
  }

  // setActive = () => {
  //   const name = `activeTabId${this.props.batch}`
  //   const tabId = this.props.tab.id
  //   window.store.storeAssign({
  //     activeTabId: tabId,
  //     [name]: tabId
  //   })
  // }

  runInitScript = async () => {
    window.store.triggerResize()
    const {
      startDirectory,
      runScripts
    } = this.props.tab

    const scripts = runScripts ? [...runScripts] : []
    const startFolder = startDirectory || window.initFolder
    if (startFolder) {
      scripts.unshift({ script: `cd "${startFolder}"`, delay: 0 })
    }

    // Create unified execution queue
    this.executionQueue = []

    // Add shell integration injection to queue if needed
    if (this.canInjectShellIntegration()) {
      this.executionQueue.push({
        type: 'shell_integration',
        execute: async () => {
          await this.injectShellIntegration()
        }
      })
    }

    // Add delayed scripts to queue
    scripts.forEach(script => {
      this.executionQueue.push({
        type: 'delayed_script',
        script: script.script,
        delay: script.delay || 0,
        execute: () => {
          if (script.script) {
            this.attachAddon._sendData(script.script + '\r')
          }
        }
      })
    })

    this.processExecutionQueue()
  }

  shouldUseManualHistory = () => {
    const useManual = this.props.config.showCmdSuggestions &&
      (this.shellType === 'sh' || (isWin && this.isLocal()))
    return useManual
  }

  canInjectShellIntegration = () => {
    const { config } = this.props
    const canInject = (config.showCmdSuggestions || this.props.sftpPathFollowSsh) &&
    (
      this.isSsh() ||
      (this.isLocal() && !isWin)
    )
    return canInject
  }

  isSsh = () => {
    const { host, type } = this.props.tab
    return host && (type === 'ssh' || type === undefined)
  }

  isLocal = () => {
    const { host, type } = this.props.tab
    return !host &&
      (type === 'local' || type === undefined)
  }

  /**
   * Process the unified execution queue one item at a time
   */
  processExecutionQueue = async () => {
    if (!this.executionQueue || this.executionQueue.length === 0) {
      return
    }

    const item = this.executionQueue.shift()

    try {
      if (item.type === 'shell_integration') {
        await item.execute()
      } else if (item.type === 'delayed_script') {
        item.execute()
        // Wait for the specified delay before processing next item
        if (item.delay > 0) {
          await new Promise(resolve => {
            this.timers.timerDelay = setTimeout(resolve, item.delay)
          })
        }
      }
    } catch (error) {
      console.error('[Shell Integration] Error processing queue item:', item.type, error)
    }

    // Process next item
    this.processExecutionQueue()
  }

  /**
   * Inject shell integration commands from client-side
   * This replaces the server-side source xxx.xxx approach
   * Uses output suppression to hide the injection command
   * Returns a promise that resolves when injection is complete
   */
  injectShellIntegration = async () => {
    if (this.shellInjected) {
      return Promise.resolve()
    }

    let shellType
    if (this.isLocal()) {
      const { config } = this.props
      const localShell = isMac ? config.execMac : config.execLinux
      shellType = detectShellType(localShell)
    } else if (this.isSsh()) {
      shellType = await detectRemoteShell(this.pid)
    }

    this.shellType = shellType
    if (shellType === 'fish') {
      if (this.props.sftpPathFollowSsh) {
        this.warnSftpFollowUnsupported()
      }
      return Promise.resolve()
    }

    // Don't inject for sh type shells unless sftpPathFollowSsh is true
    if (shellType === 'sh' && !this.props.sftpPathFollowSsh) {
      return Promise.resolve()
    }

    const integrationCmd = getShellIntegrationCommand(shellType)

    return new Promise((resolve) => {
      // Wait for initial data (prompt/banner) to arrive before injecting
      this.attachAddon.onInitialData(() => {
        if (this.attachAddon) {
          // Start suppressing output before sending the integration command
          // This hides the command and its output until OSC 633 is detected
          const suppressionTimeout = this.isSsh() ? 5000 : 3000
          // Pass callback to resolve the promise after suppression ends
          this.attachAddon.startOutputSuppression(suppressionTimeout, () => {
            this.shellInjected = true
            resolve()
          })
          this.attachAddon._sendData(integrationCmd)
        } else {
          resolve()
        }
      })
    })
  }

  setStatus = status => {
    const id = this.props.tab?.id
    this.props.editTab(id, {
      status
    })
  }

  openNormalBuffer = () => {
    const normal = this.term.buffer._normal
    const len = normal.length
    const lines = new Array(len).fill('').map((x, i) => {
      return normal.getLine(i).translateToString(false)
    })
    this.setState({
      lines
    })
  }

  closeNormalBuffer = () => {
    this.setState({
      lines: []
    })
    this.term.focus()
  }

  onBufferChange = buf => {
    this.bufferMode = buf.type
  }

  buildWsUrl = (port) => {
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
  }

  remoteInit = async (term = this.term) => {
    this.setState({
      loading: true
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
      keepaliveInterval: tab.keepaliveInterval || config.keepaliveInterval,
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
    const r = await createTerm(opts)
      .catch(err => {
        const text = err.message
        handleErr({ message: text })
      })
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
      this.runInitScript()
      term._initialized = true
    }
    // term.onRrefresh(this.onRefresh)
    term.onResize(this.onResizeTerminal)
    if (pick(term, 'buffer._onBufferChange._listeners')) {
      term.buffer._onBufferChange._listeners.push(this.onBufferChange)
    }
    const WebLinksAddon = await loadWebLinksAddon()
    term.loadAddon(new WebLinksAddon(this.webLinkHandler))
    term.focus()
    this.zmodemClient = new ZmodemClient(this)
    this.zmodemClient.init(socket)
    this.trzszClient = new TrzszClient(this)
    this.trzszClient.init(socket)
    this.fitAddon.fit()
    term.displayRaw = displayRaw
    term.loadAddon(
      new KeywordHighlighterAddon(keywords)
    )
  }

  initSocketEvents = () => {
    const originalSend = this.socket.send
    this.socket.send = (data) => {
      // Call original send first
      originalSend.call(this.socket, data)

      // Broadcast to other terminals
      this.broadcastSocketData(data)
    }
  }

  canReceiveBroadcast = (termRef) => {
    return (
      termRef.socket &&
      termRef.props?.tab.pane === paneMap.terminal
    )
  }

  broadcastSocketData = (data) => {
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
  }

  onResize = throttle(() => {
    const cid = this.props.currentBatchTabId
    const tid = this.props.tab?.id
    if (
      this.props.tab.status === statusMap.success &&
      cid === tid &&
      this.term
    ) {
      try {
        this.fitAddon.fit()
      } catch (e) {
        console.info('resize failed')
      }
    }
  }, 200)

  onerrorSocket = err => {
    console.error('onerrorSocket', err)
  }

  oncloseSocket = () => {
    if (this.onClose || this.props.tab.enableSsh === false) {
      return
    }
    this.setStatus(
      statusMap.error
    )
    if (!this.isActiveTerminal() || !window.focused) {
      return false
    }
    if (this.userTypeExit) {
      return this.props.delTab(this.props.tab.id)
    }
    const key = `open${Date.now()}`
    function closeMsg () {
      notification.destroy(key)
    }
    this.socketCloseWarning = notification.warning({
      key,
      message: e('socketCloseTip'),
      duration: 30,
      description: (
        <div className='pd2y'>
          <Button
            className='mg1r'
            type='primary'
            onClick={() => {
              closeMsg()
              this.props.delTab(this.props.tab.id)
            }}
          >
            {e('close')}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              closeMsg()
              this.props.reloadTab(
                this.props.tab
              )
            }}
          >
            {e('reload')}
          </Button>
        </div>
      )
    })
  }

  batchInput = (cmd) => {
    this.attachAddon._sendData(cmd + '\r')
  }

  onResizeTerminal = size => {
    const { cols, rows } = size
    resizeTerm(this.pid, cols, rows)
  }

  handleCancel = () => {
    const { id } = this.props.tab
    this.props.delTab(id)
  }

  handleShowInfo = () => {
    const { logName, tab } = this.props
    const infoProps = {
      logName,
      id: tab.id,
      pid: tab.id,
      isRemote: this.isRemote(),
      isActive: this.isActiveTerminal()
    }
    Object.assign(window.store.terminalInfoProps, infoProps)
  }

  // getPwd = async () => {
  //   const { sessionId, config } = this.props
  //   const { pid } = this.state
  //   const prps = {
  //     host: config.host,
  //     port: config.port,
  //     pid,
  //     sessionId
  //   }
  //   const result = await runCmds(prps, ['pwd'])
  //     .catch(window.store.onError)
  //   return result ? result[0].trim() : ''
  // }

  switchEncoding = encode => {
    this.encode = encode
    this.attachAddon.decoder = new TextDecoder(encode)
  }

  render () {
    const { loading } = this.state
    const { height, width, left, top, fullscreen } = this.props
    const { id } = this.props.tab
    const isActive = this.isActiveTerminal()
    const cls = classnames(
      'term-wrap',
      'tw-' + id,
      {
        'terminal-not-active': !isActive
      }
    )
    const prps1 = {
      className: cls,
      style: {
        height,
        width,
        left,
        top,
        zIndex: 10
      },
      onDrop: this.onDrop,
      onContextMenu: this.onContextMenuInner
    }
    // const fileProps = {
    //   type: 'file',
    //   multiple: true,
    //   id: `${id}-file-sel`,
    //   className: 'hide'
    // }
    const prps3 = {
      id: this.getDomId(),
      ref: this.domRef,
      className: 'absolute term-wrap-2',
      style: {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      }
    }
    const dropdownProps = {
      menu: {
        items: this.renderContextMenu(),
        onClick: this.onContextMenu
      },
      trigger: this.props.config.pasteWhenContextMenu ? [] : ['contextMenu']
    }
    const barProps = {
      matchIndex: this.state.matchIndex,
      matches: this.state.searchResults,
      totalLines: this.state.totalLines,
      height
    }
    return (
      <Dropdown {...dropdownProps}>
        <div
          {...prps1}
        >
          <div
            {...prps3}
          />
          <NormalBuffer
            lines={this.state.lines}
            close={this.closeNormalBuffer}
          />
          <SearchResultBar {...barProps} />
          <RemoteFloatControl
            isFullScreen={fullscreen}
          />
          <Spin className='loading-wrapper' spinning={loading} />
        </div>
      </Dropdown>
    )
  }
}

export default shortcutDescExtend(shortcutExtend(Term))
