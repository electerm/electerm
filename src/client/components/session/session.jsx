/**
 * terminal/sftp wrapper
 */
import { createRef } from 'react'
import { createPortal } from 'react-dom'
import { Component } from 'manate/react/class-components'
import Term from '../terminal/terminal.jsx'
import Sftp from '../sftp/sftp-entry'
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
import { getRightClickBehavior } from '../../common/right-click-behavior.js'
import SessionControl from './session-control'
import SessionSidebar, { railWidth } from './session-sidebar'
import './session.styl'

const e = window.translate
const SplitterPane = Splitter.Panel

export default class SessionWrapper extends Component {
  constructor (props) {
    super(props)
    this.domRef = createRef()
    this.state = {
      cwd: '',
      bookmarksOpen: !props.tab.authType || props.tab.enableSftp === false,
      sftpPathFollowSsh: !!props.config.sftpPathFollowSsh,
      key: Math.random(),
      sessionOptions: null,
      broadcastInput: false,
      wrapDisabled: false
    }
    if (props.tab.sshSftpSplitView === undefined) {
      props.tab.sshSftpSplitView = !!props.tab.authType
    }
    props.tab.pane = paneMap.terminal
  }

  minWithForSplit = 640
  minHeightForSplit = 400

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
    this.setState({ bookmarksOpen: false })
    this.editTab({
      sshSftpSplitView: nv
    })
    window.store.triggerResize()
  }

  handleToggleBookmarks = () => {
    this.setState(({ bookmarksOpen }) => ({ bookmarksOpen: !bookmarksOpen }))
    if (this.props.tab.sshSftpSplitView && this.canSplitView()) {
      this.editTab({ sshSftpSplitView: false })
    }
  }

  leftPaneWidth = () => {
    const { tab, width, sidebarWidth, sftpPercent } = this.props
    if (this.canSplitView() && tab.sshSftpSplitView) return sidebarWidth || width * sftpPercent / 100
    if (tab.pane === paneMap.fileManager) return width
    if (!sidebarWidth) return 0
    return this.state.bookmarksOpen ? sidebarWidth : railWidth
  }

  canSplitView = () => {
    return !!this.isSsh() && !this.isDisabled()
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
      pane, sshSftpSplitView
    } = tab
    if (this.isNotTerminalType()) {
      return null
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
          'setCwd'
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
    return {
      width: this.leftPaneWidth() - (this.props.sidebarWidth ? railWidth : 0),
      height: this.props.computeHeight(height)
    }
  }

  calcTermWidthHeight = () => {
    const width = this.getWidth()
    const height = this.props.computeHeight(
      this.props.height
    )
    return {
      width: width - this.leftPaneWidth(),
      height
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
      this.isSftpDisabled() ||
      !this.isSsh()
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
      remoteOnly: true,
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
    // The flag lives on the tab (not in this component's state) so the
    // toolbar icon and the MCP set_electerm_terminal_keepalive tool share
    // one source of truth — an MCP-driven change must light the icon up.
    const enabled = term.toggleKeepalive()
    this.editTab({ keepaliveEnabled: enabled })
  }

  handleExitGracefully = () => {
    refs.get('term-' + this.props.tab.id)?.exitGracefully()
  }

  handleOpenSearch = () => {
    refs.get('term-' + this.props.tab.id)?.toggleSearch()
  }

  // touch-only: the toolbar menu icon opens the same context menu a right
  // click (or a long press) does, anchored just below the icon itself
  handleOpenContextMenu = (evt) => {
    const term = refs.get('term-' + this.props.tab.id)
    if (!term) {
      return
    }
    const rect = evt.currentTarget.getBoundingClientRect()
    term.openContextMenuAtPoint(rect.left, rect.bottom)
  }

  handleZoomFontSize = (v) => {
    const term = refs.get('term-' + this.props.tab.id)
    if (!term?.term) {
      return
    }
    term.zoom(v)
    term.term.focus()
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

  handleSplitResize = ([left, right]) => {
    if (left + right > 0) {
      this.props.setSftpPercent(100 * left / (left + right))
    }
  }

  renderViews = () => {
    if (this.isNotTerminalType()) {
      return this.renderTerminals()
    }
    const { sidebarWidth, width, tab, currentBatchTabId } = this.props
    const files = this.canSplitView() && !!tab.sshSftpSplitView
    const bookmarks = !!sidebarWidth && this.state.bookmarksOpen && !files
    const split = files || bookmarks
    const left = this.leftPaneWidth()
    const style = { overflow: 'hidden' }
    return (
      <Splitter
        lazy
        onResizeEnd={this.handleSplitResize}
        className={split ? '' : 'not-split-view'}
        style={{ width: this.props.width, height: this.props.computeHeight(this.props.height) }}
      >
        <SplitterPane style={style} size={left} min={split && sidebarWidth ? Math.min(144, width * 0.6) : 0} max={split ? '60%' : '100%'} resizable={!!split}>
          <SessionSidebar
            bookmarks={bookmarks}
            files={files}
            canShowFiles={this.canSplitView()}
            active={tab.id === currentBatchTabId}
            onActivate={this.handleClick}
            batch={tab.batch}
            onToggleBookmarks={this.handleToggleBookmarks}
            onToggleFiles={this.handleSshSftpSplitView}
          >
            {this.renderSftp()}
          </SessionSidebar>
        </SplitterPane>
        <SplitterPane style={style} size={width - left} min={split ? '40%' : 0}>
          {this.renderTerminals()}
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
        'is-transporting': this.props.tab.isTransporting,
        'has-session-sidebar': !!this.props.sidebarWidth
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
    const controls = (
      <SessionControl
        tab={this.props.tab}
        isMobile={window.store.isMobile}
        isTouchDevice={window.store.isTouchDevice}
        isDisabled={this.isDisabled()}
        isSshDisabled={this.isSshDisabled()}
        isNotTerminalType={this.isNotTerminalType()}
        canSplitView={!this.props.sidebarWidth && this.canSplitView()}
        sftpPathFollowSsh={this.state.sftpPathFollowSsh}
        keepaliveEnabled={!!this.props.tab.keepaliveEnabled}
        broadcastInput={this.state.broadcastInput}
        wrapDisabled={this.state.wrapDisabled}
        rightClickBehavior={getRightClickBehavior(this.props.config)}
        onChangePane={(pane) => this.onChangePane(pane)}
        toggleCheckSftpPathFollowSsh={this.toggleCheckSftpPathFollowSsh}
        onSshSftpSplitView={this.handleSshSftpSplitView}
        toggleKeepalive={this.toggleKeepalive}
        toggleBroadcastInput={this.toggleBroadcastInput}
        toggleWrap={this.toggleWrap}
        onFullscreen={this.handleFullscreen}
        onZoomFontSize={this.handleZoomFontSize}
        onOpenSearch={this.handleOpenSearch}
        onOpenContextMenu={this.handleOpenContextMenu}
        onExitGracefully={this.handleExitGracefully}
      />
    )
    const { controlsHost, activeTabId, tab } = this.props
    return (
      <div ref={this.domRef} {...divProps}>
        {controlsHost
          ? tab.id === activeTabId && createPortal(controls, controlsHost)
          : controls}
        {this.renderViews()}
      </div>
    )
  }
}
