import { Component, createRef } from 'react'
import { handleErr } from '../../common/fetch.jsx'
import generate from '../../common/uid.js'
import { isEqual, pick, debounce, throttle } from 'lodash-es'
import clone from '../../common/to-simple-obj.js'
// import runIdle from '../../common/run-idle'
import {
  ReloadOutlined
} from '@ant-design/icons'
import {
  notification,
  Spin,
  Button,
  Dropdown
} from 'antd'
import classnames from 'classnames'
import './terminal.styl'
import {
  statusMap,
  paneMap,
  typeMap,
  isWin,
  transferTypeMap,
  rendererTypes,
  cwdId,
  isMac,
  zmodemTransferPackSize
} from '../../common/constants.js'
import deepCopy from 'json-deep-copy'
import { readClipboardAsync, copy } from '../../common/clipboard.js'
import { FitAddon } from '@xterm/addon-fit'
import AttachAddon from './attach-addon-custom.js'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { CanvasAddon } from '@xterm/addon-canvas'
import { WebglAddon } from '@xterm/addon-webgl'
import { LigaturesAddon } from '@xterm/addon-ligatures'
import getProxy from '../../common/get-proxy.js'
import { AddonZmodem } from './xterm-zmodem.js'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import keyControlPressed from '../../common/key-control-pressed.js'
import { Terminal } from '@xterm/xterm'
import NormalBuffer from './normal-buffer.jsx'
import { createTerm, resizeTerm } from './terminal-apis.js'
import { shortcutExtend, shortcutDescExtend } from '../shortcuts/shortcut-handler.js'
import { KeywordHighlighterAddon } from './highlight-addon.js'
import { getLocalFileInfo } from '../sftp/file-read.js'
import { CommandTrackerAddon } from './command-tracker-addon.js'
import AIIcon from '../icons/ai-icon.jsx'
import { formatBytes } from '../../common/byte-format.js'
import * as fs from './fs.js'
import iconsMap from '../sys-menu/icons-map.jsx'
import { refs } from '../common/ref.js'
import createDefaultLogPath from '../../common/default-log-path.js'

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
      lines: []
    }
  }

  domRef = createRef()

  componentDidMount () {
    this.id = `term-${this.props.tab.id}`
    refs.add(this.id, this)
    this.initTerminal()
    if (this.props.tab.enableSsh === false) {
      ;(
        document.querySelector('.session-current .term-sftp-tabs .type-tab.sftp') ||
        document.querySelector('.session-current .term-sftp-tabs .type-tab.fileManager')
      ).click()
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
      this.term.options.theme = {
        ...deepCopy(this.props.themeConfig),
        background: 'rgba(0,0,0,0)'
      }
    }

    const sftpPathFollowSshChanged = !isEqual(
      this.props.sftpPathFollowSsh,
      prevProps.sftpPathFollowSsh
    )

    if (sftpPathFollowSshChanged) {
      const ps1Cmd = `\recho $0|grep csh >/dev/null && set prompt_bak="$prompt" && set prompt="$prompt${cwdId}%/${cwdId}"\r
echo $0|grep zsh >/dev/null && PS1_bak=$PS1&&PS1=$PS1'${cwdId}%d${cwdId}'\r
echo $0|grep ash >/dev/null && PS1_bak=$PS1&&PS1=$PS1'\`echo ${cwdId}$PWD${cwdId}\`'\r
echo $0|grep ksh >/dev/null && PS1_bak=$PS1&&PS1=$PS1'\`echo ${cwdId}$PWD${cwdId}\`'\r
echo $0|grep '^sh' >/dev/null && PS1_bak=$PS1&&PS1=$PS1'\`echo ${cwdId}$PWD${cwdId}\`'\r
clear\r`
      const ps1RestoreCmd = `\recho $0|grep csh >/dev/null && set prompt="$prompt_bak"\r
echo $0|grep zsh >/dev/null && PS1="$PS1_bak"\r
echo $0|grep ash >/dev/null && PS1="$PS1_bak"\r
echo $0|grep ksh >/dev/null && PS1="$PS1_bak"\r
echo $0|grep '^sh' >/dev/null && PS1="$PS1_bak"\r
clear\r`

      if (this.props.sftpPathFollowSsh) {
        this.socket.send(ps1Cmd)
        this.term.cwdId = cwdId
      } else {
        this.socket.send(ps1RestoreCmd)
        delete this.term.cwdId
      }
    }
  }

  componentWillUnmount () {
    refs.remove(this.id)
    if (this.zsession) {
      this.onZmodemEnd()
    }
    this.term.parent = null
    Object.keys(this.timers).forEach(k => {
      clearTimeout(this.timers[k])
      this.timers[k] = null
    })
    this.timers = null
    this.onClose = true
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    if (this.term) {
      this.term.dispose()
      this.term = null
    }
    window.removeEventListener(
      'resize',
      this.onResize
    )
    this.attachAddon = null
    this.fitAddon = null
    this.zmodemAddon = null
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
    this.props.pane === paneMap.terminal
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

  runQuickCommand = (cmd, inputOnly = false) => {
    this.term && this.attachAddon._sendData(
      cmd +
      (inputOnly ? '' : '\r')
    )
    this.term.focus()
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
    }).catch(() => false)
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
    }).catch(() => false)
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
    this.zmodemSavePath = null
    this.onCanceling = true
    if (this.downloadFd) {
      await fs.close(this.downloadFd)
    }
    if (this.xfer && this.xfer.end) {
      await this.xfer.end().catch(
        console.error
      )
    }
    this.xfer = null
    if (this.zsession && this.zsession.close) {
      await this.zsession.close().catch(
        console.error
      )
    }
    this.zsession = null
    this.term.focus()
    this.term.write('\r\n')
    this.onZmodem = false
    this.downloadFd = null
    // delete this.downloadPath
    // delete this.downloadCount
    // delete this.downloadSize
    this.DownloadCache = null
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

  onPaste = async () => {
    let selected = await readClipboardAsync()
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
    if (
      this.props.sftpPathFollowSsh &&
      this.term.buffer.active.type !== 'alternate' && !this.term.cwdId
    ) {
      this.term.cwdId = cwdId

      const ps1Cmd = `\recho $0|grep csh >/dev/null && set prompt_bak="$prompt" && set prompt="$prompt${cwdId}%/${cwdId}"\r
echo $0|grep zsh >/dev/null && PS1_bak=$PS1&&PS1=$PS1'${cwdId}%d${cwdId}'\r
echo $0|grep ash >/dev/null && PS1_bak=$PS1&&PS1=$PS1'\`echo ${cwdId}$PWD${cwdId}\`'\r
echo $0|grep ksh >/dev/null && PS1_bak=$PS1&&PS1=$PS1'\`echo ${cwdId}$PWD${cwdId}\`'\r
clear\r`

      this.socket.send(ps1Cmd)
    }
  }

  setCwd = (cwd) => {
    this.props.setCwd(cwd, this.state.id)
  }

  onData = (d) => {
    if (this.cmdAddon) {
      this.cmdAddon.handleData(d)
    }
    if (!d.includes('\r')) {
      delete this.userTypeExit
    } else {
      const data = this.getCmd().trim()
      if (this.term.buffer.active.type !== 'alternate') {
        this.timers.getCwd = setTimeout(this.getCwd, 200)
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
    // let {password, privateKey, host} = this.props.tab
    const { themeConfig, tab = {}, config = {} } = this.props
    const tc = deepCopy(themeConfig)
    tc.background = 'rgba(0,0,0,0)'
    const term = new Terminal({
      allowProposedApi: true,
      scrollback: config.scrollback,
      rightClickSelectsWord: config.rightClickSelectsWord || false,
      fontFamily: tab.fontFamily || config.fontFamily,
      theme: tc,
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
    term.open(this.domRef.current, true)
    this.loadRenderer(term, config)
    // term.textarea.addEventListener('click', this.setActive)
    // term.onKey(this.onKey)
    // term.textarea.addEventListener('blur', this.onBlur)

    // term.on('keydown', this.handleEvent)
    this.fitAddon = new FitAddon()
    this.cmdAddon = new CommandTrackerAddon()
    this.searchAddon = new SearchAddon()
    const ligtureAddon = new LigaturesAddon()
    this.searchAddon.onDidChangeResults(this.onSearchResultsChange)
    const unicode11Addon = new Unicode11Addon()
    term.loadAddon(unicode11Addon)
    term.loadAddon(ligtureAddon)
    // activate the new version
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

  runInitScript = () => {
    window.store.triggerResize()
    const {
      startDirectory,
      runScripts
    } = this.props.tab
    const startFolder = startDirectory || window.initFolder
    if (startFolder) {
      const cmd = `cd "${startFolder}"\r`
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
        const nextDelay = delayedScripts[0].delay || 0
        this.timers.timerDelay = setTimeout(this.runDelayedScripts, nextDelay)
      }
    }
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

  buildWsUrl = () => {
    const { host, port, tokenElecterm } = this.props.config
    const { id } = this.props.tab
    if (window.et.buildWsUrl) {
      return window.et.buildWsUrl(
        host,
        port,
        tokenElecterm,
        id,
        this.props.sessionId
      )
    }
    return `ws://${host}:${port}/terminals/${id}?sessionId=${this.props.sessionId}&token=${tokenElecterm}`
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
      srcTabId: tab.id,
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
        log.info('resize failed')
      }
    }
  }, 200)

  onerrorSocket = err => {
    log.error('onerrorSocket', err)
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
    resizeTerm(this.pid, this.props.sessionId, cols, rows)
  }

  handleCancel = () => {
    const { id } = this.props.tab
    this.props.delTab(id)
  }

  handleShowInfo = () => {
    const { sessionId, logName, tab } = this.props
    const infoProps = {
      logName,
      id: tab.id,
      pid: tab.id,
      sessionId,
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
    const { height, width, left, top } = this.props
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
        left: '10px',
        top: '10px',
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
          <Spin className='loading-wrapper' spinning={loading} />
        </div>
      </Dropdown>
    )
  }
}

export default shortcutDescExtend(shortcutExtend(Term))
