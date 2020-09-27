
/**
 * terminal/sftp wrapper
 */
import { Component } from 'react'
import Term from '../terminal'
import Sftp from '../sftp/sftp-entry'
import { Icon, Tooltip } from 'antd'
import _ from 'lodash'
import { generate } from 'shortid'
import copy from 'json-deep-copy'
import classnames from 'classnames'
import {
  tabsHeight,
  terminalSplitDirectionMap, termControlHeight,
  paneMap, terminalSshConfigType, ctrlOrCmd
} from '../../common/constants'
import ResizeWrap from '../common/resize-wrap'
import keyControlPressed from '../../common/key-control-pressed'
import keyPressed from '../../common/key-pressed'
import TerminalInfoContent from '../terminal-info/content'

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
    const id = generate()
    this.state = {
      pid: null,
      pane: paneMap.terminal,
      splitDirection: terminalSplitDirectionMap.horizontal,
      activeSplitId: id,
      key: Math.random(),
      sessionOptions: null,
      sshConnected: false,
      enableSftp: props.tab.enableSftp,
      sessionId: generate(),
      terminals: [
        {
          id,
          position: 0
        }
      ],
      showInfo: false,
      infoPanelProps: {}
    }
  }

  componentDidMount () {
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
    return this.props.currentTabId === this.props.tab.id &&
      this.state.pane === paneMap.terminal
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
    return this.props.height - tabsHeight
  }

  onChangePane = pane => {
    this.setState({
      pane
    })
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
      id: generate(),
      position: terminals[index - 1].position + 5
    })
    terminals = rebuildPosition(terminals)
    this.setState({
      terminals
    })
  }

  delSplit = () => {
    const { activeSplitId, terminals } = this.state
    let newTerms = terminals.filter(t => t.id !== activeSplitId)
    if (!newTerms.length) {
      return
    }
    newTerms = rebuildPosition(newTerms)
    const newActiveId = getPrevTerminal(newTerms).id
    this.setState({
      terminals: newTerms,
      activeSplitId: newActiveId
    })
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
    this.setState({
      activeSplitId
    })
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
      pane,
      terminals,
      activeSplitId,
      splitDirection,
      sessionOptions,
      sessionId
    } = this.state
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
          height: height - termControlHeight
        }}
      >
        <ResizeWrap
          direction={splitDirection}
          tab={tab}
        >
          {
            terminals.map((t, index) => {
              const pops = {
                ...this.props,
                ...t,
                activeSplitId,
                themeConfig,
                pane,
                ..._.pick(
                  this,
                  ['setActive', 'doSplit', 'setSessionState', 'handleShowInfo', 'hideInfoPanel']
                ),
                ...this.computePosition(t.position / 10)
              }
              return (
                <Term
                  key={t.id}
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
    const { pane, sessionOptions, sshConnected, enableSftp, sessionId } = this.state
    const height = this.computeHeight()
    const cls = pane === paneMap.terminal
      ? 'hide'
      : ''
    return (
      <div className={cls}>
        <Sftp
          sessionOptions={sessionOptions}
          sshConnected={sshConnected}
          height={height}
          enableSftp={enableSftp}
          sessionId={sessionId}
          pane={pane}
          {...this.props}
        />
      </div>
    )
  }

  handleOpenSearch = () => {
    window.postMessage({
      action: 'open-terminal-search',
      id: this.state.activeSplitId
    }, '*')
  }

  renderSearchIcon = () => {
    const title = e('search')
    return (
      <Tooltip title={title}>
        <Icon
          type='search'
          className='mg1r icon-info font16 iblock pointer'
          onClick={this.handleOpenSearch}
        />
      </Tooltip>
    )
  }

  renderControl = () => {
    const { pane, splitDirection, terminals } = this.state
    const { props } = this
    const host = _.get(props, 'tab.host') &&
      _.get(props, 'tab.type') !== terminalSshConfigType
    const isHori = splitDirection === terminalSplitDirectionMap.horizontal
    const cls1 = 'mg1r icon-split pointer iblock spliter'
    const cls2 = 'icon-direction pointer iblock spliter'
    const icon1 = isHori
      ? 'border-horizontal'
      : 'border-verticle'
    const icon2 = !isHori
      ? 'border-horizontal'
      : 'border-verticle'
    const hide = terminals.length < 2
    const types = [
      paneMap.terminal,
      paneMap.fileManager
    ]
    return (
      <div
        className='terminal-control fix'
      >
        <div className='term-sftp-tabs fleft'>
          {
            [
              host ? paneMap.ssh : paneMap.terminal,
              host ? paneMap.sftp : paneMap.fileManager
            ].map((type, i) => {
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
                </span>
              )
            })
          }
        </div>
        {
          pane === paneMap.terminal
            ? (
              <div className='fright term-controls'>
                {this.renderSearchIcon()}
                {
                  hide
                    ? null
                    : (
                      <Icon
                        type='close-square'
                        theme='filled'
                        className='mg1r icon-trash font16 iblock pointer'
                        onClick={this.delSplit}
                        title={m('del')}
                      />
                    )
                }
                <Tooltip
                  title={`${e('split')}(${ctrlOrCmd} + /)`}
                >
                  <Icon
                    type={icon1}
                    className={cls1}
                    onClick={this.doSplit}
                  />
                </Tooltip>
                <Tooltip
                  title={e('changeDirection')}
                >
                  <Icon
                    type={icon2}
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
      pane,
      splitDirection,
      infoPanelProps,
      showInfo
    } = this.state
    const infoProps = {
      ..._.pick(this.props.config, ['host', 'port', 'saveTerminalLogToFile']),
      ...infoPanelProps,
      showInfo,
      // pid,
      // sessionId,
      // isRemote: this.isRemote(),
      // isActive: this.isActiveTerminal(),
      hideInfoPanel: this.hideInfoPanel
    }
    return (
      <div
        className={'term-sftp-box ' + pane + ' ' + splitDirection}
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
