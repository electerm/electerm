
import React from 'react'
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
import deepCopy from 'json-deep-copy'
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
const privateKeyMsg = 'Encrypted private key detected'
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

export default class Term extends React.PureComponent {

  constructor(props) {
    super()
    this.state = {
      id: props.id || 'id' + generate(),
      loading: false,
      promoteModalVisible: false,
      savePassword: false,
      tempPassword: '',
      searchVisible: false,
      searchInput: '',
      passType: 'password'
    }
  }

  componentDidMount() {
    this.initTerminal()
    this.initEvt()
  }

  componentDidUpdate(prevProps) {
    let shouldChange = (
      prevProps.currentTabId !== this.props.currentTabId &&
      this.props.tab.id === this.props.currentTabId &&
      this.props.pane === paneMap.terminal
    ) || (
      this.props.pane !== prevProps.pane &&
      this.props.pane === paneMap.terminal
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
    this.checkConfigChange(
      prevProps,
      this.props
    )
    let themeChanged = !_.isEqual(
      this.props.themeConfig,
      prevProps.themeConfig
    )
    if (themeChanged) {
      this.term.setOption('theme', this.props.themeConfig)
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
    for (let k of this.terminalConfigProps) {
      let {name, type} = k
      let prev = this.getValue(prevProps, type, name)
      let curr = this.getValue(props, type, name)
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
    let {id} = this.state
    let dom = document.getElementById(id)
    this.dom = dom
    dom.addEventListener('contextmenu', this.onContextMenu)
    window.addEventListener(
      'resize',
      this.onResize
    )
    window.addEventListener('message', this.handleEvent)
  }

  handleEvent = (e) => {
    if (e.data && e.data.id === this.props.id) {
      this.term.selectAll()
    }
    else if (keyControlPressed(e) && e.code === 'KeyF') {
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
      this.props.clickNextTab()
    }
  }

  onSelection = () => {
    if (this.props.config.copyWhenSelect) {
      let txt = this.term.getSelection()
      if (txt) {
        copy(txt)
      }
    }
  }

  onBlur = () => {
    if (
      this.props.id === this.props.activeTerminalId
    ) {
      this.props.modifier({
        activeTerminalId: ''
      })
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
    let content = this.renderContext()
    let height = content.props.children.filter(_.identity)
      .length * contextMenuHeight + contextMenuPaddingTop * 2
    this.props.openContextMenu({
      content,
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
    this.term.focus()
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
    this.props.setTheme(id)
    this.props.closeContextMenu()
  }

  renderThemeSelect = () => {
    let {theme, themes} = this.props
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
      window._config.terminalTimeout
    )
  }

  initTerminal = async () => {
    let {id} = this.state
    //let {password, privateKey, host} = this.props.tab
    let {themeConfig, tab = {}, config = {}} = this.props
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
    this.props.modifier({
      activeTerminalId: this.props.id
    })
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
      this.props.editTab(this.props.tab.id, {
        startPath
      })
    }
  }

  count = 0

  setStatus = status => {
    let id = _.get(this.props, 'tab.id')
    this.props.editTab(id, {
      status
    })
  }

  remoteInit = async (term = this.term) => {
    this.setState({
      loading: true
    })
    let {cols, rows} = term
    let config = deepCopy(
      window.getGlobal('_config')
    )
    let {host, port} = config
    let wsUrl
    let url = `http://${host}:${port}/terminals`
    let {tab = {}} = this.props
    let {startPath, srcId, from = 'bookmarks', type, loginScript} = tab
    let {savePassword} = this.state
    let isSshConfig = type === terminalSshConfigType
    let extra = this.props.sessionOptions
    let pid = await fetch.post(url, {
      cols,
      rows,
      term: 'xterm-color',
      ...tab,
      ...extra,
      readyTimeout: _.get(config, 'sshReadyTimeout'),
      keepaliveInterval: _.get(config, 'keepaliveInterval'),
      type: tab.host && !isSshConfig
        ? typeMap.remote
        : typeMap.local
    }, {
      handleErr: async response => {
        let text = _.isFunction(response.text)
          ? await response.text()
          : _.isPlainObject(response) ? JSON.stringify(response) : response
        if (text.includes(authFailMsg)) {
          this.setState(() => ({ passType: 'password' }))
          return 'fail'
        } else if (text.includes(privateKeyMsg)) {
          this.setState(() => ({ passType: 'passphrase' }))
          return 'fail-private'
        } else {
          handleErr({message: text})
        }
      }
    })
    if (pid.includes('fail')) {
      return this.promote()
    }
    if (savePassword) {
      this.props.editItem(srcId, extra, from)
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
      sessionOptions: extra || {}
    })
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

    let cid = _.get(this.props, 'currentTabId')
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
    let cid = _.get(this.props, 'currentTabId')
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
    let config = deepCopy(
      window.getGlobal('_config')
    )
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
    this.props.delTab({id})
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
    let {
      tempPassword,
      passType
    }  = this.state
    this.props.setSessionState({
      sessionOptions: {
        [passType]: tempPassword
      }
    })
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
