
/**
 * terminal/sftp wrapper
 */
import { Component } from 'react'
import Term from '../terminal'
import Sftp from '../sftp/sftp-entry'
import {
  BorderVerticleOutlined,
  BorderHorizontalOutlined,
  CloseSquareFilled,
  SearchOutlined,
  FullscreenOutlined
} from '@ant-design/icons'
import { Tooltip } from 'antd'
import _ from 'lodash'
import generate from '../../common/uid'
import copy from 'json-deep-copy'
import classnames from 'classnames'
import {
  quickCommandBoxHeight,
  terminalSplitDirectionMap,
  termControlHeight,
  paneMap,
  ctrlOrCmd,
  footerHeight,
  terminalActions,
  connectionMap
} from '../../common/constants'
import ResizeWrap from '../common/resize-wrap'
import keyControlPressed from '../../common/key-control-pressed'
import keyPressed from '../../common/key-pressed'
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
  return _.last(terminals)
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
      splitDirection: terminalSplitDirectionMap.horizontal,
      activeSplitId,
      key: Math.random(),
      sessionOptions: null,
      sessionId: generate(),
      terminals,
      showInfo: false,
      infoPanelProps: {}
    }
  }

  componentDidMount () {
    this.updateTab()
    this.initEvent()
  }

  componentWillUnmount () {
    this.destroyEvent()
  }

  initEvent () {
    window.addEventListener('keydown', this.handleEvent)
  }

  destroyEvent () {
    window.removeEventListener('keydown', this.handleEvent)
  }

  isActive () {
    const {
      tab,
      currentTabId
    } = this.props
    return currentTabId === tab.id &&
      tab.pane === paneMap.terminal
  }

  handleEvent = (e) => {
    if (!this.isActive()) {
      return
    }
    if (keyControlPressed(e) && keyPressed(e, '/')) {
      this.doSplit()
    }
  }

  handleShowInfo = (infoPanelProps) => {
    this.setState({
      showInfo: true,
      infoPanelProps
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
    } = this.props.store
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
  }

  doSplit = (e, id) => {
    let terminals = copy(this.state.terminals)
    let index = _.findIndex(terminals, t => t.id === id)
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
    this.props.store.focus()
  }

  changeDirection = () => {
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
    const { width: windowWidth } = this.props
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

  renderTerminals = () => {
    const {
      terminals,
      activeSplitId,
      splitDirection,
      sessionOptions,
      sessionId
    } = this.state
    const {
      pane
    } = this.props.tab
    const cls = pane === paneMap.terminal
      ? 'terms-box'
      : 'terms-box hide'
    const height = this.computeHeight()
    const { store, width, tab } = this.props
    const themeConfig = copy(store.getThemeConfig())
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
                themeConfig,
                pane,
                ..._.pick(
                  this,
                  [
                    'setActive',
                    'doSplit',
                    'delSplit',
                    'setSessionState',
                    'handleShowInfo',
                    'onChangePane',
                    'hideInfoPanel'
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
    const { sessionOptions, sessionId, pid, enableSftp } = this.state
    const { pane } = this.props.tab
    const height = this.computeHeight()
    const cls = pane === paneMap.terminal
      ? 'hide'
      : ''
    return (
      <div className={cls}>
        <Sftp
          pid={pid}
          enableSftp={enableSftp}
          sessionOptions={sessionOptions}
          height={height}
          sessionId={sessionId}
          pane={pane}
          {...this.props}
        />
      </div>
    )
  }

  handleFullscreen = () => {
    this.props.store.toggleTermFullscreen(true)
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
      <Tooltip title={title}>
        <SearchOutlined
          className='mg1r icon-info font16 iblock pointer spliter'
          onClick={this.handleOpenSearch} />
      </Tooltip>
    )
  }

  fullscreenIcon = () => {
    const title = e('fullscreen')
    return (
      <Tooltip title={title}>
        <FullscreenOutlined
          className='mg1r icon-info font16 iblock pointer spliter'
          onClick={this.handleFullscreen} />
      </Tooltip>
    )
  }

  renderControl = () => {
    const { splitDirection, terminals } = this.state
    const { props } = this
    const { pane } = props.tab
    const termType = _.get(props, 'tab.type')
    const isSsh = props.tab.authType
    const isLocal = termType === connectionMap.local || !termType
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
                  {e(type)}
                  <span className='type-tab-line' />
                </span>
              )
            })
          }
        </div>
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
                        title={m('del')} />
                    )
                }
                <Tooltip
                  title={`${e('split')}(${ctrlOrCmd} + /)`}
                >
                  <Icon1
                    className={cls1}
                    onClick={this.doSplit}
                  />
                </Tooltip>
                <Tooltip
                  title={e('changeDirection')}
                >
                  <Icon2
                    className={cls2}
                    onClick={this.changeDirection}
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
      showInfo
    } = this.state
    const { pane } = this.props.tab
    const infoProps = {
      ..._.pick(this.props.config, ['host', 'port', 'saveTerminalLogToFile']),
      ...infoPanelProps,
      appPath: this.props.store.appPath,
      showInfo,
      tabsHeight: this.props.store.tabsHeight,
      topMenuHeight: this.props.store.topMenuHeight,
      // pid,
      // sessionId,
      // isRemote: this.isRemote(),
      // isActive: this.isActiveTerminal(),
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
