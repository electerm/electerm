/**
 * terminal/sftp wrapper
 */
import { Component } from 'react'
import Term from '../terminal'
import Sftp from '../sftp/sftp-entry'
import RdpSession from '../rdp/rdp-session'
import VncSession from '../vnc/vnc-session'
import {
  BorderVerticleOutlined,
  BorderHorizontalOutlined,
  CloseSquareFilled,
  SearchOutlined,
  FullscreenOutlined,
  PaperClipOutlined,
  CloseOutlined
} from '@ant-design/icons'
import {
  Tooltip
} from 'antd'
import { last, findIndex, pick } from 'lodash-es'
import generate from '../../common/uid'
import copy from 'json-deep-copy'
import classnames from 'classnames'
import {
  quickCommandBoxHeight,
  terminalSplitDirectionMap,
  termControlHeight,
  paneMap,
  footerHeight,
  terminalActions,
  connectionMap,
  terminalRdpType,
  terminalVncType
} from '../../common/constants'
import ResizeWrap from '../common/resize-wrap'
import safeName from '../../common/safe-name'
import TerminalInfoContent from '../terminal-info/content'
import uid from '../../common/id-with-stamp'
import postMessage from '../../common/post-msg'
import './session.styl'

const rebuildPosition = terminals => {
  const indexs = terminals.map(t => t.position).sort((a, b) => a - b)
  const indexMap = indexs.reduce((prev, pos, index) => {
    return {
      ...prev,
      [pos]: index * 10
    }
  }, {})
  return terminals.map(t => {
    return {
      ...t,
      position: indexMap[t.position]
    }
  })
}

const getPrevTerminal = terminals => {
  return last(terminals)
}

const { prefix } = window
const e = prefix('ssh')
const m = prefix('menu')

export default class SessionWrapper extends Component {
  constructor (props) {
    super(props)
    const id = uid()
    const {
      terminals = [
        {
          id,
          position: 0
        }
      ]
    } = props.tab
    const activeSplitId = terminals[0].id
    this.state = {
      pid: null,
      enableSftp: false,
      cwd: '',
      sftpPathFollowSsh: !!props.config.sftpPathFollowSsh,
      splitDirection: terminalSplitDirectionMap.horizontal,
      activeSplitId,
      infoPanelPinned: false,
      key: Math.random(),
      sessionOptions: null,
      sessionId: generate(),
      terminals: terminals.slice(0, 1),
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

  setCwd = (cwd, tid) => {
    this.setState(old => {
      return {
        cwd,
        terminals: old.terminals.map(t => {
          if (t.id === tid) {
            return {
              ...t,
              cwd
            }
          }
          return t
        })
      }
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
      pinnedQuickCommandBar,
      tabsHeight
    } = this.props
    return this.props.height -
      tabsHeight -
      footerHeight -
      termControlHeight -
      (pinnedQuickCommandBar ? quickCommandBoxHeight : 0)
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

  setSessionState = data => {
    this.setState(data)
    if (data.pid) {
      this.editTab({
        pid: data.pid
      })
    }
  }

  handleSplit = (e, id) => {
    let terminals = copy(this.state.terminals)
    let index = findIndex(terminals, t => t.id === id)
    if (index === -1) {
      index = terminals.length
    } else {
      index = index + 1
    }
    terminals.push({
      id: uid(),
      position: terminals[index - 1].position + 5
    })
    terminals = rebuildPosition(terminals)
    this.setState({
      terminals
    }, this.updateTab)
  }

  updateTab = () => {
    const terminals = copy(this.state.terminals)
    this.editTab(
      {
        sessionId: this.state.sessionId,
        terminals
      }
    )
  }

  delSplit = (splitId = this.state.activeSplitId) => {
    const { terminals } = this.state
    let newTerms = terminals.filter(t => t.id !== splitId)
    if (!newTerms.length) {
      return this.props.delTab(
        this.props.tab.id
      )
    }
    newTerms = rebuildPosition(newTerms)
    const newActiveId = getPrevTerminal(newTerms).id
    this.setState({
      terminals: newTerms,
      activeSplitId: newActiveId
    }, this.updateTab)
    window.store.focus()
  }

  handleChangeDirection = () => {
    const { splitDirection } = this.state
    this.setState({
      splitDirection: splitDirection === terminalSplitDirectionMap.horizontal
        ? terminalSplitDirectionMap.vertical
        : terminalSplitDirectionMap.horizontal
    })
  }

  setActive = activeSplitId => {
    const up = {
      activeSplitId
    }
    this.setState(up)
  }

  computePosition = (index) => {
    const len = this.state.terminals.length || 1
    const windowWidth = this.getWidth()
    const { splitDirection } = this.state
    const isHori = splitDirection === terminalSplitDirectionMap.horizontal
    const heightAll = this.computeHeight()
    const width = isHori
      ? windowWidth / len
      : windowWidth
    const height = isHori
      ? heightAll
      : heightAll / len
    const left = isHori
      ? index * width
      : 0
    const top = isHori
      ? 0
      : index * height
    return {
      height,
      width,
      left,
      top
    }
  }

  getWidth = () => {
    const {
      infoPanelPinned,
      showInfo
    } = this.state
    const { rightSidebarWidth, width, leftSidebarWidth, pinned, openedSideBar } = this.props
    const rt = infoPanelPinned && showInfo ? rightSidebarWidth : 0
    const lt = pinned && openedSideBar ? leftSidebarWidth : 0
    return width - rt - lt - 42
  }

  getWidthSftp = () => {
    const { width, leftSidebarWidth, pinned, openedSideBar } = this.props
    const lt = pinned && openedSideBar ? leftSidebarWidth : 0
    return width - lt - 42
  }

  renderTerminals = () => {
    const {
      terminals,
      activeSplitId,
      splitDirection,
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
            'fullscreenIcon',
            'setSessionState'
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
    return (
      <div
        className={cls}
        style={{
          width,
          height
        }}
      >
        <ResizeWrap
          direction={splitDirection}
          tab={tab}
        >
          {
            terminals.map((t, index) => {
              const logName = safeName(`${tab.title ? tab.title + '_' : ''}${tab.host ? tab.host + '_' : ''}${t.id}`)
              const pops = {
                ...this.props,
                ...t,
                activeSplitId,
                sftpPathFollowSsh,
                themeConfig,
                pane,
                ...pick(
                  this,
                  [
                    'setActive',
                    'handleSplit',
                    'delSplit',
                    'setSessionState',
                    'handleShowInfo',
                    'onChangePane',
                    'hideInfoPanel',
                    'setCwd',
                    'onDelKeyPressed'
                  ]),
                ...this.computePosition(t.position / 10)
              }
              return (
                <Term
                  key={t.id}
                  logName={logName}
                  sessionId={sessionId}
                  terminalIndex={index}
                  sessionOptions={sessionOptions}
                  {...pops}
                />
              )
            })
          }
        </ResizeWrap>
      </div>
    )
  }

  renderSftp = () => {
    const {
      sessionOptions,
      sessionId,
      pid,
      enableSftp,
      sftpPathFollowSsh,
      cwd
    } = this.state
    const { pane, type } = this.props.tab
    if (type === terminalRdpType) {
      return null
    }
    const height = this.computeHeight()
    const cls = pane === paneMap.terminal
      ? 'hide'
      : ''
    const exts = {
      sftpPathFollowSsh,
      cwd,
      pid,
      enableSftp,
      sessionOptions,
      height,
      sessionId,
      pane,
      ...this.props,
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
      activeSplitId: this.state.activeSplitId
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

  renderControl = () => {
    const { splitDirection, terminals, sftpPathFollowSsh } = this.state
    const { props } = this
    const { pane, enableSsh, type } = props.tab
    if (type === terminalRdpType || type === terminalVncType) {
      return null
    }
    const termType = props.tab?.type
    const isSsh = props.tab.authType
    const isLocal = !isSsh && (termType === connectionMap.local || !termType)
    const isHori = splitDirection === terminalSplitDirectionMap.horizontal
    const cls1 = 'mg1r icon-split pointer iblock spliter'
    const cls2 = 'icon-direction pointer iblock spliter'
    const Icon1 = isHori
      ? BorderHorizontalOutlined
      : BorderVerticleOutlined
    const Icon2 = !isHori
      ? BorderHorizontalOutlined
      : BorderVerticleOutlined
    const hide = terminals.length < 2
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
        {
          pane === paneMap.terminal
            ? (
              <div className='fright term-controls'>
                {this.fullscreenIcon()}
                {this.renderSearchIcon()}
                {
                  hide
                    ? null
                    : (
                      <CloseSquareFilled
                        className='mg1r icon-trash font16 iblock pointer spliter'
                        onClick={() => this.delSplit()}
                        title={m('del')}
                      />
                      )
                }
                <Tooltip
                  title={`${e('split')}`}
                  placement='bottomLeft'
                >
                  <Icon1
                    className={cls1}
                    onClick={this.handleSplit}
                  />
                </Tooltip>
                <Tooltip
                  title={e('changeDirection')}
                  placement='bottomLeft'
                >
                  <Icon2
                    className={cls2}
                    onClick={this.handleChangeDirection}
                  />
                </Tooltip>
              </div>
              )
            : null
        }
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
      topMenuHeight: this.props.topMenuHeight,
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
