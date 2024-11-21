/**
 * terminal/sftp wrapper
 */
import { Component } from 'react'
import Term from '../terminal'
import Sftp from '../sftp/sftp-entry'
import RdpSession from '../rdp/rdp-session'
import VncSession from '../vnc/vnc-session'
import {
  SearchOutlined,
  FullscreenOutlined,
  PaperClipOutlined,
  CloseOutlined
} from '@ant-design/icons'
import {
  Tooltip
} from 'antd'
import { pick } from 'lodash-es'
import generate from '../../common/uid'
import copy from 'json-deep-copy'
import classnames from 'classnames'
import {
  termControlHeight,
  paneMap,
  terminalActions,
  connectionMap,
  terminalRdpType,
  terminalVncType
} from '../../common/constants'
import safeName from '../../common/safe-name'
import TerminalInfoContent from '../terminal-info/content'
import postMessage from '../../common/post-msg'
import './session.styl'

const e = window.translate

export default class SessionWrapper extends Component {
  constructor (props) {
    super(props)
    this.state = {
      enableSftp: false,
      cwd: '',
      sftpPathFollowSsh: !!props.config.sftpPathFollowSsh,
      infoPanelPinned: false,
      key: Math.random(),
      sessionOptions: null,
      sessionId: generate(),
      delKeyPressed: false,
      showInfo: false,
      infoPanelProps: {}
    }
  }

  componentDidMount () {
    this.updateTab()
    // this.initEvent()
  }

  componentWillUnmount () {
    clearTimeout(this.backspaceKeyPressedTimer)
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

  handleShowInfo = (infoPanelProps) => {
    this.setState({
      showInfo: true,
      infoPanelProps
    })
  }

  toggleInfoPinned = () => {
    this.setState({
      infoPanelPinned: !this.state.infoPanelPinned
    })
  }

  toggleCheckSftpPathFollowSsh = () => {
    this.setState({
      sftpPathFollowSsh: !this.state.sftpPathFollowSsh
    })
  }

  hideInfoPanel = () => {
    this.setState({
      showInfo: false
    })
  }

  computeHeight = () => {
    const {
      tabsHeight
    } = this.props
    return this.props.height -
      tabsHeight -
      termControlHeight
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
    const windowWidth = this.getWidth()
    const heightAll = this.computeHeight()
    return {
      height: heightAll,
      width: windowWidth,
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
      pane, type
    } = this.props.tab
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
    const height = this.computeHeight()
    const { tab } = this.props
    const width = this.getWidth()
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
          'setActive',
          'handleShowInfo',
          'onChangePane',
          'hideInfoPanel',
          'setCwd',
          'onDelKeyPressed'
        ]),
      ...this.computePosition()
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
          key={tab.id}
          logName={logName}
          sessionId={sessionId}
          sessionOptions={sessionOptions}
          {...pops}
        />
      </div>
    )
  }

  renderSftp = () => {
    const {
      sessionOptions,
      sessionId,
      enableSftp,
      sftpPathFollowSsh,
      cwd
    } = this.state
    const { pane, type, id } = this.props.tab
    if (type === terminalRdpType) {
      return null
    }
    const height = this.computeHeight(pane)
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
    postMessage({
      action: terminalActions.openTerminalSearch,
      currentTabId: this.props.tab.id
    })
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

  renderControl = () => {
    const { sftpPathFollowSsh } = this.state
    const { props } = this
    const { pane, enableSsh, type } = props.tab
    if (type === terminalRdpType || type === terminalVncType) {
      return null
    }
    const termType = props.tab?.type
    const isSsh = props.tab.authType
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
      <div
        className='terminal-control fix'
      >
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
        {this.renderTermControls()}
      </div>
    )
  }

  render () {
    const {
      splitDirection,
      infoPanelProps,
      showInfo,
      infoPanelPinned
    } = this.state
    const { pane } = this.props.tab
    const infoProps = {
      infoPanelPinned,
      ...pick(this.props.config, ['host', 'port', 'saveTerminalLogToFile', 'terminalInfos']),
      ...infoPanelProps,
      appPath: this.props.appPath,
      rightSidebarWidth: this.props.rightSidebarWidth,
      showInfo,
      tabsHeight: this.props.tabsHeight,
      toggleInfoPinned: this.toggleInfoPinned,
      hideInfoPanel: this.hideInfoPanel
    }
    const cls = classnames(
      'term-sftp-box',
      pane,
      splitDirection,
      {
        'is-transporting': this.props.tab.isTransporting
      },
      {
        'disable-ssh': this.props.tab.enableSsh === false
      }
    )
    return (
      <div
        className={cls}
        id={`is-${this.props.tab.id}`}
      >
        {this.renderControl()}
        {this.renderTerminals()}
        {this.renderSftp()}
        <TerminalInfoContent
          {...infoProps}
        />
      </div>
    )
  }
}
