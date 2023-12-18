import { Component } from 'react'
import ZmodemTransfer from './zmodem-transfer'
import { handleErr } from '../../common/fetch'
import generate from '../../common/uid'
import { isEqual, pick, debounce, throttle } from 'lodash-es'
import postMessage from '../../common/post-msg'
import clone from '../../common/to-simple-obj'
import runIdle from '../../common/run-idle'
import {
  ReloadOutlined
} from '@ant-design/icons'
import {
  notification,
  Spin,
  Button
} from 'antd'
import classnames from 'classnames'
import './terminal.styl'
import {
  statusMap,
  paneMap,
  typeMap,
  isWin,
  terminalSshConfigType,
  transferTypeMap,
  terminalActions,
  commonActions,
  rendererTypes,
  termInitId
} from '../../common/constants'
import deepCopy from 'json-deep-copy'
import { readClipboard, copy } from '../../common/clipboard'
import { FitAddon } from 'xterm-addon-fit'
import AttachAddon from './attach-addon-custom'
import { SearchAddon } from 'xterm-addon-search'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { SerializeAddon } from 'xterm-addon-serialize'
import { CanvasAddon } from 'xterm-addon-canvas'
import { WebglAddon } from 'xterm-addon-webgl'
import { LigaturesAddon } from 'xterm-addon-ligatures'
import getProxy from '../../common/get-proxy'
import { Zmodem, AddonZmodem } from './xterm-zmodem'
import { Unicode11Addon } from 'xterm-addon-unicode11'
import keyControlPressed from '../../common/key-control-pressed'
import { Terminal } from 'xterm'
import * as ls from '../../common/safe-local-storage'
import NormalBuffer from './normal-buffer'
import { createTerm, resizeTerm } from './terminal-apis'
import createLsId from './build-ls-term-id'
import { shortcutExtend, shortcutDescExtend } from '../shortcuts/shortcut-handler.js'
import { KeywordHighlighterAddon } from './highlight-addon.js'

const { prefix } = window
const e = prefix('ssh')
const m = prefix('menu')

const computePos = (e) => {
  return {
    left: e.clientX,
    top: e.clientY
  }
}

class Term extends Component {
  constructor (props) {
    super(props)
    this.state = {
      pid: '',
      id: props.id || 'id' + generate(),
      loading: false,
      saveTerminalLogToFile: !!this.props.config.saveTerminalLogToFile,
      addTimeStampToTermLog: !!this.props.config.addTimeStampToTermLog,
      passType: 'password',
      zmodemTransfer: null,
      lines: []
    }
  }

  isTerm = true

  dataCache = ''

  componentDidMount () {
    this.initTerminal()
    this.initEvt()
    if (this.props.tab.enableSsh === false) {
      ;(
        document.querySelector('.session-current .term-sftp-tabs .type-tab.sftp') ||
        document.querySelector('.session-current .term-sftp-tabs .type-tab.fileManager')
      ).click()
    }
  }

  componentDidUpdate (prevProps) {
    const shouldChange = (
      prevProps.currentTabId !== this.props.currentTabId &&
      this.props.tab.id === this.props.currentTabId &&
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
    if (shouldChange) {
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
    if (themeChanged) {
      this.term.options.theme = deepCopy(this.props.themeConfig)
    }
  }

  componentWillUnmount () {
    Object.keys(this.timers).forEach(k => {
      clearTimeout(this.timers[k])
    })
    this.onClose = true
    this.socket && this.socket.close()
    if (this.term) {
      this.term.dispose()
    }
    window.removeEventListener(
      'resize',
      this.onResize
    )
    window.removeEventListener('message', this.handleEvent)
    this.dom.removeEventListener('contextmenu', this.onContextMenu)
    window.removeEventListener('message', this.onContextAction)
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
  }

  timers = {}

  initEvt = () => {
    const { id } = this.state
    const dom = document.getElementById(id)
    this.dom = dom
    dom.addEventListener('contextmenu', this.onContextMenu)
    window.addEventListener(
      'resize',
      this.onResize
    )
    window.addEventListener('message', this.handleEvent)
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
    return this.props.id === this.props.activeSplitId &&
    this.props.tab.id === this.props.currentTabId &&
    this.props.pane === paneMap.terminal
  }

  clearShortcut = (e) => {
    e.stopPropagation()
    this.onClear()
  }

  selectAllShortcut = (e) => {
    e.stopPropagation()
    this.term.selectAll()
  }

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

  showNormalBufferShortcut = (e) => {
    e.stopPropagation()
    this.openNormalBuffer()
  }

  prevTabShortcut = throttle((e) => {
    e.stopPropagation()
    window.store.clickPrevTab()
  }, 300)

  nextTabShortcut = throttle((e) => {
    e.stopPropagation()
    window.store.clickNextTab()
  }, 300)

  handleEvent = (e) => {
    const {
      keyword,
      options,
      action,
      encode,
      saveTerminalLogToFile,
      addTimeStampToTermLog,
      type,
      cmd,
      activeSplitId,
      pid,
      toAll,
      inputOnly,
      zoomValue
    } = e?.data || {}

    const { id: propSplitId } = this.props
    const { pid: statePid } = this.state
    if (
      action === terminalActions.zoom &&
      propSplitId === activeSplitId
    ) {
      this.zoom(zoomValue)
    } else if (
      action === terminalActions.changeEncode &&
      propSplitId === activeSplitId
    ) {
      this.switchEncoding(encode)
    } else if (
      action === terminalActions.batchInput &&
      (
        toAll || propSplitId === activeSplitId
      )
    ) {
      this.batchInput(cmd)
    } else if (
      action === terminalActions.showInfoPanel &&
      (
        propSplitId === activeSplitId
      )
    ) {
      this.handleShowInfo()
    } else if (
      action === terminalActions.quickCommand &&
      (
        propSplitId === activeSplitId
      )
    ) {
      e.stopPropagation()
      this.term && this.attachAddon._sendData(
        cmd +
        (inputOnly ? '' : '\r')
      )
      this.term.focus()
    } else if (
      action === terminalActions.openTerminalSearch &&
      (
        propSplitId === activeSplitId
      )
    ) {
      this.toggleSearch()
    } else if (
      action === terminalActions.doSearchNext &&
      (
        propSplitId === activeSplitId
      )
    ) {
      this.searchNext(keyword, options)
    } else if (
      action === terminalActions.doSearchPrev &&
      (
        propSplitId === activeSplitId
      )
    ) {
      this.searchPrev(keyword, options)
    } else if (
      action === commonActions.getTermLogState &&
      pid === statePid
    ) {
      postMessage({
        action: commonActions.returnTermLogState,
        state: {
          saveTerminalLogToFile: this.state.saveTerminalLogToFile,
          addTimeStampToTermLog: this.state.addTimeStampToTermLog
        },
        pid: statePid
      })
    } else if (
      action === commonActions.setTermLogState &&
      pid === statePid
    ) {
      this.setState({
        addTimeStampToTermLog,
        saveTerminalLogToFile
      })
    }
    const isActiveTerminal = this.isActiveTerminal()
    if (
      type === 'focus' &&
      isActiveTerminal
    ) {
      e.stopPropagation()
      window.store.termFocused = true
      return this.term && this.term.focus()
    }
    if (
      type === 'blur' &&
      isActiveTerminal
    ) {
      e.stopPropagation()
      return this.term && this.term.blur()
    }
  }

  onDrop = e => {
    const files = e?.dataTransfer?.files
    if (files && files.length) {
      this.attachAddon._sendData(
        Array.from(files).map(f => `"${f.path}"`).join(' ')
      )
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
    if (!this.props.config.ctrlOrMetaOpenTerminalLink) {
      return window.openLink(url, '_blank')
    }
    if (keyControlPressed(event)) {
      window.openLink(url, '_blank')
    }
  }

  onzmodemRetract = () => {
    log.debug('zmodemRetract')
  }

  onReceiveZmodemSession = () => {
    //  * zmodem transfer
    //  * then run rz to send from your browser or
    //  * sz <file> to send from the remote peer.
    this.term.write('\r\nRecommmend use trzsz instead: https://github.com/trzsz/trzsz\r\n')
    this.zsession.on('offer', this.onOfferReceive)
    this.zsession.start()
    return new Promise((resolve) => {
      this.zsession.on('session_end', resolve)
    }).then(this.onZmodemEnd).catch(this.onZmodemCatch)
  }

  updateProgress = (xfer, type) => {
    if (this.onCanceling) {
      return
    }
    const fileInfo = xfer.get_details()
    const {
      size
    } = fileInfo
    const total = xfer.get_offset() || 0
    let percent = Math.floor(100 * total / size)
    if (percent > 99) {
      percent = 99
    }
    this.setState({
      zmodemTransfer: {
        fileInfo,
        percent,
        transferedSize: total,
        type
      }
    })
  }

  saveToDisk = (xfer, buffer) => {
    return Zmodem.Browser
      .save_to_disk(buffer, xfer.get_details().name)
  }

  onOfferReceive = xfer => {
    this.updateProgress(xfer, transferTypeMap.download)
    const FILE_BUFFER = []
    xfer.on('input', (payload) => {
      this.updateProgress(xfer, transferTypeMap.download)
      FILE_BUFFER.push(new Uint8Array(payload))
    })
    xfer.accept()
      .then(
        () => {
          this.saveToDisk(xfer, FILE_BUFFER)
        }
      )
      .catch(window.store.onError)
  }

  beforeZmodemUpload = (file, files) => {
    if (!files.length) {
      return false
    }
    // const f = files[0]
    // if (f.size > maxZmodemUploadSize) {
    //   if (this.zsession) {
    //     this.zsession.abort()
    //   }
    //   this.onZmodemEnd()
    //   // if (this.props.tab.enableSftp) {
    //   //   notification.info({
    //   //     message: `Uploading by sftp`,
    //   //     duration: 8
    //   //   })
    //   //   return this.transferBySftp(files)
    //   // } else {
    //   const url = 'https://github.com/FGasper/zmodemjs/issues/11'
    //   const msg = (
    //     <div>
    //       <p>Currently <b>rz</b> only support upload file size less than {filesize(maxZmodemUploadSize)}, due to known issue:</p>
    //       <p><Link to={url}>{url}</Link></p>
    //       <p>You can try upload in sftp which is much faster.</p>
    //     </div>
    //   )
    //   notification.error({
    //     message: msg,
    //     duration: 8
    //   })
    //   // }
    // }
    const th = this
    Zmodem.Browser.send_files(
      this.zsession,
      files, {
        on_offer_response (obj, xfer) {
          if (xfer) {
            th.updateProgress(xfer, transferTypeMap.upload)
          }
        },
        on_progress (obj, xfer) {
          th.updateProgress(xfer, transferTypeMap.upload)
        }
      }
    )
      .then(th.onZmodemEndSend)
      .catch(th.onZmodemCatch)

    return false
  }

  onSendZmodemSession = () => {
    this.setState(() => {
      return {
        zmodemTransfer: {
          type: transferTypeMap.upload
        }
      }
    })
  }

  cancelZmodem = () => {
    this.onZmodemEndSend()
  }

  onZmodemEndSend = () => {
    this.zsession && this.zsession.close && this.zsession.close()
    this.onZmodemEnd()
  }

  onZmodemEnd = () => {
    delete this.onZmodem
    this.onCanceling = true
    this.attachAddon = new AttachAddon(
      this.socket,
      undefined,
      this.props.tab.encode,
      isWin && !this.isRemote()
    )
    if (this.decoder) {
      this.attachAddon.decoder = this.decode
    }
    this.term.loadAddon(this.attachAddon)
    this.setState(() => {
      return {
        zmodemTransfer: null
      }
    })
    this.term.focus()
    this.term.write('\r\n')
  }

  onZmodemCatch = (e) => {
    window.store.onError(e)
    this.onZmodemEnd()
  }

  onZmodemDetect = detection => {
    this.onCanceling = false
    this.attachAddon.dispose()
    this.term.blur()
    this.onZmodem = true
    const zsession = detection.confirm()
    this.zsession = zsession
    if (zsession.type === 'receive') {
      this.onReceiveZmodemSession()
    } else {
      this.onSendZmodemSession()
    }
  }

  split = () => {
    this.props.handleSplit(null, this.props.id)
  }

  onContextAction = e => {
    const {
      action,
      id,
      args = [],
      func
    } = e.data || {}
    if (
      action !== commonActions.clickContextMenu ||
      id !== this.uid ||
      !this[func]
    ) {
      return false
    }
    window.removeEventListener('message', this.onContextAction)
    this[func](...args)
  }

  onContextMenu = e => {
    e.preventDefault()
    if (this.state.loading) {
      return
    }
    if (this.props.config.pasteWhenContextMenu) {
      return this.onPaste()
    }
    const items = this.renderContext()
    this.uid = generate()
    window.store.openContextMenu({
      id: this.uid,
      items,
      pos: computePos(e)
    })
    window.addEventListener('message', this.onContextAction)
  }

  onCopy = () => {
    const selected = this.term.getSelection()
    copy(selected)
    this.term.focus()
  }

  onSelectAll = () => {
    this.term.selectAll()
  }

  onClear = () => {
    this.term.clear()
    this.term.focus()
    this.notifyOnData('')
  }

  isRemote = () => {
    return this.props.tab?.host &&
    this.props.tab?.type !== terminalSshConfigType
  }

  onPaste = () => {
    let selected = readClipboard()
    if (isWin && this.isRemote()) {
      selected = selected.replace(/\r\n/g, '\n')
    }
    this.term.paste(selected)
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

  renderContext = () => {
    const hasSlected = this.term.hasSelection()
    const copyed = readClipboard()
    const copyShortcut = this.getShortcut('terminal_copy')
    const pasteShortcut = this.getShortcut('terminal_paste')
    const clearShortcut = this.getShortcut('terminal_clear')
    const selectAllShortcut = this.getShortcut('terminal_selectAll')
    const searchShortcut = this.getShortcut('terminal_search')
    return [
      {
        func: 'onCopy',
        icon: 'CopyOutlined',
        text: m('copy'),
        disabled: !hasSlected,
        subText: copyShortcut
      },
      {
        func: 'onPaste',
        icon: 'SwitcherOutlined',
        text: m('paste'),
        disabled: !copyed,
        subText: pasteShortcut
      },
      {
        func: 'onClear',
        icon: 'ReloadOutlined',
        text: e('clear'),
        subText: clearShortcut
      },
      {
        func: 'onSelectAll',
        icon: 'SelectOutlined',
        text: e('selectAll'),
        subText: selectAllShortcut
      },
      {
        func: 'toggleSearch',
        icon: 'SearchOutlined',
        text: e('search'),
        subText: searchShortcut
      },
      {
        func: 'split',
        icon: 'BorderHorizontalOutlined',
        text: e('split')
      }
    ]
  }

  loadState = term => {
    const uid = this.props.stateId || this.state.id
    if (uid === termInitId) {
      const id = createLsId(this.props.stateId || this.state.id)
      let str = ls.getItem(id)
      const after = '\r\n\r\n=======\r\nload from history\r\n=======\r\n\r\n'
      str = str.replace(/\s+=======\s+load from history\s+=======\s+/g, '\r\n').trim()
      if (str) {
        term.write(str + after)
      }
    }
  }

  notifyOnData = debounce(() => {
    const str = this.serializeAddon.serialize()
    const id = createLsId(this.state.id)
    ls.setItem(id, str)
    postMessage({
      action: 'terminal-receive-data',
      tabId: this.props.tab.id
    })
  }, 100)

  onSocketData = () => {
    if (this.state.id === termInitId) {
      runIdle(this.notifyOnData)
    }
  }

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

  onKey = ({ key }) => {
    if (key === '\x7F') {
      this.dataCache = this.dataCache.slice(0, -1)
    } else {
      this.dataCache += key
    }
  }

  onData = (d) => {
    if (!d.includes('\r')) {
      delete this.userTypeExit
    } else {
      const data = this.parse(this.dataCache.trim())
      this.dataCache = ''
      if (data === 'exit') {
        this.userTypeExit = true
        this.timers.userTypeExit = setTimeout(() => {
          delete this.userTypeExit
        }, 2000)
      }
    }
  }

  loadRenderer = (term, config) => {
    if (config.rendererType === rendererTypes.canvas) {
      term.loadAddon(new CanvasAddon())
    } else if (config.rendererType === rendererTypes.webGL) {
      try {
        term.loadAddon(new WebglAddon())
      } catch (e) {
        log.error('render with webgl failed, fallback to canvas')
        log.error(e)
        term.loadAddon(new CanvasAddon())
      }
    }
  }

  initTerminal = async () => {
    const { id } = this.state
    // let {password, privateKey, host} = this.props.tab
    const { themeConfig, tab = {}, config = {} } = this.props
    const term = new Terminal({
      allowProposedApi: true,
      scrollback: config.scrollback,
      rightClickSelectsWord: config.rightClickSelectsWord || false,
      fontFamily: tab.fontFamily || config.fontFamily,
      theme: themeConfig,
      allowTransparency: true,
      // lineHeight: 1.2,
      wordSeparator: config.terminalWordSeparator,
      cursorStyle: config.cursorStyle,
      cursorBlink: config.cursorBlink,
      fontSize: tab.fontSize || config.fontSize,
      screenReaderMode: config.screenReaderMode
    })

    // term.onLineFeed(this.onLineFeed)
    // term.onTitleChange(this.onTitleChange)
    term.onSelectionChange(this.onSelection)
    this.loadState(term)
    term.open(document.getElementById(id), true)
    this.loadRenderer(term, config)
    term.textarea.addEventListener('focus', this.setActive)
    term.onKey(this.onKey)
    // term.textarea.addEventListener('blur', this.onBlur)

    // term.on('keydown', this.handleEvent)
    this.fitAddon = new FitAddon()
    this.searchAddon = new SearchAddon()
    const ligtureAddon = new LigaturesAddon()
    this.searchAddon.onDidChangeResults(this.onSearchResultsChange)
    const unicode11Addon = new Unicode11Addon()
    this.serializeAddon = new SerializeAddon()
    term.loadAddon(this.serializeAddon)
    term.loadAddon(unicode11Addon)
    term.loadAddon(ligtureAddon)
    // activate the new version
    term.unicode.activeVersion = '11'
    term.loadAddon(this.fitAddon)
    term.loadAddon(this.searchAddon)
    term.onData(this.onData)
    this.term = term
    term.attachCustomKeyEventHandler(this.handleKeyboardEvent.bind(this))
    term.attachCustomKeyEventHandler(this.handleKey)
    await this.remoteInit(term)
  }

  handleKey = ev => {
    const keymap = [
      { key: 'Backspace', shiftKey: false, mapCode: 8 },
      { key: 'Backspace', shiftKey: true, mapCode: 127 }
    ]
    if (ev.type === 'keydown') {
      for (const i in keymap) {
        if (keymap[i].key === ev.key && keymap[i].shiftKey === ev.shiftKey) {
          this.socket.send(String.fromCharCode(keymap[i].mapCode))
          return false
        }
      }
    }
  }

  setActive = () => {
    this.props.setActive(this.props.id)
    window.store.storeAssign({
      activeTerminalId: this.props.id
    })
  }

  runInitScript = () => {
    const {
      type,
      title,
      startDirectory,
      runScripts
    } = this.props.tab
    if (type === terminalSshConfigType) {
      const cmd = `ssh ${title.split(/\s/g)[0]}\r`
      return this.attachAddon._sendData(cmd)
    }
    if (startDirectory) {
      const cmd = `cd ${startDirectory}\r`
      this.attachAddon._sendData(cmd)
    }
    if (runScripts && runScripts.length) {
      this.delayedScripts = deepCopy(runScripts)
      this.timers.timerDelay = setTimeout(this.runDelayedScripts, this.delayedScripts[0].delay || 0)
    }
  }

  runDelayedScripts = () => {
    const { delayedScripts } = this
    if (delayedScripts && delayedScripts.length > 0) {
      const obj = delayedScripts.shift()
      if (obj.script) {
        this.attachAddon._sendData(obj.script + '\r')
      }
      if (delayedScripts.length > 0) {
        this.timers.timerDelay = setTimeout(this.runDelayedScripts, this.delayedScripts[0].delay || 0)
      }
    }
  }

  count = 0

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

  remoteInit = async (term = this.term) => {
    this.setState({
      loading: true
    })
    const { cols, rows } = term
    const { config } = this.props
    const {
      host,
      port,
      tokenElecterm,
      keywords = [],
      server = ''
    } = config
    const { sessionId, terminalIndex, id, logName } = this.props
    const tab = deepCopy(this.props.tab || {})
    const {
      srcId, from = 'bookmarks',
      type,
      encode,
      term: terminalType,
      displayRaw
    } = tab
    const { savePassword } = this.state
    const isSshConfig = type === terminalSshConfigType
    const termType = isSshConfig
      ? typeMap.local
      : type
    const extra = this.props.sessionOptions
    const opts = clone({
      cols,
      rows,
      term: terminalType || config.terminalType,
      saveTerminalLogToFile: config.saveTerminalLogToFile,
      ...tab,
      ...extra,
      logName,
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
      sessionId,
      tabId: id,
      terminalIndex,
      termType,
      readyTimeout: config.sshReadyTimeout,
      proxy: getProxy(tab, config),
      type: tab.host && !isSshConfig
        ? typeMap.remote
        : typeMap.local
    })
    delete opts.terminals
    let pid = await createTerm(opts)
      .catch(err => {
        const text = err.message
        handleErr({ message: text })
      })
    pid = pid || ''
    if (pid.includes('fail')) {
      return this.promote()
    }
    if (savePassword) {
      window.store.editItem(srcId, extra, from)
    }
    this.setState({
      loading: false
    })
    if (!pid) {
      this.setStatus(statusMap.error)
      return
    }
    this.setStatus(statusMap.success)
    this.props.setSessionState({
      pid
    })
    term.pid = pid
    this.pid = pid
    this.setState({
      pid
    })
    const hs = server
      ? server.replace(/https?:\/\//, '')
      : `${host}:${port}`
    const pre = server.startsWith('https') ? 'wss' : 'ws'
    const wsUrl = `${pre}://${hs}/terminals/${pid}?sessionId=${sessionId}&token=${tokenElecterm}`
    const socket = new WebSocket(wsUrl)
    socket.onclose = this.oncloseSocket
    socket.onerror = this.onerrorSocket
    socket.onopen = () => {
      this.attachAddon = new AttachAddon(
        socket,
        undefined,
        encode,
        isWin && !this.isRemote()
      )
      term.loadAddon(this.attachAddon)
      socket.addEventListener('message', this.onSocketData)
      this.runInitScript()
      term._initialized = true
    }
    this.socket = socket
    // term.onRrefresh(this.onRefresh)
    term.onResize(this.onResizeTerminal)
    if (pick(term, 'buffer._onBufferChange._listeners')) {
      term.buffer._onBufferChange._listeners.push(this.onBufferChange)
    }
    const cid = this.props.currentTabId
    const tid = this.props.tab.id
    if (cid === tid && this.props.tab.status === statusMap.success) {
      term.loadAddon(new WebLinksAddon(this.webLinkHandler))
      term.focus()
      this.zmodemAddon = new AddonZmodem()
      this.fitAddon.fit()
      term.loadAddon(this.zmodemAddon)
      term.zmodemAttach(this.socket, {
        noTerminalWriteOutsideSession: true
      }, this)
    }
    term.displayRaw = displayRaw
    term.loadAddon(
      new KeywordHighlighterAddon(keywords)
    )
    this.term = term
    window.store.triggerResize()
  }

  onResize = throttle(() => {
    const cid = this.props.currentTabId
    const tid = this.props.tab?.id
    if (
      this.props.tab.status === statusMap.success &&
      cid === tid &&
      this.term
    ) {
      try {
        this.fitAddon.fit()
      } catch (e) {
        log.info('resize failed')
      }
    }
  }, 200)

  onerrorSocket = err => {
    this.setStatus(statusMap.error)
    log.warning('onerrorSocket', err)
  }

  oncloseSocket = () => {
    if (this.onClose) {
      return
    }
    this.setStatus(
      statusMap.error
    )
    if (!this.isActiveTerminal() || !window.focused) {
      return false
    }
    if (this.userTypeExit) {
      return this.props.delSplit(this.state.id)
    }
    const key = `open${Date.now()}`
    function closeMsg () {
      notification.destroy(key)
    }
    this.socketCloseWarning = notification.warning({
      key,
      message: e('socketCloseTip'),
      description: (
        <div className='pd2y'>
          <Button
            className='mg1r'
            type='primary'
            onClick={() => {
              closeMsg()
              this.props.delSplit(this.state.id)
            }}
          >
            {m('close')}
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
            {m('reload')}
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
    resizeTerm(this.pid, this.props.sessionId, cols, rows)
  }

  handleCancel = () => {
    const { id } = this.props.tab
    this.props.delTab(id)
  }

  handleShowInfo = () => {
    const { id, sessionId, logName } = this.props
    const { pid } = this.state
    const infoProps = {
      logName,
      id,
      pid,
      sessionId,
      isRemote: this.isRemote(),
      isActive: this.isActiveTerminal()
    }
    this.props.handleShowInfo(infoProps)
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
    this.decode = new TextDecoder(encode)
    this.attachAddon.decoder = this.decode
  }

  render () {
    const { id, loading, zmodemTransfer } = this.state
    const { height, width, left, top, position, id: pid, activeSplitId } = this.props
    const cls = classnames('term-wrap', {
      'not-first-term': !!position
    }, 'tw-' + pid, {
      'terminal-not-active': activeSplitId !== pid
    })
    const prps1 = {
      className: cls,
      style: {
        height,
        width,
        left,
        top,
        zIndex: position / 10
      },
      onDrop: this.onDrop
    }
    // const fileProps = {
    //   type: 'file',
    //   multiple: true,
    //   id: `${id}-file-sel`,
    //   className: 'hide'
    // }
    const prps2 = {
      className: 'absolute term-wrap-1',
      style: {
        left: '10px',
        top: '10px',
        right: 0,
        bottom: 0
      }
    }
    const prps3 = {
      id,
      className: 'absolute term-wrap-2',
      style: {
        left: 0,
        top: 0,
        height: '100%',
        width: '100%'
      }
    }
    return (
      <div
        {...prps1}
      >
        <div
          {...prps2}
        >
          <div
            {...prps3}
          />
          <NormalBuffer
            lines={this.state.lines}
            close={this.closeNormalBuffer}
          />
        </div>
        <ZmodemTransfer
          zmodemTransfer={zmodemTransfer}
          cancelZmodem={this.cancelZmodem}
          beforeZmodemUpload={this.beforeZmodemUpload}
        />
        <Spin className='loading-wrapper' spinning={loading} />
      </div>
    )
  }
}

export default shortcutDescExtend(shortcutExtend(Term))
