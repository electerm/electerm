
import { Component } from 'react'
import ZmodemTransfer from './zmodem-transfer'
import { handleErr } from '../../common/fetch'
import { mergeProxy } from '../../common/merge-proxy'
import generate from '../../common/uid'
import _ from 'lodash'
import { runCmds } from '../terminal-info/run-cmd'
import postMessage from '../../common/post-msg'

import {
  CheckCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons'

import {
  notification,
  Spin,
  Modal,
  Button,
  Checkbox
} from 'antd'
import Input from '../common/input-auto-focus'
import classnames from 'classnames'
import './terminal.styl'
import {
  statusMap,
  paneMap,
  typeMap,
  isWin,
  isMac,
  terminalSshConfigType,
  transferTypeMap,
  defaultLoginScriptDelay,
  terminalActions,
  commonActions
} from '../../common/constants'
import deepCopy from 'json-deep-copy'
import { readClipboard, copy } from '../../common/clipboard'
import { FitAddon } from 'xterm-addon-fit'
import AttachAddon from './attach-addon-custom'
import { SearchAddon } from 'xterm-addon-search'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { SerializeAddon } from 'xterm-addon-serialize'
import { Zmodem, AddonZmodem } from './xterm-zmodem'
import { Unicode11Addon } from 'xterm-addon-unicode11'
import keyControlPressed from '../../common/key-control-pressed'
import keyShiftPressed from '../../common/key-shift-pressed'
import keyPressed from '../../common/key-pressed'
import { Terminal } from 'xterm'
import * as ls from '../../common/safe-local-storage'
import NormalBuffer from './normal-buffer'
import { createTerm, resizeTerm } from './terminal-apis'
import createLsId from './build-ls-term-id'

const { prefix } = window
const e = prefix('ssh')
const m = prefix('menu')
const f = prefix('form')
const c = prefix('common')
const authFailMsg = 'All configured authentication methods failed'
const privateKeyMsg = 'no passphrase'

const computePos = (e) => {
  return {
    left: e.clientX,
    top: e.clientY
  }
}

export default class Term extends Component {
  constructor (props) {
    super(props)
    this.state = {
      pid: '',
      id: props.id || 'id' + generate(),
      loading: false,
      promoteModalVisible: false,
      savePassword: false,
      tempPassword: '',
      passType: 'password',
      zmodemTransfer: null,
      lines: []
    }
  }

  componentDidMount () {
    this.initTerminal()
    this.initEvt()
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
      !_.isEqual(
        _.pick(this.props, names),
        _.pick(prevProps, names)
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
    const themeChanged = !_.isEqual(
      this.props.themeConfig,
      prevProps.themeConfig
    )
    if (themeChanged) {
      this.term.setOption('theme', this.props.themeConfig)
    }
  }

  componentWillUnmount () {
    Object.keys(this.timers).forEach(k => {
      clearTimeout(this.timers[k])
    })
    clearTimeout(this.timers)
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
        this.term.setOption(name, curr)
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

  isActiveTerminal = () => {
    return this.props.id === this.props.activeSplitId &&
    this.props.tab.id === this.props.currentTabId &&
    this.props.pane === paneMap.terminal
  }

  handleEvent = (e) => {
    const {
      keyword,
      options,
      action,
      encode,
      id,
      type,
      cmd,
      activeSplitId,
      toAll,
      inputOnly
    } = e?.data || {}
    const { id: propSplitId } = this.props
    if (
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
      this.openSearch()
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
    }
    const isActiveTerminal = this.isActiveTerminal()
    if (
      type === 'focus' &&
      isActiveTerminal
    ) {
      e.stopPropagation()
      return this.term && this.term.focus()
    }
    if (
      keyControlPressed(e) &&
      keyShiftPressed(e) &&
      keyPressed(e, 'c')
    ) {
      e.stopPropagation()
      this.copySelectionToClipboard()
    } else if (id === this.props.id) {
      e.stopPropagation()
      this.term.selectAll()
    } else if (
      keyPressed(e, 'f') && keyControlPressed(e) &&
      (
        isMac ||
        (!isMac && keyShiftPressed(e))
      )
    ) {
      e.stopPropagation()
      this.openSearch()
    } else if (
      keyPressed(e, 'tab')
    ) {
      e.stopPropagation()
      e.preventDefault()
      if (e.ctrlKey && e.type === 'keydown') {
        this.props.store.clickNextTab()
        return false
      }
    } else if (
      keyControlPressed(e) &&
      keyPressed(e, 'ArrowUp') && this.bufferMode === 'alternate'
    ) {
      e.stopPropagation()
      this.openNormalBuffer()
    } else if (
      e.ctrlKey &&
      keyPressed(e, 'tab')
    ) {
      this.onClear()
    }
  }

  onDrop = e => {
    const files = _.get(e, 'dataTransfer.files')
    if (files && files.length) {
      this.attachAddon._sendData(
        Array.from(files).map(f => `"${f.path}"`).join(' ')
      )
    }
  }

  onSelection = () => {
    if (this.props.config.copyWhenSelect) {
      this.copySelectionToClipboard()
    }
  }

  copySelectionToClipboard = () => {
    const txt = this.term.getSelection()
    if (txt) {
      copy(txt)
    }
  }

  webLinkHandler = (event, url) => {
    if (!this.props.config.ctrlOrMetaOpenTerminalLink) {
      return window.open(url, '_blank')
    }
    if (keyControlPressed(event)) {
      window.open(url, '_blank')
    }
  }

  onzmodemRetract = () => {
    log.debug('zmodemRetract')
  }

  onReceiveZmodemSession = () => {
    //  * zmodem transfer
    //  * then run rz to send from your browser or
    //  * sz <file> to send from the remote peer.
    this.zsession.on('offer', this.onOfferReceive)
    this.zsession.start()
    return new Promise((resolve) => {
      this.zsession.on('session_end', resolve)
    }).then(this.onZmodemEnd).catch(this.onZmodemCatch)
  }

  updateProgress = (xfer, type) => {
    if (this.onCancel) {
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
      .catch(this.props.store.onError)
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
    this.onCancel = true
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
    this.props.store.onError(e)
    this.onZmodemEnd()
  }

  onZmodemDetect = detection => {
    this.onCancel = false
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
    this.props.doSplit(null, this.props.id)
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
    this.props.store.openContextMenu({
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
  }

  isRemote = () => {
    return _.get(this.props, 'tab.host') &&
    _.get(this.props, 'tab.type') !== terminalSshConfigType
  }

  onPaste = () => {
    let selected = readClipboard()
    if (isWin && this.isRemote()) {
      selected = selected.replace(/\r\n/g, '\n')
    }
    this.term.paste(selected)
    this.term.focus()
  }

  openSearch = () => {
    this.props.store.termSearchOpen = true
  }

  onLineFeed = e => {
    // console.log(e, 'onLineFeed')
  }

  onTitleChange = e => {
    log.debug(e, 'title change')
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
    const copyShortcut = isMac
      ? 'Command+C'
      : 'Ctrl+Shift+C'
    const pasteShortcut = isMac
      ? 'Command+V'
      : 'Ctrl+Shift+V'
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
        subText: 'Ctrl+L'
      },
      {
        func: 'onSelectAll',
        icon: 'SelectOutlined',
        text: e('selectAll')
      },
      {
        func: 'openSearch',
        icon: 'SearchOutlined',
        text: e('search')
      },
      {
        func: 'split',
        icon: 'BorderHorizontalOutlined',
        text: e('split')
      }
    ]
  }

  loadState = term => {
    const id = createLsId(this.props.stateId || this.state.id)
    const str = ls.getItem(id)
    if (str) {
      term.write(str)
    }
  }

  notifyOnData = _.debounce(() => {
    const str = this.serializeAddon.serialize()
    const id = createLsId(this.state.id)
    ls.setItem(id, str)
    postMessage({
      action: 'terminal-receive-data',
      tabId: this.props.tab.id
    })
  }, 1000, {
    leading: true
  })

  onSocketData = () => {
    this.notifyOnData()
  }

  initTerminal = async () => {
    const { id } = this.state
    // let {password, privateKey, host} = this.props.tab
    const { themeConfig, tab = {}, config = {} } = this.props
    const term = new Terminal({
      scrollback: config.scrollback,
      rightClickSelectsWord: config.rightClickSelectsWord || false,
      fontFamily: tab.fontFamily || config.fontFamily,
      theme: themeConfig,
      allowTransparency: true,
      // lineHeight: 1.2,
      cursorStyle: config.cursorStyle,
      cursorBlink: config.cursorBlink,
      fontSize: tab.fontSize || config.fontSize,
      rendererType: config.rendererType
    })
    this.fitAddon = new FitAddon()
    this.searchAddon = new SearchAddon()
    const unicode11Addon = new Unicode11Addon()
    this.serializeAddon = new SerializeAddon()
    term.loadAddon(this.serializeAddon)
    term.loadAddon(unicode11Addon)
    // activate the new version
    term.unicode.activeVersion = '11'
    term.loadAddon(this.fitAddon)
    term.loadAddon(this.searchAddon)
    term.onLineFeed(this.onLineFeed)
    term.onTitleChange(this.onTitleChange)
    term.onSelectionChange(this.onSelection)
    this.loadState(term)
    term.open(document.getElementById(id), true)
    term.textarea.addEventListener('focus', this.setActive)
    // term.textarea.addEventListener('blur', this.onBlur)

    // term.on('keydown', this.handleEvent)
    this.term = term
    // if (host && !password && !privateKey) {
    //   return this.promote()
    // }
    await this.remoteInit(term)
  }

  setActive = () => {
    this.props.setActive(this.props.id)
    this.props.store.storeAssign({
      activeTerminalId: this.props.id
    })
  }

  runInitScript = () => {
    const { type, title, loginScript, startDirectory } = this.props.tab
    let cmd = ''
    if (type === terminalSshConfigType) {
      cmd = `ssh ${title.split(/\s/g)[0]}\r`
    } else if (startDirectory && !loginScript) {
      cmd = `cd ${startDirectory}\r`
    } else if (!startDirectory && loginScript) {
      cmd = loginScript + '\r'
    } else if (startDirectory && loginScript) {
      cmd = `cd ${startDirectory} && ${loginScript}\r`
    }
    this.attachAddon._sendData(cmd)
  }

  count = 0

  setStatus = status => {
    const id = _.get(this.props, 'tab.id')
    this.props.store.editTab(id, {
      status
    })
  }

  watchNormalBufferTrigger = e => {
    if (
      keyControlPressed(e) &&
      keyPressed(e, 'ArrowUp')
    ) {
      e.stopPropagation()
      this.copySelectionToClipboard()
    }
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
    const { host, port, tokenElecterm } = config
    const { sessionId, terminalIndex, id, logName } = this.props
    const tab = deepCopy(this.props.tab || {})
    const {
      srcId, from = 'bookmarks',
      type, loginScript,
      loginScriptDelay = defaultLoginScriptDelay,
      encode,
      term: terminalType,
      startDirectory
    } = tab
    const { savePassword } = this.state
    const isSshConfig = type === terminalSshConfigType
    const termType = isSshConfig
      ? typeMap.local
      : type
    const extra = this.props.sessionOptions
    const opts = {
      cols,
      rows,
      term: terminalType || config.terminalType,
      saveTerminalLogToFile: config.saveTerminalLogToFile,
      ...tab,
      ...extra,
      logName,
      ..._.pick(config, [
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
      proxy: mergeProxy(config, tab),
      type: tab.host && !isSshConfig
        ? typeMap.remote
        : typeMap.local
    }
    delete opts.terminals
    let pid = await createTerm(opts)
      .catch(err => {
        const text = err.message
        if (text.includes(authFailMsg)) {
          this.setState(() => ({ passType: 'password' }))
          return 'fail'
        } else if (text.includes(privateKeyMsg)) {
          this.setState(() => ({ passType: 'passphrase' }))
          return 'fail-private'
        } else {
          handleErr({ message: text })
        }
      })
    pid = pid || ''
    if (pid.includes('fail')) {
      return this.promote()
    }
    if (savePassword) {
      this.props.store.editItem(srcId, extra, from)
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
    const wsUrl = `ws://${host}:${port}/terminals/${pid}?sessionId=${sessionId}&token=${tokenElecterm}`
    const socket = new WebSocket(wsUrl)
    socket.onclose = this.oncloseSocket
    socket.onerror = this.onerrorSocket
    this.attachAddon = new AttachAddon(
      socket,
      undefined,
      encode,
      isWin && !this.isRemote()
    )
    term.loadAddon(this.attachAddon)
    socket.onopen = () => {
      socket.addEventListener('message', this.onSocketData)
      term._initialized = true
    }
    this.socket = socket
    // term.onRrefresh(this.onRefresh)
    term.onResize(this.onResizeTerminal)
    if (_.pick(term, 'buffer._onBufferChange._listeners')) {
      term.buffer._onBufferChange._listeners.push(this.onBufferChange)
    }
    const cid = _.get(this.props, 'currentTabId')
    const tid = _.get(this.props, 'tab.id')
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
    term.attachCustomKeyEventHandler(this.handleEvent)
    // this.decoder = new TextDecoder(encode)
    // const oldWrite = term.write
    // const th = this
    // term.write = function (data) {
    //   let str = ''
    //   if (typeof data === 'object') {
    //     if (data instanceof ArrayBuffer) {
    //       str = th.decoder.decode(data)
    //       oldWrite.call(term, str)
    //     } else {
    //       const fileReader = new FileReader()
    //       fileReader.addEventListener('load', () => {
    //         str = th.decoder.decode(fileReader.result)
    //         console.log(str, '--ff-')
    //         oldWrite.call(term, str)
    //       })
    //       fileReader.readAsArrayBuffer(new window.Blob([data]))
    //     }
    //   } else if (typeof data === 'string') {
    //     oldWrite.call(term, data)
    //   } else {
    //     throw Error(`Cannot handle ${typeof data} websocket message.`)
    //   }
    // }
    this.term = term
    if (startDirectory || loginScript || isSshConfig) {
      this.timers.timer1 = setTimeout(this.runInitScript, loginScriptDelay)
    }
    this.props.store.triggerReszie()
  }

  onResize = _.debounce(() => {
    const cid = _.get(this.props, 'currentTabId')
    const tid = _.get(this.props, 'tab.id')
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
    log.warn('onerrorSocket', err)
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
    const key = `open${Date.now()}`
    function closeMsg () {
      notification.close(key)
    }
    this.socketCloseWarning = notification.warn({
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
              this.props.store.reloadTab(
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

  promote = () => {
    this.setState({
      promoteModalVisible: true,
      tempPassword: ''
    })
  }

  onCancel = () => {
    const { id } = this.props.tab
    this.props.store.delTab({ id })
  }

  onToggleSavePass = () => {
    this.setState({
      savePassword: !this.state.savePassword
    })
  }

  renderPasswordForm = () => {
    const { tempPassword, savePassword, promoteModalVisible } = this.state
    const { type } = this.props.tab
    return (
      <div>
        <Input
          value={tempPassword}
          type='password'
          autofocustrigger={promoteModalVisible ? 1 : 2}
          selectall='yes'
          onChange={this.onChangePass}
          onPressEnter={this.onClickConfirmPass}
        />
        {
          type !== terminalSshConfigType
            ? (
              <div className='pd1t'>
                <Checkbox
                  checked={savePassword}
                  onChange={this.onToggleSavePass}
                >{f('save')}</Checkbox>
              </div>
            )
            : null
        }
      </div>
    )
  }

  onChangePass = e => {
    this.setState({
      tempPassword: e.target.value
    })
  }

  onClickConfirmPass = () => {
    const {
      tempPassword,
      passType
    } = this.state
    this.props.setSessionState(old => {
      const sessionOptions = deepCopy(old.sessionOptions) || {}
      sessionOptions[passType] = tempPassword
      return { sessionOptions }
    })
    this.setState({
      promoteModalVisible: false
    }, this.remoteInit)
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

  getPwd = async () => {
    const { sessionId, config } = this.props
    const { pid } = this.state
    const prps = {
      host: config.host,
      port: config.port,
      pid,
      sessionId
    }
    const result = await runCmds(prps, ['pwd'])
      .catch(this.props.store.onError)
    return result ? result[0].trim() : ''
  }

  renderPromoteModal = () => {
    if (!this.isActiveTerminal()) {
      return null
    }
    const {
      passType = 'password'
    } = this.state
    const props = {
      title: f(passType) + '?',
      content: this.renderPasswordForm(),
      onCancel: this.onCancel,
      visible: this.state.promoteModalVisible,
      footer: this.renderModalFooter(),
      cancelText: c('cancel')
    }
    return (
      <Modal
        {...props}
      >
        {this.renderPasswordForm()}
      </Modal>
    )
  }

  renderModalFooter = () => {
    const disabled = !this.state.tempPassword
    return (
      <div className='alignright pd1'>
        <Button
          type='primary'
          icon={<CheckCircleOutlined />}
          disabled={disabled}
          onClick={this.onClickConfirmPass}
          className='mg1r'
        >
          {c('ok')}
        </Button>
        <Button
          type='ghost'
          className='mg1r'
          onClick={this.onCancel}
        >
          {c('cancel')}
        </Button>
      </div>
    )
  }

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
        {this.renderPromoteModal()}
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
