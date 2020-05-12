
import { Component } from 'react'
import ZmodemTransfer from './zmodem-transfer'
import fetch, { handleErr } from '../../common/fetch'
import { mergeProxy } from '../../common/merge-proxy'
import { generate } from 'shortid'
import _ from 'lodash'
import { Spin, Icon, Modal, Button, Checkbox } from 'antd'
import Input from '../common/input-auto-focus'
import classnames from 'classnames'
import './terminal.styl'
import {
  statusMap,
  paneMap,
  contextMenuHeight,
  contextMenuPaddingTop,
  typeMap,
  isWin,
  isMac,
  contextMenuWidth,
  terminalSshConfigType,
  transferTypeMap,
  defaultLoginScriptDelay
} from '../../common/constants'
import deepCopy from 'json-deep-copy'
import { readClipboard, copy } from '../../common/clipboard'
import { FitAddon } from 'xterm-addon-fit'
import AttachAddon from './attach-addon-custom'
import { SearchAddon } from 'xterm-addon-search'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { Zmodem, AddonZmodem } from './xterm-zmodem'
import { Unicode11Addon } from 'xterm-addon-unicode11'
import keyControlPressed from '../../common/key-control-pressed'
import keyShiftPressed from '../../common/key-shift-pressed'
import keyPressed from '../../common/key-pressed'
import { Terminal } from 'xterm'
import TerminalInfoIcon from '../terminal-info'

const { prefix } = window
const e = prefix('ssh')
const m = prefix('menu')
const f = prefix('form')
const c = prefix('common')
const authFailMsg = 'All configured authentication methods failed'
const privateKeyMsg = 'private key detected'

const computePos = (e, height) => {
  const { clientX, clientY } = e
  const res = {
    left: clientX,
    top: clientY
  }
  if (window.innerHeight < res.top + height + 10) {
    res.top = res.top - height
  }
  if (window.innerWidth < clientX + contextMenuWidth + 10) {
    res.left = window.innerWidth - contextMenuWidth
  }
  return res
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
      searchVisible: false,
      searchInput: '',
      passType: 'password',
      zmodemTransfer: null
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
    clearTimeout(this.timeoutHandler)
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
    if (e.data && e.data.type === 'focus') {
      this.setActive()
    } else if (
      e.data &&
      e.data.action === 'open-terminal-search' &&
      e.data.id === this.props.id
    ) {
      this.openSearch()
    }
    const isActiveTerminal = this.isActiveTerminal()
    if (
      e.data &&
      e.data.type === 'focus' &&
      isActiveTerminal
    ) {
      e.stopPropagation()
      return this.term && this.term.focus()
    } else if (
      e.data &&
      e.data.action === 'quick-command' &&
      isActiveTerminal
    ) {
      e.stopPropagation()
      this.term && e.data.command && this.attachAddon._sendData(
        e.data.command +
        (e.data.inputOnly ? '' : '\r')
      )
      this.term.focus()
    }

    if (
      keyControlPressed(e) &&
      keyShiftPressed(e) &&
      keyPressed(e, 'c')
    ) {
      e.stopPropagation()
      this.copySelectionToClipboard()
    } else if (e.data && e.data.id === this.props.id) {
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
      e.ctrlKey &&
      keyPressed(e, 'tab')
    ) {
      e.stopPropagation()
      this.props.store.clickNextTab()
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

  onBlur = () => {
    if (
      this.props.id === this.props.activeTerminalId
    ) {
      this.props.store.storeAssign({
        activeTerminalId: ''
      })
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
    this.props.store.reloadTab(this.props.tab)
  }

  onZmodemEndSend = () => {
    this.zsession.close()
    this.onZmodemEnd()
  }

  onZmodemEnd = () => {
    delete this.onZmodem
    this.onCancel = true
    this.attachAddon = new AttachAddon(this.socket)
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

  onContextMenu = e => {
    e.preventDefault()
    if (this.state.loading) {
      return
    }
    if (this.props.config.pasteWhenContextMenu) {
      return this.onPaste()
    }
    const content = this.renderContext()
    const height = content.props.children.filter(_.identity)
      .length * contextMenuHeight + contextMenuPaddingTop * 2
    this.props.store.openContextMenu({
      content,
      pos: computePos(e, height)
    })
  }

  onCopy = () => {
    const selected = this.term.getSelection()
    copy(selected)
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
    this.attachAddon._sendData(selected)
    this.term.focus()
  }

  openSearch = () => {
    this.setState({
      searchVisible: true
    })
  }

  onTitleChange = e => {
    log.debug(e, 'title change')
  }

  onChangeSearch = (e) => {
    this.setState({
      searchInput: e.target.value
    })
  }

  searchPrev = () => {
    this.searchAddon.findPrevious(
      this.state.searchInput
    )
  }

  searchNext = () => {
    this.searchAddon.findNext(
      this.state.searchInput
    )
  }

  searchClose = () => {
    this.setState({
      searchVisible: false
    })
  }

  // onSelectTheme = id => {
  //   this.props.store.setTheme(id)
  //   this.props.store.closeContextMenu()
  // }

  renderContext = () => {
    const cls = 'pd2x pd1y context-item pointer'
    const hasSlected = this.term.hasSelection()
    const clsCopy = cls +
      (hasSlected ? '' : ' disabled')
    const copyed = readClipboard()
    const clsPaste = cls +
      (copyed ? '' : ' disabled')
    const copyShortcut = isMac
      ? 'Command+C'
      : 'Ctrl+Shift+C'
    const pasteShortcut = isMac
      ? 'Command+V'
      : 'Ctrl+Shift+V'
    return (
      <div>
        <div
          className={clsCopy}
          onClick={hasSlected ? this.onCopy : _.noop}
        >
          <Icon type='copy' /> {m('copy')}
          <span className='context-sub-text'>({copyShortcut})</span>
        </div>
        <div
          className={clsPaste}
          onClick={copyed ? this.onPaste : _.noop}
        >
          <Icon type='switcher' /> {m('paste')}
          <span className='context-sub-text'>({pasteShortcut})</span>
        </div>
        <div
          className={cls}
          onClick={this.onClear}
        >
          <Icon type='reload' /> {e('clear')} (Ctrl+L)
        </div>
        <div
          className={cls}
          onClick={this.onSelectAll}
        >
          <Icon type='select' /> {e('selectAll')}
        </div>
        <div
          className={cls}
          onClick={this.openSearch}
        >
          <Icon type='search' /> {e('search')}
        </div>
        <div
          className={cls}
          onClick={this.split}
        >
          <Icon type='border-horizontal' /> {e('split')}
        </div>
      </div>
    )
  }

  onSocketData = () => {
    clearTimeout(this.timeoutHandler)
  }

  listenTimeout = () => {
    clearTimeout(this.timeoutHandler)
    if (this.onZmodem) {
      return
    }
    this.timeoutHandler = setTimeout(
      () => this.setStatus('error'),
      this.props.config.terminalTimeout
    )
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
      fontSize: tab.fontSize || config.fontSize,
      rendererType: config.rendererType
    })
    this.fitAddon = new FitAddon()
    this.searchAddon = new SearchAddon()
    const unicode11Addon = new Unicode11Addon()
    term.loadAddon(unicode11Addon)
    // activate the new version
    term.unicode.activeVersion = '11'
    term.loadAddon(this.fitAddon)
    term.loadAddon(this.searchAddon)
    term.open(document.getElementById(id), true)
    term.textarea.addEventListener('focus', this.setActive)
    term.textarea.addEventListener('blur', this.onBlur)
    term.onTitleChange(this.onTitleChange)
    term.onSelectionChange(this.onSelection)
    // term.on('keydown', this.handleEvent)
    this.term = term
    // if (host && !password && !privateKey) {
    //   return this.promote()
    // }
    await this.remoteInit(term)
  }

  setActive = () => {
    this.props.hideInfoPanel()
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

  remoteInit = async (term = this.term) => {
    this.setState({
      loading: true
    })
    const { cols, rows } = term
    const { config } = this.props
    const { host, port, token } = config
    const url = `http://${host}:${port}/terminals`
    const { tab = {}, sessionId, terminalIndex, id } = this.props
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
    const extra = this.props.sessionOptions
    let pid = await fetch.post(url, {
      cols,
      rows,
      term: terminalType || config.terminalType,
      saveTerminalLogToFile: config.saveTerminalLogToFile,
      ...tab,
      ...extra,
      ..._.pick(config, [
        'keepaliveInterval',
        'keepaliveCountMax',
        'execWindows',
        'execMac',
        'execLinux'
      ]),
      sessionId,
      tabId: id,
      terminalIndex,
      termType: type,
      readyTimeout: config.sshReadyTimeout,
      proxy: mergeProxy(config, tab),
      type: tab.host && !isSshConfig
        ? typeMap.remote
        : typeMap.local
    }, {
      handleErr: async response => {
        let text = _.isFunction(response.text)
          ? await response.text()
          : _.isPlainObject(response) ? JSON.stringify(response) : response
        text = (text || '').toString()
        if (text.includes(authFailMsg)) {
          this.setState(() => ({ passType: 'password' }))
          return 'fail'
        } else if (text.includes(privateKeyMsg)) {
          this.setState(() => ({ passType: 'passphrase' }))
          return 'fail-private'
        } else {
          handleErr({ message: text })
        }
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
      sshConnected: true
    })
    term.pid = pid
    this.pid = pid
    this.setState({
      pid
    })
    const wsUrl = `ws://${host}:${port}/terminals/${pid}?sessionId=${sessionId}&token=${token}`
    const socket = new WebSocket(wsUrl)
    socket.onclose = this.oncloseSocket
    socket.onerror = this.onerrorSocket
    this.attachAddon = new AttachAddon(socket, undefined, encode)
    term.loadAddon(this.attachAddon)
    socket.onopen = () => {
      const old = socket.send
      socket.send = (...args) => {
        this.listenTimeout()
        return old.apply(socket, args)
      }
      socket.addEventListener('message', this.onSocketData)
      term._initialized = true
    }
    this.socket = socket
    // term.onRrefresh(this.onRefresh)
    term.onResize(this.onResizeTerminal)
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
    this.setStatus(statusMap.error)
    log.debug('socket closed, pid:', this.pid)
  }

  onResizeTerminal = size => {
    const { cols, rows } = size
    const config = deepCopy(
      window.getGlobal('_config')
    )
    const { host, port } = config
    const { pid } = this
    const url = `http://${host}:${port}/terminals/${pid}/size?cols=${cols}&rows=${rows}&sessionId=${this.props.sessionId}`
    fetch.post(url)
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
          autofocustrigger={promoteModalVisible}
          selectall
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
    const { id, sessionId } = this.props
    const { pid } = this.state
    const infoProps = {
      id,
      pid,
      sessionId,
      isRemote: this.isRemote(),
      isActive: this.isActiveTerminal()
    }
    this.props.handleShowInfo(infoProps)
  }

  renderPromoteModal = () => {
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
          icon='check-circle'
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

  renderSearchBox = () => {
    const { searchInput, searchVisible } = this.state
    if (!searchVisible) {
      return null
    }
    return (
      <div className='term-search-box'>
        <Input
          value={searchInput}
          onChange={this.onChangeSearch}
          onPressEnter={this.searchNext}
          addonAfter={
            <span>
              <Icon
                type='left'
                className='pointer mg1r'
                title={e('prevMatch')}
                onClick={this.searchPrev}
              />
              <Icon
                type='right'
                className='pointer mg1r'
                title={e('nextMatch')}
                onClick={this.searchNext}
              />
              <Icon
                type='close'
                className='pointer'
                title={m('close')}
                onClick={this.searchClose}
              />
            </span>
          }
        />
      </div>
    )
  }

  render () {
    const { id, loading, zmodemTransfer } = this.state
    const { height, width, left, top, position, id: pid, activeSplitId } = this.props
    const cls = classnames('term-wrap', {
      'not-first-term': !!position
    }, 'tw-' + pid, {
      'terminal-not-active': activeSplitId !== pid
    })
    const infoProps = {
      showInfoPanel: this.handleShowInfo
    }
    return (
      <div
        className={cls}
        style={{
          height,
          width,
          left,
          top,
          zIndex: position / 10
        }}
        onDrop={this.onDrop}
      >
        {this.renderPromoteModal()}
        <input
          type='file'
          multiple
          id={`${id}-file-sel`}
          className='hide'
        />
        <div
          className='absolute'
          style={{
            left: '10px',
            top: '10px',
            right: 0,
            bottom: '40px'
          }}
        >
          {this.renderSearchBox()}
          <div
            id={id}
            className='absolute'
            style={{
              left: 0,
              top: 0,
              height: '100%',
              width: '100%'
            }}
          />
          <ZmodemTransfer
            zmodemTransfer={zmodemTransfer}
            cancelZmodem={this.cancelZmodem}
            beforeZmodemUpload={this.beforeZmodemUpload}
          />
        </div>
        <Spin className='loading-wrapper' spinning={loading} />
        {
          loading
            ? null
            : (
              <TerminalInfoIcon
                {...infoProps}
              />
            )
        }
      </div>
    )
  }
}
