/**
 * terminal/sftp wrapper
 */
import { createRef } from 'react'
import { Component } from 'manate/react/class-components'
import Term from '../terminal/terminal.jsx'
import Sftp from '../sftp/sftp-entry'
import RdpSession from '../rdp/rdp-session'
import VncSession from '../vnc/vnc-session'
import WebSession from '../web/web-session.jsx'
import SpiceSession from '../spice/spice-session'
import {
  FullscreenOutlined
} from '@ant-design/icons'
import {
  Tooltip,
  Splitter
} from 'antd'
import { pick } from 'lodash-es'
import copy from 'json-deep-copy'
import classnames from 'classnames'
import {
  paneMap,
  terminalRdpType,
  terminalVncType,
  terminalWebType,
  terminalTelnetType,
  terminalFtpType,
  terminalSpiceType
} from '../../common/constants'
import { refs } from '../common/ref'
import sanitizeFilename from '../../common/sanitize-filename.js'
import SessionControl from './session-control'
import './session.styl'

const e = window.translate
const SplitterPane = Splitter.Panel

export default class SessionWrapper extends Component {
  constructor (props) {
    super(props)
    this.domRef = createRef()
    this.state = {
      cwd: '',
      sftpPathFollowSsh: !!props.config.sftpPathFollowSsh,
      key: Math.random(),
      splitSize: [50, 50],
      sessionOptions: null,
      delKeyPressed: false,
      broadcastInput: false,
      keepaliveEnabled: false,
      wrapDisabled: false
    }
    if (props.tab.sshSftpSplitView === undefined) {
      props.tab.sshSftpSplitView = !!props.config.sshSftpSplitView
    }
  }

  minWithForSplit = 640
  minHeightForSplit = 400

  componentWillUnmount () {
    clearTimeout(this.backspaceKeyPressedTimer)
  }

  getDom = () => {
    return this.domRef.current
  }

  isDisabled = () => {
    const { enableSsh, enableSftp } = this.props.tab
    return enableSsh === false || enableSftp === false
  }

  isSshDisabled = () => {
    return this.props.tab.enableSsh === false
  }

  isSftpDisabled = () => {
    return this.props.tab.enableSftp === false
  }

  handleSshSftpSplitView = () => {
    const nv = !this.props.tab.sshSftpSplitView
    this.editTab({
      sshSftpSplitView: nv
    })
    window.store.triggerResize()
  }

  canSplitView = () => {
    const {
      width,
      height
    } = this.props
    if (this.isDisabled()) {
      return false
    }
    return width > this.minWithForSplit ||
      height > this.minHeightForSplit
  }

  getSplitDirection = () => {
    const {
      sshSftpSplitView
    } = this.props.tab
    if (!sshSftpSplitView || !this.canSplitView()) {
      return 'tabed'
    }
    const {
      width,
      height
    } = this.props
    const ratio = width / height
    const baseRatio = this.minWithForSplit / this.minHeightForSplit
    const wider = ratio > baseRatio
    return wider ? 'leftRight' : 'topDown'
  }

  handleClick = () => {
    window.store.activeTabId = this.props.tab.id
  }

  onDrop = (e) => {
    e.preventDefault()
    const { target } = e
    if (!target) {
      return
    }
    let fromTab
    try {
      fromTab = JSON.parse(e.dataTransfer.getData('fromFile'))
    } catch (e) {
      return
    }
    const onDropElem = this.getDom()
    const { batch } = this.props.tab
    if (!onDropElem || !fromTab || fromTab.batch === batch) {
      return
    }
    const { store } = window
    const { tabs } = store
    const t = tabs.find(t => t.id === fromTab.id)
    if (!t) {
      return
    }
    // Handle currentTab change if needed
    const fromBatch = fromTab.batch
    if (window.store[`activeTabId${fromBatch}`] === fromTab.id && fromBatch !== batch) {
      // Find next tab in the same batch
      const nextTab = tabs.find((t, i) =>
        t.id !== fromTab.id && t.batch === fromBatch
      )
      window.store[`activeTabId${fromBatch}`] = nextTab ? nextTab.id : ''
    }
    t.batch = batch
    this.clearCls()
  }

  clearCls = () => {
    this.getDom()?.classList.remove('drag-over')
  }

  addCls = () => {
    this.getDom()?.classList.add('drag-over')
  }

  onDragEnter = () => {
    this.addCls()
  }

  onDragLeave = (e) => {
    this.clearCls()
  }

  onDragEnd = (e) => {
    this.clearCls()
    e && e.dataTransfer && e.dataTransfer.clearData()
  }

  onDelKeyPressed = () => {
    this.setState({
      delKeyPressed: true
    })
    this.backspaceKeyPressedTimer = setTimeout(() => {
      this.setState({
        delKeyPressed: false
      })
    }, 5000)
  }

  handleChangeDelMode = (backspaceMode) => {
    this.setState({
      backspaceMode
    })
  }

  handleDismissDelKeyTip = () => {
    window.store.dismissDelKeyTip()
  }

  setCwd = (cwd) => {
    this.setState({
      cwd
    })
  }

  toggleCheckSftpPathFollowSsh = () => {
    this.setState(prevState => ({
      sftpPathFollowSsh: !prevState.sftpPathFollowSsh
    }))
  }

  editTab = (up) => {
    const {
      tab,
      editTab
    } = this.props
    editTab(
      tab.id,
      up
    )
  }

  onChangePane = pane => {
    const update = {
      pane
    }
    if (pane === paneMap.fileManager) {
      this.setState({
        enableSftp: true
      })
    }
    this.editTab(update)
  }

  computePosition = (index) => {
    return {
      left: 0,
      top: 0
    }
  }

  getWidth = () => {
    return this.props.width
  }

  renderTerminals = () => {
    const {
      sessionOptions,
      sftpPathFollowSsh,
      broadcastInput
    } = this.state
    const {
      tab
    } = this.props
    const {
      pane, type, sshSftpSplitView
    } = tab
    if (type === terminalWebType) {
      const webProps = {
        tab,
        width: this.props.width,
        height: this.props.height,
        reloadTab: this.props.reloadTab
      }
      return (
        <WebSession
          {...webProps}
        />
      )
    }
    if (type === terminalRdpType || type === terminalVncType || type === terminalSpiceType) {
      const rdpProps = {
        tab: this.props.tab,
        ...pick(this.props, [
          'resolutions',
          'height',
          'width',
          'tabsHeight',
          'leftSidePanelWidth',
          'pinned',
          'openedSideBar',
          'delTab',
          'config',
          'reloadTab',
          'editTab',
          'fullscreen'
        ]),
        ...pick(
          this,
          [
            'fullscreenIcon'
          ])
      }
      if (type === terminalVncType) {
        return (
          <VncSession
            {...rdpProps}
          />
        )
      }
      if (type === terminalSpiceType) {
        return (
          <SpiceSession
            {...rdpProps}
          />
        )
      }

      return (
        <RdpSession
          {...rdpProps}
        />
      )
    }

    if (type === terminalFtpType) {
      const ftpProps = {
        ...this.props,
        ...pick(this, [
          'onChangePane',
          'setCwd'
        ]),
        isFtp: true
      }
      return (
        <Sftp
          {...ftpProps}
        />
      )
    }

    const cls = pane === paneMap.terminal ||
      (sshSftpSplitView && this.canSplitView())
      ? 'terms-box'
      : 'terms-box hide'
    const {
      width,
      height
    } = this.calcTermWidthHeight()
    const themeConfig = copy(window.store.getThemeConfig())
    const logName = sanitizeFilename(`${tab.title ? tab.title + '_' : ''}${tab.host ? tab.host + '_' : ''}${tab.id}`)
    const pops = {
      ...this.props,
      sftpPathFollowSsh,
      themeConfig,
      broadcastInput,
      pane,
      ...pick(
        this,
        [
          'onChangePane',
          'setCwd',
          'onDelKeyPressed'
        ]),
      ...this.computePosition(),
      width,
      height
    }
    return (
      <div
        className={cls}
        style={{
          width,
          height
        }}
      >
        <Term
          logName={logName}
          sessionOptions={sessionOptions}
          {...pops}
        />
      </div>
    )
  }

  isNotTerminalType = () => {
    const { type } = this.props.tab
    return type === terminalRdpType ||
      type === terminalVncType ||
      type === terminalWebType ||
      type === terminalTelnetType ||
      type === terminalFtpType ||
      type === terminalSpiceType
  }

  calcSftpWidthHeight = () => {
    const {
      width,
      height
    } = this.props
    if (!this.canSplitView() || !this.props.tab.sshSftpSplitView) {
      return {
        width,
        height
      }
    }
    const direction = this.getSplitDirection()
    const [, size2] = this.state.splitSize
    const w = direction === 'leftRight' ? size2 * width / 100 : width
    const h = direction === 'leftRight' ? height : size2 * height / 100
    return {
      width: w,
      height: h
    }
  }

  calcTermWidthHeight = () => {
    const width = this.getWidth()
    const height = this.props.computeHeight(
      this.props.height
    )
    if (!this.canSplitView() || !this.props.tab.sshSftpSplitView) {
      return {
        width,
        height
      }
    }
    const direction = this.getSplitDirection()
    const [size1] = this.state.splitSize
    const w = direction === 'leftRight' ? size1 * width / 100 : width
    const h = direction === 'leftRight' ? height : size1 * height / 100
    return {
      width: w,
      height: h
    }
  }

  renderSftp = () => {
    const {
      sessionOptions,
      enableSftp,
      sftpPathFollowSsh,
      cwd
    } = this.state
    const { pane, id, sshSftpSplitView } = this.props.tab
    if (
      this.isNotTerminalType() ||
      this.isSftpDisabled()
    ) {
      return null
    }
    const height = this.props.computeHeight(
      this.props.height
    )
    const cls = pane === paneMap.fileManager ||
    (sshSftpSplitView && this.canSplitView())
      ? ''
      : 'hide'
    const exts = {
      ...this.props,
      sftpPathFollowSsh,
      sshSftpSplitView,
      cwd,
      pid: id,
      enableSftp,
      sessionOptions,
      height,
      pane,
      ...this.calcSftpWidthHeight()
    }
    return (
      <div className={cls}>
        <Sftp
          {...exts}
        />
      </div>
    )
  }

  handleFullscreen = () => {
    // Make this tab the active tab before fullscreening
    window.store.activeTabId = this.props.tab.id
    window.store.toggleSessFullscreen(true, this.props.tab.id)
  }

  toggleBroadcastInput = () => {
    this.setState({
      broadcastInput: !this.state.broadcastInput
    })
  }

  toggleKeepalive = () => {
    const term = refs.get('term-' + this.props.tab.id)
    if (!term) {
      return
    }
    const enabled = term.toggleKeepalive()
    this.setState({ keepaliveEnabled: enabled })
  }

  handleExitGracefully = () => {
    refs.get('term-' + this.props.tab.id)?.exitGracefully()
  }

  handleOpenSearch = () => {
    refs.get('term-' + this.props.tab.id)?.toggleSearch()
  }

  toggleWrap = () => {
    const termRef = refs.get('term-' + this.props.tab.id)
    if (!termRef?.term) {
      return
    }
    const next = !this.state.wrapDisabled
    // DECAWM escape sequence: ?7l = disable wrap, ?7h = enable wrap
    termRef.term.write(next ? '\x1b[?7l' : '\x1b[?7h')
    this.setState({ wrapDisabled: next })
  }

  fullscreenIcon = () => {
    const title = e('fullscreen')
    return (
      <Tooltip title={title} placement='bottomLeft'>
        <FullscreenOutlined
          className='mg1r icon-info iblock pointer spliter fullscreen-control-icon'
          onClick={this.handleFullscreen}
        />
      </Tooltip>
    )
  }

  isSsh = () => {
    const { tab } = this.props
    return tab.authType
  }

  onSplitResize = (sizes) => {
    const direction = this.getSplitDirection()
    const {
      width,
      height
    } = this.props
    const all = direction === 'leftRight' ? width : height
    const size = sizes.map(d => d * 100 / all)
    this.setState({
      splitSize: size
    })
  }

  renderViews = () => {
    if (this.isNotTerminalType()) {
      return this.renderTerminals()
    }
    const notSplitVew = !this.canSplitView() || !this.props.tab.sshSftpSplitView
    const { pane } = this.props.tab
    const show1 = notSplitVew && pane === paneMap.terminal
    const show2 = notSplitVew && pane === paneMap.fileManager
    const direction = this.getSplitDirection()
    const layout = direction === 'leftRight' ? 'horizontal' : 'vertical'
    const [size1, size2] = this.state.splitSize
    const splitterProps = {
      orientation: layout,
      onResize: this.onSplitResize,
      onResizeEnd: this.onSplitResize,
      className: notSplitVew ? 'not-split-view' : '',
      style: {
        width: this.props.width + 'px',
        height: this.props.height + 'px'
      }
    }
    const paneProps = {
      min: '20%',
      max: '80%',
      style: {
        overflow: 'hidden'
      }
    }
    const s1 = show1
      ? '100%'
      : show2
        ? '0%'
        : size1 + '%'
    const s2 = show2
      ? '100%'
      : show1
        ? '0%'
        : size2 + '%'
    const paneProps1 = {
      ...paneProps,
      size: s1
    }
    const paneProps2 = {
      ...paneProps,
      size: s2
    }
    return (
      <Splitter {...splitterProps}>
        <SplitterPane {...paneProps1}>
          {this.renderTerminals()}
        </SplitterPane>
        <SplitterPane {...paneProps2}>
          {this.renderSftp()}
        </SplitterPane>
      </Splitter>
    )
  }

  render () {
    const { pane } = this.props.tab
    const cls = classnames(
      'term-sftp-box',
      pane,
      {
        'is-transporting': this.props.tab.isTransporting
      },
      {
        'disable-ssh': this.props.tab.enableSsh === false
      }
    )
    const divProps = {
      className: cls,
      onDragEnter: this.onDragEnter,
      onDragLeave: this.onDragLeave,
      onDrop: this.onDrop,
      onDragEnd: this.onDragEnd,
      onClick: this.handleClick
    }
    return (
      <div
        ref={this.domRef}
        {...divProps}
      >
        <SessionControl
          tab={this.props.tab}
          isMobile={window.store.isMobile}
          isDisabled={this.isDisabled()}
          isSshDisabled={this.isSshDisabled()}
          isNotTerminalType={this.isNotTerminalType()}
          canSplitView={this.canSplitView()}
          sftpPathFollowSsh={this.state.sftpPathFollowSsh}
          keepaliveEnabled={this.state.keepaliveEnabled}
          broadcastInput={this.state.broadcastInput}
          wrapDisabled={this.state.wrapDisabled}
          delKeyPressed={this.state.delKeyPressed}
          hideDelKeyTip={this.props.hideDelKeyTip}
          onChangePane={(pane) => this.onChangePane(pane)}
          toggleCheckSftpPathFollowSsh={this.toggleCheckSftpPathFollowSsh}
          onSshSftpSplitView={this.handleSshSftpSplitView}
          toggleKeepalive={this.toggleKeepalive}
          toggleBroadcastInput={this.toggleBroadcastInput}
          toggleWrap={this.toggleWrap}
          onFullscreen={this.handleFullscreen}
          onOpenSearch={this.handleOpenSearch}
          onDismissDelKeyTip={this.handleDismissDelKeyTip}
          onExitGracefully={this.handleExitGracefully}
        />
        {this.renderViews()}
      </div>
    )
  }
}
