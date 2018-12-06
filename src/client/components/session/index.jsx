
/**
 * terminal/sftp wrapper
 */
import React from 'react'
import Term from '../terminal'
import Sftp from '../sftp'
import {Icon} from 'antd'
import _ from 'lodash'
import {generate} from 'shortid'
import copy from 'json-deep-copy'
import classnames from 'classnames'
import {
  topMenuHeight, tabsHeight,
  terminalSplitDirectionMap, termControlHeight,
  paneMap
} from '../../common/constants'
import ResizeWrap from '../common/resize-wrap'
import keyControlPressed from '../../common/key-control-pressed'

const rebuildPosition = terminals => {
  let indexs = terminals.map(t => t.position).sort((a, b) => a - b)
  let indexMap = indexs.reduce((prev, pos, index) => {
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


const {prefix} = window
const e = prefix('ssh')
const m = prefix('menu')

export default class WindowWrapper extends React.PureComponent  {

  constructor(props) {
    super(props)
    let id = generate()
    this.state = {
      pane: paneMap.terminal,
      splitDirection: terminalSplitDirectionMap.horizontal,
      activeSplitId: id,
      key: Math.random(),
      sessionOptions: null,
      sshConnected: false,
      terminals: [
        {
          id,
          position: 0
        }
      ]
    }
  }

  componentDidMount() {
    this.initEvent()
  }

  componentWillUnmount() {
    this.destroyEvent()
  }

  initEvent() {
    window.addEventListener('keydown', this.handleEvent)
  }

  destroyEvent() {
    window.removeEventListener('keydown', this.handleEvent)
  }

  isActive() {
    return this.props.currentTabId === this.props.tab.id &&
      this.state.pane === paneMap.terminal
  }

  handleEvent = (e) => {
    if (!this.isActive()) {
      return
    }
    if (keyControlPressed(e) && e.code === 'Slash') {
      this.doSplit()
    }
  }

  computeHeight = () => {
    let {showControl} = this.props
    return this.props.height -
      (showControl ? topMenuHeight : 0) - tabsHeight
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
    let {activeSplitId, terminals} = this.state
    let newTerms = terminals.filter(t => t.id !== activeSplitId)
    if (!newTerms.length) {
      return
    }
    newTerms = rebuildPosition(newTerms)
    let newActiveId = getPrevTerminal(newTerms).id
    this.setState({
      terminals: newTerms,
      activeSplitId: newActiveId
    })
  }

  changeDirection = () => {
    let {splitDirection} = this.state
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
    let len = this.state.terminals.length || 1
    let {width: windowWidth} = this.props
    let {splitDirection} = this.state
    let isHori = splitDirection === terminalSplitDirectionMap.horizontal
    let heightAll = this.computeHeight()
    let width = isHori
      ? windowWidth / len
      : windowWidth
    let height = isHori
      ? heightAll
      : heightAll / len
    let left = isHori
      ? index * width
      : 0
    let top = isHori
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
    let {pane, terminals, splitDirection, sessionOptions} = this.state
    let cls = pane === paneMap.terminal
      ? 'terms-box bg-black'
      : 'terms-box bg-black hide'
    let {props} = this
    let height = this.computeHeight()
    let {width, tab} = props
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
            terminals.map((t) => {
              let pops = {
                ...props,
                ...t,
                pane,
                ..._.pick(
                  this,
                  ['setActive', 'doSplit', 'setSessionState']
                ),
                ...this.computePosition(t.position / 10)
              }
              return (
                <Term
                  key={t.id}
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
    let {pane, sessionOptions, sshConnected} = this.state
    let height = this.computeHeight()
    let {props} = this
    let cls = pane === paneMap.terminal
      ? 'hide'
      : ''
    return (
      <div className={cls}>
        <Sftp
          {...props}
          sessionOptions={sessionOptions}
          sshConnected={sshConnected}
          height={height}
          pane={pane}
        />
      </div>
    )
  }

  renderControl = () => {
    let {pane, splitDirection, terminals} = this.state
    let {props} = this
    let host = _.get(props, 'tab.host')
    let isHori = splitDirection === terminalSplitDirectionMap.horizontal
    let cls1 = 'mg1r icon-split pointer iblock spliter'
    let cls2 = 'icon-direction pointer iblock spliter'
    let icon1 = isHori
      ? 'border-horizontal'
      : 'border-verticle'
    let icon2 = !isHori
      ? 'border-horizontal'
      : 'border-verticle'
    let hide = terminals.length < 2
    let types = [
      paneMap.terminal,
      paneMap.fileManager
    ]
    return (
      <div
        className="terminal-control fix"
      >
        <div className="term-sftp-tabs fleft">
          {
            [
              host ? paneMap.ssh : paneMap.terminal,
              host ? paneMap.sftp : paneMap.fileManager
            ].map((type, i) => {
              let cls = classnames(
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
              <div className="fright term-controls">
                {
                  hide
                    ? null
                    : (
                      <Icon
                        type="close-circle"
                        theme="filled"
                        className="mg1r icon-trash font16 iblock pointer"
                        onClick={this.delSplit}
                        title={m('del')}
                      />
                    )
                }
                <Icon
                  type={icon1}
                  className={cls1}
                  onClick={this.doSplit}
                  title={e('split') + '(Ctrl + /)'}
                />
                <Icon
                  type={icon2}
                  className={cls2}
                  title={e('changeDirection')}
                  onClick={this.changeDirection}
                />
              </div>
            )
            : null
        }
      </div>
    )
  }

  render() {
    let {pane, splitDirection} = this.state
    return (
      <div
        className={'term-sftp-box ' + pane + ' ' + splitDirection}
        id={`is-${this.props.tab.id}`}
      >
        {this.renderControl()}
        {this.renderTerminals()}
        {this.renderSftp()}
      </div>
    )
  }

}
