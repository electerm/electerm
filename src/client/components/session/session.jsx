/**
 * terminal/sftp wrapper
 */
import { createRef } from 'react'
import { Component } from '../common/component'
import Term from '../terminal/terminal.jsx'
import Sftp from '../sftp/sftp-entry'
import RdpSession from '../rdp/rdp-session'
import VncSession from '../vnc/vnc-session'
import WebSession from '../web/web-session.jsx'
import {
  SearchOutlined,
  FullscreenOutlined,
  PaperClipOutlined,
  CloseOutlined,
  CodeOutlined,
  FolderOutlined
} from '@ant-design/icons'
import {
  Tooltip,
  message
} from 'antd'
import { pick } from 'lodash-es'
import generate from '../../common/uid'
import copy from 'json-deep-copy'
import classnames from 'classnames'
import {
  paneMap,
  connectionMap,
  terminalRdpType,
  terminalVncType,
  terminalWebType
} from '../../common/constants'
import { refs } from '../common/ref'
import safeName from '../../common/safe-name'
import './session.styl'

const e = window.translate

export default class SessionWrapper extends Component {
  constructor (props) {
    super(props)
    this.domRef = createRef()
    this.state = {
      enableSftp: false,
      cwd: '',
      sftpPathFollowSsh: !!props.config.sftpPathFollowSsh,
      sshSftpSplitView: !!props.config.sshSftpSplitView,
      key: Math.random(),
      sessionOptions: null,
      sessionId: generate(),
      delKeyPressed: false
    }
  }

  minWithForSplit = 640
  minHeightForSplit = 400

  componentDidMount () {
    this.updateTab()
    // this.initEvent()
  }

  componentWillUnmount () {
    clearTimeout(this.backspaceKeyPressedTimer)
  }

  getDom = () => {
    return this.domRef.current
  }

  handleSshSftpSplitView = () => {
    const nv = !this.state.sshSftpSplitView
    this.setState({
      sshSftpSplitView: nv
    })
  }

  canSplitView = () => {
    const {
      width,
      height
    } = this.props
    return width > this.minWithForSplit ||
      height > this.minHeightForSplit
  }

  getSplitDirection = () => {
    const {
      sshSftpSplitView
    } = this.state
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
    const nv = !this.state.sftpPathFollowSsh
    if (nv) {
      message.warning(e('sftpPathFollowSshTip'), 8)
    }
    this.setState({
      sftpPathFollowSsh: nv
    })
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

  updateTab = () => {
    this.editTab(
      {
        sessionId: this.state.sessionId
      }
    )
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

  getWidthSftp = () => {
    return this.props.width
  }

  renderTerminals = () => {
    const {
      sessionOptions,
      sessionId,
      sftpPathFollowSsh
    } = this.state
    const {
      tab
    } = this.props
    const {
      pane, type
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
    if (type === terminalRdpType || type === terminalVncType) {
      const rdpProps = {
        tab: this.props.tab,
        sessionId,
        ...pick(this.props, [
          'resolutions',
          'height',
          'width',
          'tabsHeight',
          'leftSidebarWidth',
          'pinned',
          'openedSideBar',
          'delTab',
          'config',
          'reloadTab',
          'editTab'
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
      return (
        <RdpSession
          {...rdpProps}
        />
      )
    }
    const cls = pane === paneMap.terminal
      ? 'terms-box'
      : 'terms-box hide'
    const width = this.getWidth()
    const height = this.props.computeHeight(
      this.props.height
    )
    const themeConfig = copy(window.store.getThemeConfig())
    const logName = safeName(`${tab.title ? tab.title + '_' : ''}${tab.host ? tab.host + '_' : ''}${tab.id}`)
    const pops = {
      ...this.props,
      sftpPathFollowSsh,
      themeConfig,
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
          sessionId={sessionId}
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
      type === terminalWebType
  }

  renderSftp = () => {
    const {
      sessionOptions,
      sessionId,
      enableSftp,
      sftpPathFollowSsh,
      cwd
    } = this.state
    const { pane, id } = this.props.tab
    if (
      this.isNotTerminalType()
    ) {
      return null
    }
    const height = this.props.computeHeight(
      this.props.height
    )
    const cls = pane === paneMap.terminal
      ? 'hide'
      : ''
    const exts = {
      ...this.props,
      sftpPathFollowSsh,
      cwd,
      pid: id,
      enableSftp,
      sessionOptions,
      height,
      sessionId,
      pane,
      width: this.getWidthSftp()
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
    window.store.toggleTermFullscreen(true)
  }

  handleOpenSearch = () => {
    refs.get('term-' + this.props.tab.id)?.toggleSearch()
  }

  renderSearchIcon = () => {
    const title = e('search')
    return (
      <Tooltip title={title} placement='bottomLeft'>
        <SearchOutlined
          className='mg1r icon-info font16 iblock pointer spliter'
          onClick={this.handleOpenSearch}
        />
      </Tooltip>
    )
  }

  fullscreenIcon = () => {
    const title = e('fullscreen')
    return (
      <Tooltip title={title} placement='bottomLeft'>
        <FullscreenOutlined
          className='mg1r icon-info font16 iblock pointer spliter term-fullscreen-control1'
          onClick={this.handleFullscreen}
        />
      </Tooltip>
    )
  }

  renderDelTip = (isSsh) => {
    if (!isSsh || this.props.hideDelKeyTip || !this.state.delKeyPressed) {
      return null
    }
    return (
      <div className='type-tab'>
        <span className='mg1r'>Try <b>Shift + Backspace</b>?</span>
        <CloseOutlined
          onClick={this.handleDismissDelKeyTip}
          className='pointer'
        />
      </div>
    )
  }

  renderTermControls = () => {
    const { props } = this
    const { pane } = props.tab
    if (pane !== paneMap.terminal) {
      return null
    }
    return (
      <div className='fright term-controls'>
        {this.fullscreenIcon()}
        {this.renderSearchIcon()}
      </div>
    )
  }

  renderSplitToggle = () => {
    if (this.canSplitView()) {
      return null
    }
    const title = e('sshSftpSplitView')
    return (
      <Tooltip title={title} placement='bottomLeft'>
        <span
          className='ssh-sftp-split-icon pointer mg1r'
          onClick={this.handleSshSftpSplitView}
        >
          <CodeOutlined className='ssh-sftp-split-icon-1' />
          <FolderOutlined className='ssh-sftp-split-icon-2' />
        </span>
      </Tooltip>
    )
  }

  renderPaneControl = () => {
    const {
      sftpPathFollowSsh,
      sshSftpSplitView
    } = this.state
    if (sshSftpSplitView && this.canSplitView()) {
      return null
    }
    const { props } = this
    const { tab } = props
    const { pane, enableSsh } = tab
    const termType = tab?.type
    const isSsh = tab.authType
    const isLocal = !isSsh && (termType === connectionMap.local || !termType)
    const types = [
      paneMap.terminal,
      paneMap.fileManager
    ]
    const controls = [
      isSsh ? paneMap.ssh : paneMap.terminal
    ]
    if (isSsh || isLocal) {
      controls.push(isSsh ? paneMap.sftp : paneMap.fileManager)
    }
    const checkTxt = e('sftpPathFollowSsh') + ' [Beta]'
    const checkProps = {
      onClick: this.toggleCheckSftpPathFollowSsh,
      className: classnames(
        'sftp-follow-ssh-icon',
        {
          active: sftpPathFollowSsh
        }
      )
    }
    const simpleMapper = {
      [paneMap.terminal]: 'T',
      [paneMap.fileManager]: 'F',
      [paneMap.ssh]: 'T'
    }
    return (
      <>
        <div className='term-sftp-tabs fleft'>
          {
            controls.map((type, i) => {
              const cls = classnames(
                'type-tab',
                type,
                {
                  active: types[i] === pane
                }
              )
              return (
                <span
                  className={cls}
                  key={type + '_' + i}
                  onClick={() => this.onChangePane(types[i])}
                >
                  <span className='type-tab-txt'>
                    <span className='w500'>{e(type)}</span>
                    <span className='l500'>{simpleMapper[type]}</span>
                    <span className='type-tab-line' />
                  </span>
                </span>
              )
            })
          }
        </div>
        {
          (isSsh && enableSsh) || isLocal
            ? (
              <Tooltip title={checkTxt}>
                <span {...checkProps}>
                  <PaperClipOutlined />
                </span>
              </Tooltip>
              )
            : null
        }
        {
          this.renderDelTip(pane === paneMap.terminal)
        }
      </>
    )
  }

  renderControl = () => {
    const { props } = this
    const { tab } = props
    const { type } = tab
    if (
      type === terminalRdpType ||
      type === terminalVncType ||
      type === terminalWebType
    ) {
      return null
    }
    return (
      <div
        className='terminal-control fix'
      >
        {this.renderPaneControl()}
        {
          this.renderSplitToggle()
        }
        {this.renderTermControls()}
      </div>
    )
  }

  renderViews = () => {
    return (
      <>
        {this.renderTerminals()}
        {this.renderSftp()}
      </>
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
        {this.renderControl()}
        {this.renderViews()}
      </div>
    )
  }
}
