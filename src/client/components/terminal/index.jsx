import { Component } from 'react'
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
  cwdId,
  isMac,
  zmodemTransferPackSize
} from '../../common/constants'
import deepCopy from 'json-deep-copy'
import { readClipboardAsync, copy } from '../../common/clipboard'
import { FitAddon } from 'xterm-addon-fit'
import AttachAddon from './attach-addon-custom'
import { SearchAddon } from 'xterm-addon-search'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { CanvasAddon } from 'xterm-addon-canvas'
import { WebglAddon } from 'xterm-addon-webgl'
import { LigaturesAddon } from 'xterm-addon-ligatures'
import getProxy from '../../common/get-proxy'
import { AddonZmodem } from './xterm-zmodem'
import { Unicode11Addon } from 'xterm-addon-unicode11'
import keyControlPressed from '../../common/key-control-pressed'
import { Terminal } from 'xterm'
import NormalBuffer from './normal-buffer'
import { createTerm, resizeTerm } from './terminal-apis'
import { shortcutExtend, shortcutDescExtend } from '../shortcuts/shortcut-handler.js'
import { KeywordHighlighterAddon } from './highlight-addon.js'
import { getLocalFileInfo } from '../sftp/file-read.js'
import { SerializeAddon } from 'xterm-addon-serialize'
import strip from '@electerm/strip-ansi'
import { formatBytes } from '../../common/byte-format.js'
import * as fs from './fs.js'

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
      lines: []
    }
  }

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
    if (this.zsession) {
      this.onZmodemEnd()
    }
    delete this.term.parent
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

  initAttachAddon = () => {
    this.attachAddon = new AttachAddon(
      this.term,
      this.socket,
      isWin && !this.isRemote()
    )
    this.attachAddon.decoder = new TextDecoder(
      this.encode || this.props.tab.encode || 'utf-8'
    )
    this.term.loadAddon(this.attachAddon)
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

  pasteShortcut = (e) => {
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

  writeBanner = (type) => {
    this.term.write('\r\nRecommmend use trzsz instead: https://github.com/trzsz/trzsz\r\n')
    this.term.write(`\x1b[32mZMODEM::${type}::START\x1b[0m\r\n\r\n`)
  }

  onReceiveZmodemSession = async () => {
    const savePath = await this.openSaveFolderSelect()
    this.zsession.on('offer', this.onOfferReceive)
    this.zsession.start()
    this.term.write('\r\n\x1b[2A\r\n')
    if (!savePath) {
      return this.onZmodemEnd()
    }
    this.writeBanner('RECEIVE')
    this.zmodemSavePath = savePath
    return new Promise((resolve) => {
      this.zsession.on('session_end', resolve)
    })
      .then(this.onZmodemEnd)
      .catch(this.onZmodemCatch)
  }

  initZmodemDownload = async (name, size) => {
    if (!this.zmodemSavePath) {
      return
    }
    let pth = window.pre.resolve(
      this.zmodemSavePath, name
    )
    const exist = await fs.exists(pth).catch(() => false)
    if (exist) {
      pth = pth + '.' + generate()
    }
    const fd = await fs.open(pth, 'w').catch(this.onZmodemEnd)
    this.downloadFd = fd
    this.downloadPath = pth
    this.downloadCount = 0
    this.zmodemStartTime = Date.now()
    this.downloadSize = size
    this.updateZmodemProgress(
      0, pth, size, transferTypeMap.download
    )
    return fd
  }

  onOfferReceive = async (xfer) => {
    const {
      name,
      size
    } = xfer.get_details()
    if (!this.downloadFd) {
      await this.initZmodemDownload(name, size)
    }
    xfer.on('input', this.onZmodemDownload)
    this.xfer = xfer
    await xfer.accept()
      .then(this.finishZmodemTransfer)
      .catch(this.onZmodemEnd)
  }

  checkCache = async () => {
    if (this.DownloadCache?.length > 0) {
      return fs.write(this.downloadFd, new Uint8Array(this.DownloadCache))
    }
  }

  onZmodemDownload = async payload => {
    if (this.onCanceling || !this.downloadFd) {
      return
    }
    // if (!this.DownloadCache) {
    //   this.DownloadCache = []
    // }
    // this.DownloadCache = this.DownloadCache.concat(payload)
    // this.downloadCount += payload.length
    // if (this.DownloadCache.length < zmodemTransferPackSize) {
    //   return this.updateZmodemProgress(
    //     this.downloadCount,
    //     this.downloadPath,
    //     this.downloadSize,
    //     transferTypeMap.download
    //   )
    // }
    // this.writeCache = this.DownloadCache
    // this.DownloadCache = []
    this.downloadCount += payload.length
    await fs.write(this.downloadFd, new Uint8Array(payload))
    this.updateZmodemProgress(
      this.downloadCount,
      this.downloadPath,
      this.downloadSize,
      transferTypeMap.download
    )
  }

  updateZmodemProgress = throttle((start, name, size, type) => {
    this.zmodemTransfer = {
      type,
      start,
      name,
      size
    }
    this.writeZmodemProgress()
  }, 500)

  finishZmodemTransfer = () => {
    this.zmodemTransfer = {
      ...this.zmodemTransfer,
      start: this.zmodemTransfer.size
    }
    this.writeZmodemProgress()
  }

  writeZmodemProgress = () => {
    if (this.onCanceling) {
      return
    }
    const {
      size, start, name
    } = this.zmodemTransfer
    const speed = size > 0 ? formatBytes(start * 1000 / 1024 / (Date.now() - this.zmodemStartTime)) : 0
    const percent = size > 0 ? Math.floor(start * 100 / size) : 100
    const str = `\x1b[32m${name}\x1b[0m::${percent}%,${start}/${size},${speed}/s`
    this.term.write('\r\n\x1b[2A' + str + '\n')
  }

  zmodemTransferFile = async (file, filesRemaining, sizeRemaining) => {
    const offer = {
      obj: file,
      name: file.name,
      size: file.size,
      files_remaining: filesRemaining,
      bytes_remaining: sizeRemaining
    }
    const xfer = await this.zsession.send_offer(offer)
    if (!xfer) {
      this.onZmodemEnd()
      return window.store.onError(new Error('Transfer cancelled, maybe file already exists'))
    }
    this.zmodemStartTime = Date.now()
    const fd = await fs.open(file.filePath, 'r')
    let start = 0
    const { size } = file
    let inited = false
    while (start < size || !inited) {
      const rest = size - start
      const len = rest > zmodemTransferPackSize ? zmodemTransferPackSize : rest
      const buffer = new Uint8Array(len)
      const newArr = await fs.read(fd, buffer, 0, len, null)
      const n = newArr.length
      await xfer.send(newArr)
      start = start + n
      inited = true
      this.updateZmodemProgress(start, file.name, size, transferTypeMap.upload)
      if (n < zmodemTransferPackSize || start >= file.size || this.onCanceling) {
        break
      }
    }
    await fs.close(fd)
    this.finishZmodemTransfer()
    await xfer.end()
  }

  openFileSelect = async () => {
    const properties = [
      'openFile',
      'multiSelections',
      'showHiddenFiles',
      'noResolveAliases',
      'treatPackageAsDirectory',
      'dontAddToRecent'
    ]
    const files = await window.api.openDialog({
      title: 'Choose some files to send',
      message: 'Choose some files to send',
      properties
    })
    if (!files || !files.length) {
      return this.onZmodemEnd()
    }
    const r = []
    for (const filePath of files) {
      const stat = await getLocalFileInfo(filePath)
      r.push({ ...stat, filePath })
    }
    return r
  }

  openSaveFolderSelect = async () => {
    const savePaths = await window.api.openDialog({
      title: 'Choose a folder to save file(s)',
      message: 'Choose a folder to save file(s)',
      properties: [
        'openDirectory',
        'showHiddenFiles',
        'createDirectory',
        'noResolveAliases',
        'treatPackageAsDirectory',
        'dontAddToRecent'
      ]
    })
    if (!savePaths || !savePaths.length) {
      return false
    }
    return savePaths[0]
  }

  beforeZmodemUpload = async (files) => {
    if (!files || !files.length) {
      return false
    }
    this.writeBanner('SEND')
    let filesRemaining = files.length
    let sizeRemaining = files.reduce((a, b) => a + b.size, 0)
    for (const f of files) {
      await this.zmodemTransferFile(f, filesRemaining, sizeRemaining)
      filesRemaining = filesRemaining - 1
      sizeRemaining = sizeRemaining - f.size
    }
    this.onZmodemEnd()
  }

  onSendZmodemSession = async () => {
    this.term.write('\r\n\x1b[2A\n')
    const files = await this.openFileSelect()
    this.beforeZmodemUpload(files)
  }

  onZmodemEnd = async () => {
    delete this.zmodemSavePath
    this.onCanceling = true
    if (this.downloadFd) {
      await fs.close(this.downloadFd)
    }
    if (this.xfer && this.xfer.end) {
      await this.xfer.end().catch(
        console.error
      )
    }
    delete this.xfer
    if (this.zsession && this.zsession.close) {
      await this.zsession.close().catch(
        console.error
      )
    }
    delete this.zsession
    this.term.focus()
    this.term.write('\r\n')
    this.onZmodem = false
    delete this.downloadFd
    delete this.downloadPath
    delete this.downloadCount
    delete this.downloadSize
    delete this.DownloadCache
  }

  onZmodemCatch = (e) => {
    window.store.onError(e)
    this.onZmodemEnd()
  }

  onZmodemDetect = detection => {
    this.onCanceling = false
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

  onPaste = async () => {
    let selected = await readClipboardAsync()
    if (isWin && this.isRemote()) {
      selected = selected.replace(/\r\n/g, '\n')
    }
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
    const copyed = true
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

  notifyOnData = debounce(() => {
    postMessage({
      action: 'terminal-receive-data',
      tabId: this.props.tab.id
    })
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

  // onKey = ({ key }) => {
  //   if (key === '\r') {
  //     this.getCmd()
  //   }
  // }

  getCmd = () => {
    const str = this.serializeAddon.serialize()
    const arr = strip(str).split(/ +/)
    const len = arr.length
    return arr[len - 1]
  }

  getCwd = () => {
    if (
      this.props.sftpPathFollowSsh &&
      this.term.buffer.active.type !== 'alternate'
    ) {
      const cmd = `\recho "${cwdId}$PWD"\r`
      this.term.cwdId = cwdId
      this.socket.send(cmd)
    }
  }

  setCwd = (cwd) => {
    this.props.setCwd(cwd, this.state.id)
  }

  onData = (d) => {
    runIdle(this.notifyOnData)
    if (!d.includes('\r')) {
      delete this.userTypeExit
    } else {
      const data = this.getCmd()
      if (this.term.buffer.active.type !== 'alternate') {
        setTimeout(this.getCwd, 200)
      }
      const exitCmds = [
        'exit',
        'logout'
      ]
      if (exitCmds.includes(data)) {
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
    term.parent = this
    term.onSelectionChange(this.onSelection)
    term.open(document.getElementById(id), true)
    this.loadRenderer(term, config)
    term.textarea.addEventListener('focus', this.setActive)
    // term.onKey(this.onKey)
    // term.textarea.addEventListener('blur', this.onBlur)

    // term.on('keydown', this.handleEvent)
    this.fitAddon = new FitAddon()
    this.searchAddon = new SearchAddon()
    const ligtureAddon = new LigaturesAddon()
    this.searchAddon.onDidChangeResults(this.onSearchResultsChange)
    const unicode11Addon = new Unicode11Addon()
    term.loadAddon(unicode11Addon)
    this.serializeAddon = new SerializeAddon()
    term.loadAddon(this.serializeAddon)
    term.loadAddon(ligtureAddon)
    // activate the new version
    term.unicode.activeVersion = '11'
    term.loadAddon(this.fitAddon)
    term.loadAddon(this.searchAddon)
    term.onData(this.onData)
    this.term = term
    term.attachCustomKeyEventHandler(this.handleKeyboardEvent.bind(this))
    await this.remoteInit(term)
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
    this.socket = socket
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
    const cid = this.props.currentTabId
    const tid = this.props.tab.id
    if (cid === tid && this.props.tab.status === statusMap.success) {
      term.loadAddon(new WebLinksAddon(this.webLinkHandler))
      term.focus()
      this.zmodemAddon = new AddonZmodem()
      this.fitAddon.fit()
      term.loadAddon(this.zmodemAddon)
      term.zmodemAttach(this)
    }
    term.displayRaw = displayRaw
    term.loadAddon(
      new KeywordHighlighterAddon(keywords)
    )
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
    log.error('onerrorSocket', err)
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
    this.encode = encode
    this.attachAddon.decoder = new TextDecoder(encode)
  }

  render () {
    const { id, loading } = this.state
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
        <Spin className='loading-wrapper' spinning={loading} />
      </div>
    )
  }
}

export default shortcutDescExtend(shortcutExtend(Term))
