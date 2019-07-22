
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
  contextMenuWidth,
  terminalSshConfigType,
  ctrlOrCmd,
  transferTypeMap
} from '../../common/constants'
import deepCopy from 'json-deep-copy'
import { readClipboard, copy } from '../../common/clipboard'
import * as fit from 'xterm/lib/addons/fit/fit'
import * as attach from 'xterm/lib/addons/attach/attach'
import * as search from 'xterm/lib/addons/search/search'
import * as webLinks from 'xterm/lib/addons/webLinks/webLinks'
import { Zmodem, addonZmodem } from './xterm-zmodem'
import keyControlPressed from '../../common/key-control-pressed'
import { Terminal } from 'xterm'

console.log(Zmodem)
Terminal.applyAddon(fit)
Terminal.applyAddon(attach)
Terminal.applyAddon(search)
Terminal.applyAddon(webLinks)
Terminal.applyAddon(addonZmodem)

const { prefix } = window
const e = prefix('ssh')
const m = prefix('menu')
const f = prefix('form')
const c = prefix('common')

const authFailMsg = 'All configured authentication methods failed'
const privateKeyMsg = 'private key detected'
const typeSshConfig = 'ssh-config'

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
    this.term && this.term.dispose()
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

  handleEvent = (e) => {
    if (
      e.data &&
      e.data.type === 'focus' &&
      this.props.tab.id === this.props.currentTabId &&
      this.props.pane === paneMap.terminal
    ) {
      return this.term && this.term.focus()
    }
    if (e.data && e.data.id === this.props.id) {
      this.term.selectAll()
    } else if (keyControlPressed(e) && e.code === 'KeyF') {
      this.openSearch()
    } else if (
      e.ctrlKey &&
      e.shiftKey &&
      e.code === 'Tab'
    ) {
      e.stopPropagation()
      this.props.store.clickNextTab()
    }
  }

  onSelection = () => {
    if (this.props.config.copyWhenSelect) {
      const txt = this.term.getSelection()
      if (txt) {
        copy(txt)
      }
    }
  }

  onBlur = () => {
    if (
      this.props.id === this.props.activeTerminalId
    ) {
      this.props.store.modifier({
        activeTerminalId: ''
      })
    }
  }

  onzmodemRetract = () => {
    log.debug('zmodemRetract')
  }

  onReceiveZmodemSession = () => {
    /**
     * zmodem transfer
     * then run rz to send from your browser or
     * sz <file> to send from the remote peer.
     */
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
    this.term.attach(this.socket)
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
    this.term.detach()
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
    _.get(this.props, 'tab.type') !== 'ssh-config'
  }

  onPaste = () => {
    let selected = readClipboard()
    if (isWin && this.isRemote()) {
      selected = selected.replace(/\r\n/g, '\n')
    }
    this.term.__sendData(selected)
    this.term.focus()
  }

  openSearch = () => {
    this.setState({
      searchVisible: true
    })
  }

  onChangeSearch = (e) => {
    this.setState({
      searchInput: e.target.value
    })
  }

  searchPrev = () => {
    this.term.findPrevious(
      this.state.searchInput
    )
  }

  searchNext = () => {
    this.term.findNext(
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
    return (
      <div>
        <div
          className={clsCopy}
          onClick={hasSlected ? this.onCopy : _.noop}
        >
          <Icon type='copy' /> {m('copy')}
          <span className='context-sub-text'>({ctrlOrCmd}+shift+C)</span>
        </div>
        <div
          className={clsPaste}
          onClick={copyed ? this.onPaste : _.noop}
        >
          <Icon type='switcher' /> {m('paste')}
          <span className='context-sub-text'>({ctrlOrCmd}+shift+V)</span>
        </div>
        <div
          className={cls}
          onClick={this.onClear}
        >
          <Icon type='reload' /> {e('clear')}
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
    term.open(document.getElementById(id), true)
    term.on('focus', this.setActive)
    term.on('blur', this.onBlur)
    term.on('selection', this.onSelection)
    term.on('keydown', this.handleEvent)
    this.term = term
    // if (host && !password && !privateKey) {
    //   return this.promote()
    // }
    await this.remoteInit(term)
  }

  setActive = () => {
    this.props.setActive(this.props.id)
    this.props.store.modifier({
      activeTerminalId: this.props.id
    })
  }

  initData = () => {
    const { type, title, loginScript } = this.props.tab
    const cmd = type === terminalSshConfigType
      ? `ssh ${title.split(/\s/g)[0]}\r`
      : (
        loginScript
          ? loginScript + '\r'
          : `cd ${this.startPath}\r`
      )
    this.term.__sendData(cmd)
  }

  onRefresh = (data) => {
    const text = this.term._core.buffer.translateBufferLineToString(data.end)
    this.extractPath(text.trim())
  }

  extractPath = text => {
    // only support path like zxd@zxd-Q85M-D2A:~/dev$
    const reg = /^[^@]{1,}@[^:]{1,}:([^$]{1,})\$$/
    const mat = text.match(reg)
    const startPath = mat && mat[1] ? mat[1] : ''
    if (startPath.startsWith('~') || startPath.startsWith('/')) {
      this.props.store.editTab(this.props.tab.id, {
        startPath
      })
    }
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
    const { host, port } = config
    const url = `http://${host}:${port}/terminals`
    const { tab = {} } = this.props
    const {
      startPath, srcId, from = 'bookmarks',
      type, loginScript, encode
    } = tab
    const { savePassword } = this.state
    const isSshConfig = type === terminalSshConfigType
    const extra = this.props.sessionOptions
    let pid = await fetch.post(url, {
      cols,
      rows,
      term: 'xterm-color',
      ...tab,
      ...extra,
      ..._.pick(config, [
        'keepaliveInterval',
        'execWindows',
        'execMac',
        'execLinux'
      ]),
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
    const wsUrl = `ws://${host}:${port}/terminals/${pid}`
    const socket = new WebSocket(wsUrl)
    socket.onclose = this.oncloseSocket
    socket.onerror = this.onerrorSocket
    socket.onopen = () => {
      term.attach(socket)
      const old = socket.send
      socket.send = (...args) => {
        this.listenTimeout()
        return old.apply(socket, args)
      }
      socket.addEventListener('message', this.onSocketData)
      term._initialized = true
    }
    this.socket = socket
    term.on('refresh', this.onRefresh)
    term.on('resize', this.onResizeTerminal)
    const cid = _.get(this.props, 'currentTabId')
    const tid = _.get(this.props, 'tab.id')
    if (cid === tid && this.props.tab.status === statusMap.success) {
      term.webLinksInit()
      term.focus()
      term.fit()
      term.zmodemAttach(this.socket, {
        noTerminalWriteOutsideSession: true
      })
      term.on('zmodemRetract', this.onzmodemRetract)
      term.on('zmodemDetect', this.onZmodemDetect)
    }
    term.attachCustomKeyEventHandler(this.handleEvent)
    this.decoder = new TextDecoder(encode)
    term.__getMessage = function (ev) {
      let str = ''
      if (typeof ev.data === 'object') {
        if (ev.data instanceof ArrayBuffer) {
          str = this.decoder.decode(ev.data)
          term.write(str)
        } else {
          const fileReader = new FileReader()
          fileReader.addEventListener('load', function () {
            str = this.decoder.decode(fileReader.result)
            term.write(str)
          })
          fileReader.readAsArrayBuffer(ev.data)
        }
      } else if (typeof ev.data === 'string') {
        term.write(ev.data)
      } else {
        throw Error(`Cannot handle ${typeof ev.data} websocket message.`)
      }
    }
    this.term = term
    this.startPath = startPath
    if (startPath || loginScript || isSshConfig) {
      this.startPath = startPath
      this.timers.timer1 = setTimeout(this.initData, 10)
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
        const { cols, rows } = this.term.proposeGeometry()
        this.term.resize(cols, rows)
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
    const url = `http://${host}:${port}/terminals/${pid}/size?cols=${cols}&rows=${rows}`
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
          type !== typeSshConfig
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
    const { height, width, left, top, position, id: pid } = this.props
    const cls = classnames('term-wrap', {
      'not-first-term': !!position
    }, 'tw-' + pid)
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
            left: '3px',
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
      </div>
    )
  }
}
