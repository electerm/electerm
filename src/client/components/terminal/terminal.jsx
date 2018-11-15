import {Component} from '../common/react-subx'
import fetch, {handleErr} from '../../common/fetch'
import {generate} from 'shortid'
import _ from 'lodash'
import {Spin, Icon, Modal, Button, Checkbox, Select} from 'antd'
import Input from '../common/input-auto-focus'
import {statusMap, paneMap} from '../../common/constants'
import classnames from 'classnames'
import './terminal.styl'
import {
  contextMenuHeight,
  contextMenuPaddingTop,
  typeMap,
  isWin,
  contextMenuWidth,
  terminalSshConfigType,
  isMac
} from '../../common/constants'
import {readClipboard, copy} from '../../common/clipboard'
import * as fit from 'xterm/lib/addons/fit/fit'
import * as attach from 'xterm/lib/addons/attach/attach'
import * as search from 'xterm/lib/addons/search/search'
import keyControlPressed from '../../common/key-control-pressed'

import { Terminal } from 'xterm'

Terminal.applyAddon(fit)
Terminal.applyAddon(attach)
Terminal.applyAddon(search)

const {prefix} = window
const e = prefix('ssh')
const m = prefix('menu')
const f = prefix('form')
const c = prefix('common')
const t = prefix('terminalThemes')
const {Option} = Select

const authFailMsg = 'All configured authentication methods failed'
const typeSshConfig = 'ssh-config'

const computePos = (e, height) => {
  let {clientX, clientY} = e
  let res = {
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

  constructor(props) {
    super(props)
    this.state = {
      id: props.id || 'id' + generate(),
      loading: false,
      promoteModalVisible: false,
      savePassword: false,
      tempPassword: '',
      searchVisible: false,
      searchInput: ''
    }
  }

  componentDidMount() {
    this.initTerminal()
    this.initEvt()
  }

  componentDidUpdate(prevProps, prevState) {
    let shouldChange = (
      this.props.tab.id === this.props.store.currentTabId &&
      this.props.pane === paneMap.terminal &&
      prevState.searchInput === this.state.searchInput
    )
    let names = [
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
  }

  componentWillUnmount() {
    Object.keys(this.timers).forEach(k => {
      clearTimeout(this.timers[k])
    })
    clearTimeout(this.timeoutHandler)
    clearTimeout(this.timers)
    this.onClose = true
    this.socket && this.socket.close()
    this.term && this.term.dispose()
    this.dom.removeEventListener('contextmenu', this.onContextMenu)
    window.removeEventListener(
      'message',
      this.onMsg
    )
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
      ? props.store.config[name]
      : props.tab[name] || props.store.config[name]
  }

  onConfigChange = () => {
    for (let k of this.terminalConfigProps) {
      let {name, type} = k
      let curr = this.getValue(this.props, type, name)
      this.term.setOption(name, curr)
    }
    setTimeout(this.onResize, 20)
  }

  onMsg = e => {
    if (!e.data) {
      return
    }
    let {
      type,
      id
    } = e.data
    if (id !== 'all' && id !== this.props.id) {
      return
    }
    if (type === 'theme-change') {
      this.term.setOption('theme', this.props.store.getThemeConfig())
    }
    else if (type === 'config-change') {
      this.onConfigChange()
    }
  }

  timers = {}

  initEvt = () => {
    let {id} = this.state
    let dom = document.getElementById(id)
    this.dom = dom
    dom.addEventListener('contextmenu', this.onContextMenu)
    window.addEventListener(
      'message',
      this.onMsg
    )
  }

  handleEvent = (e) => {
    if (keyControlPressed(e) && e.code === 'KeyF') {
      this.openSearch()
    } else if (
      e.ctrlKey &&
      e.shiftKey &&
      e.code === 'KeyC'
    ) {
      this.onCopy()
    } else if (
      (
        (e.ctrlKey && !isMac) ||
        (e.metaKey && isMac)
      ) &&
      e.code === 'Tab'
    ) {
      this.props.store.clickNextTab()
    }
  }

  onSelection = () => {
    if (this.props.store.config.copyWhenSelect) {
      let txt = this.term.getSelection()
      if (txt) {
        copy(txt)
      }
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
    if (this.props.store.config.pasteWhenContextMenu) {
      return this.onPaste()
    }
    let content = this.renderContext()
    let height = content.props.children.filter(_.identity)
      .length * contextMenuHeight + contextMenuPaddingTop * 2
    this.props.store.openContextMenu({
      contentRender: () => content,
      pos: computePos(e, height)
    })
  }

  onCopy = () => {
    let selected = this.term.getSelection()
    copy(selected)
  }

  onSelectAll = () => {
    this.term.selectAll()
  }

  onClear = () => {
    this.term.clear()
  }

  onPaste = () => {
    let selected = readClipboard()
    if (isWin && _.get(this.props, 'tab.host')) {
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

  onSelectTheme = id => {
    this.props.store.setTheme(id)
    window.postMessage({
      type: 'close-context-menu'
    }, '*')
  }

  renderThemeSelect = () => {
    let {theme, themes} = this.props.store
    return (
      <div>
        <div className="pd1b">
          {t('terminalThemes')}
        </div>
        <Select
          value={theme}
          onChange={this.onSelectTheme}
        >
          {
            themes.map(({id, name}) => {
              return (
                <Option
                  key={id}
                  value={id}
                >
                  {name}
                </Option>
              )
            })
          }
        </Select>
      </div>
    )
  }

  renderContext = () => {
    let cls = 'pd2x pd1y context-item pointer'
    let hasSlected = this.term.hasSelection()
    let clsCopy = cls +
      (hasSlected ? '' : ' disabled')
    let copyed = readClipboard()
    let clsPaste = cls +
      (copyed ? '' : ' disabled')
    return (
      <div>
        <div
          className={clsCopy}
          onClick={hasSlected ? this.onCopy : _.noop}
        >
          <Icon type="copy" /> {m('copy')}
          <span className="context-sub-text">(ctrl+shift+C)</span>
        </div>
        <div
          className={clsPaste}
          onClick={copyed ? this.onPaste : _.noop}
        >
          <Icon type="switcher" /> {m('paste')}
          <span className="context-sub-text">(ctrl+shift+V)</span>
        </div>
        <div
          className={cls}
          onClick={this.onClear}
        >
          <Icon type="reload" /> {e('clear')}
        </div>
        <div
          className={cls}
          onClick={this.onSelectAll}
        >
          <Icon type="select" /> {e('selectAll')}
        </div>
        <div
          className={cls}
          onClick={this.openSearch}
        >
          <Icon type="search" /> {e('search')}
        </div>
        <div
          className={cls}
          onClick={this.split}
        >
          <Icon type="border-horizontal" /> {e('split')}
        </div>
        <div
          className={cls + ' no-auto-close-context'}
        >
          {this.renderThemeSelect()}
        </div>
      </div>
    )
  }

  onSocketData = () => {
    clearTimeout(this.timeoutHandler)
  }

  listenTimeout = () => {
    clearTimeout(this.timeoutHandler)
    this.timeoutHandler = setTimeout(
      () => this.setStatus('error'),
      this.props.store.config.terminalTimeout
    )
  }

  initTerminal = async () => {
    let {id} = this.state
    //let {password, privateKey, host} = this.props.tab
    let { tab = {} } = this.props
    let {config = {}} = this.props.store
    let themeConfig = this.props.store.getThemeConfig()
    let term = new Terminal({
      scrollback: config.scrollback,
      rightClickSelectsWord: config.rightClickSelectsWord || false,
      fontFamily: tab.fontFamily || config.fontFamily,
      theme: themeConfig,
      // lineHeight: 1.2,
      fontSize: tab.fontSize || config.fontSize
    })
    term.open(document.getElementById(id), true)
    term.on('focus', this.setActive)
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
  }

  initData = () => {
    let {type, title, loginScript} = this.props.tab
    let cmd = type === terminalSshConfigType
      ? `ssh ${title}\r`
      : (
        loginScript
          ? loginScript + '\r'
          : `cd ${this.startPath}\r`
      )
    this.term.__sendData(cmd)
  }

  onRefresh = (data) => {
    let text = this.term._core.buffer.translateBufferLineToString(data.end)
    this.extractPath(text.trim())
  }

  extractPath = text => {
    //only support path like zxd@zxd-Q85M-D2A:~/dev$
    let reg = /^[^@]{1,}@[^:]{1,}:([^$]{1,})\$$/
    let mat = text.match(reg)
    let startPath = mat && mat[1] ? mat[1] : ''
    if (startPath.startsWith('~') || startPath.startsWith('/')) {
      this.props.store.editTab(this.props.tab.id, {
        startPath
      })
    }
  }

  count = 0

  setStatus = status => {
    let {id} = this.props.tab
    this.props.store.editTab(id, {
      status
    })
  }

  remoteInit = async (term = this.term) => {
    this.setState({
      loading: true
    })
    let {cols, rows} = term
    let {config} = this.props.store
    let {host, port} = config
    let wsUrl
    let url = `http://${host}:${port}/terminals`
    let {tab = {}} = this.props
    let {startPath, srcId, from = 'bookmarks', type, loginScript} = tab
    let {tempPassword, savePassword} = this.state
    let isSshConfig = type === terminalSshConfigType
    let extra = tempPassword
      ? {password: tempPassword}
      : {}
    let pid = await fetch.post(url, {
      cols,
      rows,
      term: 'xterm-color',
      ...tab,
      ...extra,
      readyTimeout: _.get(config, 'sshReadyTimeout'),
      keepaliveInterval: config.keepaliveInterval,
      type: tab.host && !isSshConfig
        ? typeMap.remote
        : typeMap.local
    }, {
      handleErr: async response => {
        let text = _.isFunction(response.text)
          ? await response.text()
          : _.isPlainObject(response) ? JSON.stringify(response) : response
        if (text.includes(authFailMsg)) {
          return 'fail'
        } else {
          handleErr(response)
        }
      }
    })
    if (pid === 'fail') {
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
    term.pid = pid
    this.pid = pid
    wsUrl = `ws://${host}:${port}/terminals/${pid}`
    let socket = new WebSocket(wsUrl)
    socket.onclose = this.oncloseSocket
    socket.onerror = this.onerrorSocket
    socket.onopen = () => {
      term.attach(socket)
      let old = socket.send
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

    let cid = _.get(this.props.store, 'currentTabId')
    let tid = _.get(this.props, 'tab.id')
    if (cid === tid && this.props.tab.status === statusMap.success) {
      term.focus()
      term.fit()
    }
    term.attachCustomKeyEventHandler(this.handleEvent)
    this.term = term
    this.startPath = startPath
    if (startPath || loginScript || isSshConfig) {
      this.startPath = startPath
      this.timers.timer1 = setTimeout(this.initData, 10)
    }
  }

  onResize = () => {
    let cid = _.get(this.props.store, 'currentTabId')
    let tid = _.get(this.props, 'tab.id')
    if (
      this.props.tab.status === statusMap.success &&
      cid === tid &&
      this.term
    ) {
      try {
        let {cols, rows} = this.term.proposeGeometry()
        this.term.resize(cols, rows)
      } catch (e) {
        console.log('resize failed')
      }
    }
  }

  onerrorSocket = err => {
    this.setStatus(statusMap.error)
    console.log(err.stack)
  }

  oncloseSocket = () => {
    if (this.onClose) {
      return
    }
    this.setStatus(statusMap.error)
    console.log('socket closed, pid:', this.pid)
  }

  onResizeTerminal = size => {
    let {cols, rows} = size
    let {config} = this.props.store
    let {host, port} = config
    let {pid} = this
    let url = `http://${host}:${port}/terminals/${pid}/size?cols=${cols}&rows=${rows}`
    fetch.post(url)
  }

  promote = () => {
    this.setState({
      promoteModalVisible: true,
      tempPassword: ''
    })
  }

  onCancel = () => {
    let {id} = this.props.tab
    this.props.store.delTab({id})
  }

  onToggleSavePass = () => {
    this.setState({
      savePassword: !this.state.savePassword
    })
  }

  renderPasswordForm = () => {
    let {tempPassword, savePassword} = this.state
    let {type} = this.props.tab
    return (
      <div>
        <Input
          value={tempPassword}
          onChange={this.onChangePass}
          onPressEnter={this.onClickConfirmPass}
        />
        {
          type !== typeSshConfig
            ? (
              <div className="pd1t">
                <Checkbox
                  checked={savePassword}
                  onChange={this.onToggleSavePass}
                >{e('savePassword')}</Checkbox>
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
    this.setState({
      promoteModalVisible: false
    }, this.remoteInit)
  }

  renderPromoteModal = () => {
    let props = {
      title: f('password') + '?',
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
    let disabled = !this.state.tempPassword
    return (
      <div className="alignright pd1">
        <Button
          type="primary"
          icon="check-circle"
          disabled={disabled}
          onClick={this.onClickConfirmPass}
          className="mg1r"
        >
          {c('ok')}
        </Button>
        <Button
          type="ghost"
          className="mg1r"
          onClick={this.onCancel}
        >
          {c('cancel')}
        </Button>
      </div>
    )
  }

  renderSearchBox = () => {
    let {searchInput, searchVisible} = this.state
    if (!searchVisible) {
      return null
    }
    return (
      <div className="term-search-box">
        <Input
          value={searchInput}
          onChange={this.onChangeSearch}
          onPressEnter={this.searchNext}
          autofocustrigger={+new Date()}
          addonAfter={
            <span>
              <Icon
                type="left"
                className="pointer mg1r"
                title={e('prevMatch')}
                onClick={this.searchPrev}
              />
              <Icon
                type="right"
                className="pointer mg1r"
                title={e('nextMatch')}
                onClick={this.searchNext}
              />
              <Icon
                type="close"
                className="pointer"
                title={m('close')}
                onClick={this.searchClose}
              />
            </span>
          }
        />
      </div>
    )
  }

  render() {
    let {id, loading} = this.state
    let {height, width, left, top, position, id: pid} = this.props
    let cls = classnames('term-wrap bg-black', {
      'not-first-term': !!position
    }, 'tw-' + pid)
    return (
      <div
        className={cls}
        style={{
          height, width, left, top,
          zIndex: position / 10
        }}
      >
        {this.renderPromoteModal()}
        <div
          className="bg-black absolute"
          style={{
            left: '3px',
            top: '10px',
            right: 0,
            bottom: '30px'
          }}
        >
          {this.renderSearchBox()}
          <div
            id={id}
            className="absolute"
            style={{
              left: 0,
              top: 0,
              height: '100%',
              width: '100%'
            }}
          />
        </div>
        <Spin className="loading-wrapper" spinning={loading} />
      </div>
    )
  }

}
